/**
 * EditorPersistenceService — Dual-storage para o editor visual.
 *
 * Segue o mesmo padrão do PersistenceService existente:
 * - Disco (primário): rápido, offline, binários
 * - Supabase (cloud sync): backup, acesso remoto
 *
 * Estrutura no disco:
 *   data/preferences.json         → Preferências do usuário (tema, layout)
 *   data/editor/{uuid}/           → Projetos do editor
 *     project.json                → EditorProject (tracks + clips)
 *     assets/                     → Imagens/áudios importados para o projeto
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EngineConfig } from '../types';
import {
  EditorProject,
  ThemePreference,
  EditorLayoutPreference,
} from '../types/editor';
import * as DiskStorage from './DiskStorageService';

export class EditorPersistenceService {
  private supabase: SupabaseClient | null = null;
  private useCloud: boolean = false;

  constructor(config?: EngineConfig) {
    this.updateConfig(config);
  }

  public updateConfig(config?: EngineConfig) {
    if (config?.apiKeys.supabaseUrl && config?.apiKeys.supabaseKey) {
      this.supabase = createClient(config.apiKeys.supabaseUrl, config.apiKeys.supabaseKey);
      this.useCloud = true;
    } else {
      this.useCloud = false;
    }
  }

  // ─── Inicialização ──────────────────────────────────────

  /** Cria diretórios necessários no disco */
  public async initEditorStorage(): Promise<void> {
    const base = await DiskStorage.getBasePath();
    await DiskStorage.ensureDir(DiskStorage.joinPath(base, 'editor'));
    console.log('[EditorPersistence] ✅ Storage do editor inicializado');
  }

  // ─── Preferências do Usuário ────────────────────────────

  /** Salva uma preferência (tema, layout, etc.) */
  public async savePreference(key: string, value: unknown): Promise<void> {
    // 1. Disco (sempre)
    const allPrefs = await this.loadAllPreferencesFromDisk();
    allPrefs[key] = value;
    await DiskStorage.writeJson('preferences.json', allPrefs);

    // 2. Supabase (se disponível)
    if (this.useCloud && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('user_preferences')
          .upsert(
            {
              key,
              value: JSON.parse(JSON.stringify(value)), // Garante JSONB válido
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          );
        if (error) console.error(`[EditorPersistence] Erro ao salvar preferência '${key}':`, error);
      } catch (e) {
        console.warn(`[EditorPersistence] Falha cloud para '${key}':`, e);
      }
    }
  }

  /** Carrega uma preferência (disco primeiro — rápido) */
  public async loadPreference<T>(key: string): Promise<T | null> {
    // 1. Disco primeiro (rápido)
    const allPrefs = await this.loadAllPreferencesFromDisk();
    if (allPrefs[key] !== undefined) {
      return allPrefs[key] as T;
    }

    // 2. Fallback Supabase
    if (this.useCloud && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_preferences')
          .select('value')
          .eq('key', key)
          .single();

        if (!error && data) {
          // Salvar no disco para cache
          allPrefs[key] = data.value;
          await DiskStorage.writeJson('preferences.json', allPrefs);
          return data.value as T;
        }
      } catch (e) {
        console.warn(`[EditorPersistence] Falha ao carregar '${key}' do cloud:`, e);
      }
    }

    return null;
  }

  /** Helpers de preferência tipados */
  public async saveTheme(theme: ThemePreference): Promise<void> {
    await this.savePreference('theme', theme);
  }

  public async loadTheme(): Promise<ThemePreference> {
    const pref = await this.loadPreference<ThemePreference>('theme');
    return pref || { mode: 'dark' }; // Default: dark mode
  }

  public async saveEditorLayout(layout: EditorLayoutPreference): Promise<void> {
    await this.savePreference('editor_layout', layout);
  }

  public async loadEditorLayout(): Promise<EditorLayoutPreference> {
    const pref = await this.loadPreference<EditorLayoutPreference>('editor_layout');
    return pref || {};
  }

  private async loadAllPreferencesFromDisk(): Promise<Record<string, unknown>> {
    const prefs = await DiskStorage.readJson<Record<string, unknown>>('preferences.json');
    return prefs || {};
  }

  // ─── Projetos do Editor ─────────────────────────────────

  /** Salva um projeto do editor (disco + Supabase) */
  public async saveEditorProject(project: EditorProject): Promise<void> {
    // Atualizar timestamp
    project.updatedAt = new Date().toISOString();

    // 1. Disco
    const projectDir = DiskStorage.joinPath('editor', project.id);
    await DiskStorage.ensureDir(
      DiskStorage.joinPath(await DiskStorage.getBasePath(), 'editor', project.id)
    );
    await DiskStorage.writeJson(
      DiskStorage.joinPath(projectDir, 'project.json'),
      project
    );

    // 2. Supabase
    if (this.useCloud && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('editor_projects')
          .upsert(
            {
              id: project.id,
              pipeline_project_id: project.pipelineProjectId || null,
              name: project.name,
              resolution_width: project.resolution.width,
              resolution_height: project.resolution.height,
              fps: project.fps,
              duration: project.duration,
              tracks: project.tracks, // JSONB — array completo de tracks+clips
              metadata: project.metadata || {},
              updated_at: project.updatedAt,
            },
            { onConflict: 'id' }
          );

        if (error) {
          console.error(`[EditorPersistence] Erro ao salvar projeto '${project.name}':`, error);
        } else {
          console.log(`[EditorPersistence] ☁️ Projeto '${project.name}' sincronizado com Supabase`);
        }
      } catch (e) {
        console.warn(`[EditorPersistence] Falha cloud para projeto:`, e);
      }
    }

    console.log(`[EditorPersistence] 💾 Projeto '${project.name}' salvo no disco`);
  }

  /** Carrega um projeto do editor (Supabase → fallback disco) */
  public async loadEditorProject(id: string): Promise<EditorProject | null> {
    // 1. Supabase primeiro (dados mais recentes)
    if (this.useCloud && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('editor_projects')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          const project = this.mapRowToEditorProject(data);
          // Cache no disco
          await this.saveEditorProjectToDiskOnly(project);
          return project;
        }
      } catch (e) {
        console.warn(`[EditorPersistence] Falha ao carregar projeto do cloud:`, e);
      }
    }

    // 2. Fallback disco
    const projectDir = DiskStorage.joinPath('editor', id);
    const diskProject = await DiskStorage.readJson<EditorProject>(
      DiskStorage.joinPath(projectDir, 'project.json')
    );
    return diskProject;
  }

  /** Lista todos os projetos do editor */
  public async listEditorProjects(): Promise<EditorProject[]> {
    const projects: EditorProject[] = [];

    // 1. Supabase primeiro
    if (this.useCloud && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('editor_projects')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          return data.map(this.mapRowToEditorProject);
        }
      } catch (e) {
        console.warn('[EditorPersistence] Falha ao listar projetos do cloud:', e);
      }
    }

    // 2. Fallback disco
    try {
      const editorDirs = await DiskStorage.listDirs('editor');
      for (const dirName of editorDirs) {
        const projectPath = DiskStorage.joinPath('editor', dirName, 'project.json');
        const project = await DiskStorage.readJson<EditorProject>(projectPath);
        if (project) {
          projects.push(project);
        }
      }
      // Ordenar por updatedAt desc
      projects.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (e) {
      console.error('[EditorPersistence] Erro ao listar projetos do disco:', e);
    }

    return projects;
  }

  /** Deleta um projeto do editor */
  public async deleteEditorProject(id: string): Promise<void> {
    // 1. Disco
    try {
      await DiskStorage.deleteDir(DiskStorage.joinPath('editor', id));
    } catch (e) {
      console.warn(`[EditorPersistence] Erro ao deletar projeto do disco:`, e);
    }

    // 2. Supabase
    if (this.useCloud && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('editor_projects')
          .delete()
          .eq('id', id);

        if (error) console.error(`[EditorPersistence] Erro ao deletar projeto do cloud:`, error);
      } catch (e) {
        console.warn(`[EditorPersistence] Falha cloud ao deletar:`, e);
      }
    }

    console.log(`[EditorPersistence] 🗑️ Projeto ${id} removido`);
  }

  // ─── Assets do Editor ───────────────────────────────────

  /** Salva um asset binário (imagem, áudio) no diretório do projeto */
  public async saveEditorAsset(
    projectId: string,
    filename: string,
    data: Uint8Array
  ): Promise<string> {
    const assetDir = DiskStorage.joinPath('editor', projectId, 'assets');
    await DiskStorage.ensureDir(
      DiskStorage.joinPath(await DiskStorage.getBasePath(), 'editor', projectId, 'assets')
    );
    const assetPath = DiskStorage.joinPath(assetDir, filename);
    await DiskStorage.writeBinary(assetPath, data);
    console.log(`[EditorPersistence] 💾 Asset '${filename}' salvo (${(data.length / 1024).toFixed(0)} KB)`);
    return assetPath;
  }

  /** Obtém URL de asset para exibição no webview */
  public async getEditorAssetUrl(projectId: string, filename: string): Promise<string> {
    const assetPath = DiskStorage.joinPath('editor', projectId, 'assets', filename);
    return DiskStorage.getAssetUrl(assetPath);
  }

  // ─── Helpers Privados ───────────────────────────────────

  /** Salva apenas no disco (sem Supabase — usado para cache) */
  private async saveEditorProjectToDiskOnly(project: EditorProject): Promise<void> {
    const projectDir = DiskStorage.joinPath('editor', project.id);
    await DiskStorage.ensureDir(
      DiskStorage.joinPath(await DiskStorage.getBasePath(), 'editor', project.id)
    );
    await DiskStorage.writeJson(
      DiskStorage.joinPath(projectDir, 'project.json'),
      project
    );
  }

  /** Mapeia row do Supabase → EditorProject */
  private mapRowToEditorProject(row: any): EditorProject {
    return {
      id: row.id,
      pipelineProjectId: row.pipeline_project_id || undefined,
      name: row.name,
      resolution: {
        width: row.resolution_width,
        height: row.resolution_height,
      },
      fps: row.fps,
      duration: Number(row.duration),
      tracks: row.tracks || [],
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
