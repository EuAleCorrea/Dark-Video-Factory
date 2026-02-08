
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { videoQueue } from '@/lib/queue';
import { JobStatus, PipelineStep, VideoJob } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { channelId, theme, modelChannel, referenceScript, referenceMetadata, appliedPromptId, status } = body;

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
            referenceMetadata,
            appliedPromptId, // NOVO
            status: status || JobStatus.QUEUED,
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
                reference_metadata: newJob.referenceMetadata,
                applied_prompt_id: newJob.appliedPromptId, // NOVO
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

        // 2. Enviar para Fila BullMQ (apenas se não for PENDING)
        if (newJob.status !== JobStatus.PENDING) {
            await videoQueue.add('generate-video', newJob);
        }

        return NextResponse.json({
            success: true,
            jobId,
            message: newJob.status === JobStatus.PENDING ? 'Job saved as pending' : 'Job queued successfully'
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const { jobId } = await request.json();

        if (!jobId) {
            return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
        }

        // 1. Buscar job no Supabase
        const { data: job, error: fetchError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        if (job.status !== JobStatus.PENDING) {
            return NextResponse.json({ error: 'Job is not in PENDING status' }, { status: 400 });
        }

        // 2. Atualizar status para QUEUED no Supabase
        const { error: updateError } = await supabase
            .from('jobs')
            .update({ status: JobStatus.QUEUED })
            .eq('id', jobId);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update job status' }, { status: 500 });
        }

        // 3. Adicionar à fila BullMQ
        const fullJob = {
            ...job,
            status: JobStatus.QUEUED,
            channelId: job.channel_id,
            modelChannel: job.model_channel,
            referenceScript: job.reference_script,
            referenceMetadata: job.reference_metadata
        };
        await videoQueue.add('generate-video', fullJob);

        return NextResponse.json({ success: true, message: 'Job started successfully' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
