
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { videoQueue } from '@/lib/queue';
import { JobStatus, PipelineStep, VideoJob } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { channelId, theme, modelChannel, referenceScript } = body;

        if (!channelId || !theme) {
            return NextResponse.json(
                { error: 'channelId and theme are required' },
                { status: 400 }
            );
        }

        const jobId = uuidv4();

        // Se houver canal modelo mas não houver script, começamos pela etapa de referência
        const initialStep = (modelChannel && !referenceScript)
            ? PipelineStep.REFERENCE_FETCH
            : PipelineStep.INIT;

        const newJob: VideoJob = {
            id: jobId,
            channelId,
            theme,
            modelChannel,
            referenceScript,
            status: JobStatus.QUEUED,
            currentStep: initialStep,
            progress: 0,
            logs: [],
            files: [],
        };

        // 1. Salvar no Supabase
        const { error: dbError } = await supabase
            .from('jobs')
            .insert({
                id: newJob.id,
                channel_id: newJob.channelId,
                theme: newJob.theme,
                model_channel: newJob.modelChannel,
                reference_script: newJob.referenceScript,
                status: newJob.status,
                current_step: newJob.currentStep,
                progress: newJob.progress,
                logs: newJob.logs,
                files: newJob.files,
                created_at: new Date().toISOString()
            });

        if (dbError) {
            console.error('Database Error:', dbError);
            return NextResponse.json({ error: 'Failed to create job in database' }, { status: 500 });
        }

        // 2. Enviar para Fila BullMQ
        await videoQueue.add('generate-video', newJob);

        return NextResponse.json({ success: true, jobId, message: 'Job queued successfully' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
