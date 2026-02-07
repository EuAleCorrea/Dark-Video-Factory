import 'dotenv/config';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { processRenderJob } from './processors/ffmpeg';

// ============================================
// DARK FACTORY - Local Rendering Worker
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let channel: RealtimeChannel;

async function handleJobUpdate(payload: any) {
    const job = payload.new;

    // Só processar jobs que estão esperando renderização
    if (job.status !== 'RENDERING_PENDING') return;

    console.log(`\n🎬 ════════════════════════════════════════`);
    console.log(`   Novo Job Detectado: ${job.id}`);
    console.log(`   Tema: ${job.theme}`);
    console.log(`════════════════════════════════════════\n`);

    try {
        // Marcar como "em processamento" para evitar que outros workers peguem
        await supabase.from('jobs').update({
            status: 'RENDERING',
            current_step: 'Renderização FFmpeg Docker'
        }).eq('id', job.id);

        // Executar a renderização
        await processRenderJob(supabase, job);

        // Atualizar para próximo passo
        await supabase.from('jobs').update({
            status: 'THUMBNAIL_GEN',
            current_step: 'Gerando Thumbnail (IA)',
            progress: 80
        }).eq('id', job.id);

        console.log(`✅ Job ${job.id} renderizado com sucesso!`);

    } catch (error) {
        console.error(`❌ Erro ao processar job ${job.id}:`, error);

        await supabase.from('jobs').update({
            status: 'FAILED',
            logs: [...(job.logs || []), {
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                message: `Falha na renderização: ${error}`
            }]
        }).eq('id', job.id);
    }
}

async function pollForPendingJobs() {
    console.log('🔍 Verificando jobs pendentes...');

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'RENDERING_PENDING')
        .order('created_at', { ascending: true })
        .limit(1);

    if (error) {
        console.error('Erro ao buscar jobs:', error);
        return;
    }

    if (jobs && jobs.length > 0) {
        await handleJobUpdate({ new: jobs[0] });
    }
}

async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏭  DARK FACTORY - Local Rendering Worker  🏭           ║
║                                                           ║
║   Status: ONLINE                                          ║
║   Supabase: ${SUPABASE_URL.substring(0, 40)}...           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

    // Polling a cada 10 segundos (fallback caso o real-time falhe)
    setInterval(pollForPendingJobs, 10000);

    // Tentar usar Real-time para resposta instantânea
    try {
        channel = supabase
            .channel('jobs-render-channel')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'jobs',
                filter: 'status=eq.RENDERING_PENDING'
            }, handleJobUpdate)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📡 Real-time: Conectado e ouvindo mudanças...');
                }
            });
    } catch (e) {
        console.warn('⚠️ Real-time indisponível, usando apenas polling.');
    }

    // Verificar imediatamente ao iniciar
    await pollForPendingJobs();

    console.log('\n⏳ Aguardando jobs de renderização...\n');
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando worker...');
    if (channel) await supabase.removeChannel(channel);
    process.exit(0);
});

main();
