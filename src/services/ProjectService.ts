import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { VideoProject, PipelineStage, ProjectStatus, StageDataMap, PIPELINE_STAGES_ORDER } from '../types';

const TABLE = 'video_projects';
const LOCAL_KEY = 'DARK_FACTORY_PROJECTS_V1';

export class ProjectService {

    // ─── CREATE ───────────────────────────────────────────────
    async createProject(channelId: string, title: string, stageData?: Partial<StageDataMap>): Promise<VideoProject> {
        const now = new Date().toISOString();
        const project: VideoProject = {
            id: crypto.randomUUID(),
            channelId,
            title,
            currentStage: PipelineStage.REFERENCE,
            status: 'ready',
            stageData: stageData || {},
            createdAt: now,
            updatedAt: now,
        };

        if (isSupabaseConfigured()) {
            const { error } = await getSupabase()
                .from(TABLE)
                .insert({
                    id: project.id,
                    channel_id: project.channelId,
                    title: project.title,
                    current_stage: project.currentStage,
                    status: project.status,
                    stage_data: project.stageData,
                    created_at: project.createdAt,
                    updated_at: project.updatedAt,
                });
            if (error) console.error('[ProjectService] Insert error:', error);
        }

        // Always save locally too
        this.saveLocal(project);
        return project;
    }

    // ─── READ ALL ────────────────────────────────────────────
    async loadProjects(channelId?: string): Promise<VideoProject[]> {
        if (isSupabaseConfigured()) {
            try {
                let query = getSupabase().from(TABLE).select('*').order('created_at', { ascending: false });
                if (channelId) query = query.eq('channel_id', channelId);
                const { data, error } = await query;
                if (error) throw error;
                if (data && data.length > 0) {
                    const projects = data.map(this.mapFromDb);
                    this.saveAllLocal(projects);
                    return projects;
                }
            } catch (e) {
                console.warn('[ProjectService] Cloud load failed, using local:', e);
            }
        }
        return this.loadLocal(channelId);
    }

    // ─── UPDATE ──────────────────────────────────────────────
    async updateProject(id: string, updates: Partial<VideoProject>): Promise<void> {
        const now = new Date().toISOString();

        if (isSupabaseConfigured()) {
            const dbUpdates: Record<string, unknown> = { updated_at: now };
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.currentStage !== undefined) dbUpdates.current_stage = updates.currentStage;
            if (updates.status !== undefined) dbUpdates.status = updates.status;
            if (updates.stageData !== undefined) dbUpdates.stage_data = updates.stageData;
            if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;

            const { error } = await getSupabase().from(TABLE).update(dbUpdates).eq('id', id);
            if (error) console.error('[ProjectService] Update error:', error);
        }

        // Update local — sanitize large binary data from stageData before saving
        const locals = this.loadLocalSync();
        const idx = locals.findIndex(p => p.id === id);
        if (idx >= 0) {
            const merged = { ...locals[idx], ...updates, updatedAt: now };
            // Strip data URLs maiores que 100KB para evitar QuotaExceededError
            if (merged.stageData?.audio?.fileUrl?.startsWith('data:')) {
                console.warn('[ProjectService] Sanitizando data URL grande do áudio → idb:// ref');
                merged.stageData = {
                    ...merged.stageData,
                    audio: { ...merged.stageData.audio, fileUrl: `idb://${id}` }
                };
            }
            locals[idx] = merged;
            try {
                localStorage.setItem(LOCAL_KEY, JSON.stringify(locals));
            } catch (e) {
                console.error('[ProjectService] localStorage cheio, limpando e tentando novamente:', e);
                // Fallback: limpar projetos antigos e tentar de novo
                try {
                    localStorage.setItem(LOCAL_KEY, JSON.stringify([merged]));
                } catch {
                    console.error('[ProjectService] localStorage irrecuperável');
                }
            }
        }
    }

    // ─── ADVANCE STAGE ───────────────────────────────────────
    async advanceStage(project: VideoProject, stageData: Partial<StageDataMap>): Promise<VideoProject> {
        const currentIdx = PIPELINE_STAGES_ORDER.indexOf(project.currentStage);
        const nextStage = PIPELINE_STAGES_ORDER[currentIdx + 1];

        if (!nextStage) {
            throw new Error('Projeto já está no último estágio');
        }

        const updatedProject: VideoProject = {
            ...project,
            currentStage: nextStage,
            status: 'ready',
            stageData: { ...project.stageData, ...stageData },
            errorMessage: undefined,
            updatedAt: new Date().toISOString(),
        };

        await this.updateProject(project.id, {
            currentStage: updatedProject.currentStage,
            status: updatedProject.status,
            stageData: updatedProject.stageData,
            errorMessage: undefined,
        });

        return updatedProject;
    }

    // ─── DELETE ──────────────────────────────────────────────
    async deleteProject(id: string): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await getSupabase().from(TABLE).delete().eq('id', id);
            if (error) console.error('[ProjectService] Delete error:', error);
        }
        const locals = this.loadLocalSync().filter(p => p.id !== id);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(locals));
    }

    // ─── HELPERS ─────────────────────────────────────────────
    private mapFromDb(row: Record<string, unknown>): VideoProject {
        return {
            id: row.id as string,
            channelId: row.channel_id as string,
            title: row.title as string,
            currentStage: row.current_stage as PipelineStage,
            status: row.status as ProjectStatus,
            stageData: (row.stage_data || {}) as StageDataMap,
            errorMessage: row.error_message as string | undefined,
            createdAt: row.created_at as string,
            updatedAt: row.updated_at as string,
        };
    }

    private saveLocal(project: VideoProject): void {
        const all = this.loadLocalSync();
        const idx = all.findIndex(p => p.id === project.id);
        if (idx >= 0) all[idx] = project;
        else all.unshift(project);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    }

    private saveAllLocal(projects: VideoProject[]): void {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
    }

    private loadLocal(channelId?: string): VideoProject[] {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (!raw) return [];
        try {
            const all: VideoProject[] = JSON.parse(raw);
            // Auto-sanitize: strip data URLs de áudio que ficaram no localStorage
            let dirty = false;
            for (const p of all) {
                if (p.stageData?.audio?.fileUrl?.startsWith('data:')) {
                    p.stageData.audio.fileUrl = `idb://${p.id}`;
                    dirty = true;
                }
            }
            if (dirty) {
                console.warn('[ProjectService] Sanitizado data URLs de áudio do localStorage');
                try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch { /* ignore */ }
            }
            return channelId ? all.filter(p => p.channelId === channelId) : all;
        } catch {
            return [];
        }
    }

    private loadLocalSync(): VideoProject[] {
        return this.loadLocal();
    }
}
