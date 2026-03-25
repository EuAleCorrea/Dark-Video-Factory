import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { VideoProject, PipelineStage, ProjectStatus, StageDataMap, PIPELINE_STAGES_ORDER } from '../types';
import * as DiskStorage from './DiskStorageService';

const TABLE = 'video_projects';

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
            console.log(`[ProjectService] Tentando salvar projeto ${project.id} no Supabase...`);
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
            if (error) {
                console.error('[ProjectService] ❌ Erro ao inserir no Supabase:', error);
            } else {
                console.log('[ProjectService] ✅ Projeto salvo com sucesso no Supabase.');
            }
        } else {
            console.warn('[ProjectService]⚠️ Supabase não configurado. Salvando apenas localmente.');
        }

        // Save to disk
        await this.saveToDisk(project);
        return project;
    }

    // ─── READ ALL ────────────────────────────────────────────
    async loadProjects(channelId?: string): Promise<VideoProject[]> {
        let projects: VideoProject[] = [];

        // 1. Tenta carregar do Supabase
        if (isSupabaseConfigured()) {
            try {
                console.log('[ProjectService] Carregando projetos do Supabase...');
                let query = getSupabase().from(TABLE).select('*').order('created_at', { ascending: false });
                if (channelId) query = query.eq('channel_id', channelId);
                const { data, error } = await query;
                if (error) throw error;
                if (data && data.length > 0) {
                    console.log(`[ProjectService] ${data.length} projetos carregados da nuvem.`);
                    projects = data.map(this.mapFromDb);
                } else {
                    console.log('[ProjectService] Nenhum projeto encontrado na nuvem.');
                }
            } catch (e) {
                console.warn('[ProjectService] Cloud load failed, using local:', e);
            }
        }

        // 2. Fallback: carregar do disco
        if (projects.length === 0) {
            projects = await this.loadFromDisk(channelId);
            console.log(`[ProjectService] ${projects.length} projetos carregados do disco.`);
        }

        // 3. Sanity Check: Resetar 'processing' órfãos (travados por restart/crash)
        let hasFixes = false;
        projects = projects.map(p => {
            if (p.status === 'processing') {
                console.warn(`[ProjectService] Resetando projeto travado em processing: ${p.id}`);
                hasFixes = true;
                return {
                    ...p,
                    status: 'error' as ProjectStatus,
                    errorMessage: 'Processamento interrompido (app reiniciado ou fechado durante execução). Tente novamente.'
                };
            }
            return p;
        });

        // 4. Persistir correções se houve
        if (hasFixes) {
            await this.saveAllToDisk(projects);
            if (isSupabaseConfigured()) {
                projects.filter(p => p.status === 'error' && p.errorMessage?.includes('interrompido'))
                    .forEach(p => this.updateProject(p.id, {
                        status: 'error',
                        errorMessage: p.errorMessage
                    }).catch(err => console.error('Falha ao atualizar status de erro no Supabase:', err)));
            }
        }

        return projects;
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
            // errorMessage é salvo apenas localmente (coluna não existe no Supabase)

            const { error } = await getSupabase().from(TABLE).update(dbUpdates).eq('id', id);
            if (error) {
                console.error('[ProjectService] ❌ Update error Supabase:', error);
            } else if (updates.stageData) {
                const savedKeys = Object.keys(updates.stageData).filter(k => (updates.stageData as any)[k]);
                console.log(`[ProjectService] ☁️ Supabase OK — stage_data keys: [${savedKeys.join(', ')}]`);
            }
        }

        // Update on disk — no sanitization needed (no size limits)
        const existing = await DiskStorage.readJson<VideoProject>(
            DiskStorage.joinPath('projects', id, 'project.json')
        );
        if (existing) {
            const merged = { ...existing, ...updates, updatedAt: now };
            await DiskStorage.writeJson(
                DiskStorage.joinPath('projects', id, 'project.json'),
                merged
            );
        }
    }

    // ─── ADVANCE STAGE ───────────────────────────────────────
    async advanceStage(project: VideoProject, stageData: Partial<StageDataMap>): Promise<VideoProject> {
        const currentIdx = PIPELINE_STAGES_ORDER.indexOf(project.currentStage);
        const nextStage = PIPELINE_STAGES_ORDER[currentIdx + 1];

        if (!nextStage) {
            throw new Error('Projeto já está no último estágio');
        }

        const mergedStageData = { ...project.stageData, ...stageData };
        const stageKeys = Object.keys(mergedStageData).filter(k => mergedStageData[k as keyof StageDataMap]);
        console.log(`[ProjectService] advanceStage: ${project.currentStage} → ${nextStage}`);
        console.log(`[ProjectService]   → stageData keys being saved: [${stageKeys.join(', ')}]`);

        const updatedProject: VideoProject = {
            ...project,
            currentStage: nextStage,
            status: 'ready',
            stageData: mergedStageData,
            errorMessage: undefined,
            updatedAt: new Date().toISOString(),
        };

        await this.updateProject(project.id, {
            currentStage: updatedProject.currentStage,
            status: updatedProject.status,
            stageData: updatedProject.stageData,
            errorMessage: undefined,
        });

        console.log(`[ProjectService] ✅ advanceStage concluído. Projeto ${project.id} agora em '${nextStage}'.`);
        return updatedProject;
    }

    // ─── DELETE ──────────────────────────────────────────────
    async deleteProject(id: string): Promise<void> {
        if (isSupabaseConfigured()) {
            const { error } = await getSupabase().from(TABLE).delete().eq('id', id);
            if (error) console.error('[ProjectService] Delete error:', error);
        }
        // Delete entire project directory from disk
        await DiskStorage.deleteDir(DiskStorage.joinPath('projects', id));
        console.log(`[ProjectService] 🗑️ Projeto ${id} removido do disco.`);
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

    // ─── DISK STORAGE ────────────────────────────────────────

    /** Save a single project to disk as projects/{id}/project.json */
    private async saveToDisk(project: VideoProject): Promise<void> {
        const path = DiskStorage.joinPath('projects', project.id, 'project.json');
        await DiskStorage.writeJson(path, project);
    }

    /** Save all projects to disk (used for batch fixes) */
    private async saveAllToDisk(projects: VideoProject[]): Promise<void> {
        for (const p of projects) {
            await this.saveToDisk(p);
        }
    }

    /** Load all projects from disk by scanning projects/ subdirectories */
    private async loadFromDisk(channelId?: string): Promise<VideoProject[]> {
        const projectDirs = await DiskStorage.listDirs('projects');
        const projects: VideoProject[] = [];

        for (const dir of projectDirs) {
            try {
                const path = DiskStorage.joinPath('projects', dir, 'project.json');
                const project = await DiskStorage.readJson<VideoProject>(path);
                if (project) {
                    projects.push(project);
                }
            } catch (e) {
                console.warn(`[ProjectService] Skipping corrupt project dir: ${dir}`, e);
            }
        }

        // Sort by createdAt descending
        projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return channelId ? projects.filter(p => p.channelId === channelId) : projects;
    }
}
