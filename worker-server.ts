import 'dotenv/config';
import { cloudWorker } from './lib/cloudWorker';

console.log('🚀 Cloud Worker Iniciado!');
console.log('📡 Aguardando Jobs na fila...');

cloudWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} finalizado com sucesso!`);
});

cloudWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} falhou:`, err);
});
