
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { VideoJob } from '@/types';

export const useJobMonitor = (channelId?: string) => {
    const [jobs, setJobs] = useState<VideoJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!channelId || !isSupabaseConfigured()) return;

        // Load initial data
        const fetchJobs = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('jobs')
                .select('*')
                .eq('channel_id', channelId)
                .order('created_at', { ascending: false });

            if (data && !error) {
                setJobs(data.map(mapJobFromDB));
            }
            setLoading(false);
        };

        fetchJobs();

        // Subscribe to changes
        const channel = supabase
            .channel('jobs-monitor')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'jobs',
                    filter: `channel_id=eq.${channelId}`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setJobs((prev) => [mapJobFromDB(payload.new), ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setJobs((prev) =>
                            prev.map((job) =>
                                job.id === payload.new.id ? mapJobFromDB(payload.new) : job
                            )
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setJobs((prev) => prev.filter((job) => job.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [channelId]);

    return { jobs, loading };
};

// Helper: Mapeia snake_case do DB para CamelCase do Frontend
const mapJobFromDB = (row: any): VideoJob => ({
    id: row.id,
    channelId: row.channel_id,
    theme: row.theme,
    modelChannel: row.model_channel,
    referenceScript: row.reference_script,
    referenceMetadata: row.reference_metadata,
    status: row.status,
    currentStep: row.current_step,
    progress: row.progress,
    logs: row.logs || [],
    files: row.files || [],
    metadata: row.metadata,
    result: row.result
});
