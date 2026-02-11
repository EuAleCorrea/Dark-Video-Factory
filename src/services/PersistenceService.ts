import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChannelProfile, VideoJob, EngineConfig, JobStatus, ChannelPrompt } from '../types';

const STORAGE_KEY_PROFILES = 'DARK_FACTORY_PROFILES_V1';

export class PersistenceService {
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

  // --- PROFILES ---

  public async saveProfiles(profiles: ChannelProfile[]): Promise<void> {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));

    if (this.useCloud && this.supabase) {
      for (const p of profiles) {
        const { error } = await this.supabase
          .from('profiles')
          .upsert({
            id: p.id,
            name: p.name,
            format: p.format,
            visual_style: p.visualStyle,
            voice_profile: p.voiceProfile,
            bgm_theme: p.bgmTheme,
            subtitle_style: p.subtitleStyle,
            llm_persona: p.llmPersona,
            youtube_credentials: p.youtubeCredentials,
            active_prompt_id: p.activePromptId, // NOVO
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (error) console.error("Erro ao salvar perfil no Supabase:", error);
      }
    }
  }

  public async loadProfiles(): Promise<ChannelProfile[] | null> {
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase.from('profiles').select('*');
      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          format: row.format,
          visualStyle: row.visual_style,
          voiceProfile: row.voice_profile,
          bgmTheme: row.bgm_theme,
          subtitleStyle: row.subtitle_style,
          llmPersona: row.llm_persona,
          youtubeCredentials: row.youtube_credentials,
          activePromptId: row.active_prompt_id // NOVO
        }));
      }
    }
    const local = localStorage.getItem(STORAGE_KEY_PROFILES);
    return local ? JSON.parse(local) : null;
  }

  // --- PROMPTS ---

  public async loadChannelPrompts(profileId: string): Promise<ChannelPrompt[]> {
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase
        .from('channel_prompts')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(row => ({
          id: row.id,
          profileId: row.profile_id,
          promptText: row.prompt_text,
          isActive: row.is_active,
          createdAt: row.created_at
        }));
      }
    }
    return [];
  }

  public async createChannelPrompt(profileId: string, text: string): Promise<ChannelPrompt | null> {
    if (this.useCloud && this.supabase) {
      // 1. Desativar prompts anteriores
      await this.supabase
        .from('channel_prompts')
        .update({ is_active: false })
        .eq('profile_id', profileId);

      // 2. Criar novo prompt
      const { data, error } = await this.supabase
        .from('channel_prompts')
        .insert({
          profile_id: profileId,
          prompt_text: text,
          is_active: true
        })
        .select()
        .single();

      if (!error && data) {
        // 3. Atualizar perfil com o novo prompt ativo
        await this.supabase
          .from('profiles')
          .update({ active_prompt_id: data.id })
          .eq('id', profileId);

        return {
          id: data.id,
          profileId: data.profile_id,
          promptText: data.prompt_text,
          isActive: data.is_active,
          createdAt: data.created_at
        };
      }
    }
    return null;
  }

  // --- JOBS ---

  public async saveJob(job: VideoJob): Promise<void> {
    if (this.useCloud && this.supabase) {
      try {
        const payload = {
          id: job.id,
          channel_id: job.channelId,
          theme: job.theme,
          model_channel: job.modelChannel,
          reference_script: job.referenceScript,
          reference_metadata: job.referenceMetadata,
          applied_prompt_id: job.appliedPromptId, // NOVO
          status: job.status,
          current_step: job.currentStep,
          progress: job.progress,
          logs: job.logs,
          files: job.files,
          metadata: job.metadata,
          result: job.result,
          updated_at: new Date().toISOString()
        };

        const { error } = await this.supabase
          .from('jobs')
          .upsert(payload, { onConflict: 'id' });

        if (error) console.error(`[Persistence] Erro ao salvar Job ${job.id}:`, error);
      } catch (e) {
        console.error(`[Persistence] Falha crítica ao salvar Job:`, e);
      }
    }
  }

  public async loadJobs(): Promise<VideoJob[] | null> {
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          channelId: row.channel_id,
          theme: row.theme,
          modelChannel: row.model_channel,
          referenceScript: row.reference_script,
          referenceMetadata: row.reference_metadata,
          appliedPromptId: row.applied_prompt_id, // NOVO
          status: row.status as JobStatus,
          currentStep: row.current_step,
          progress: row.progress,
          logs: row.logs || [],
          files: row.files || [],
          metadata: row.metadata,
          result: row.result
        }));
      }
    }
    return [];
  }

  // --- ENGINE CONFIG ---

  public async saveEngineConfig(config: EngineConfig): Promise<void> {
    // 1. SEMPRE salvar no LocalStorage primeiro (Garante que nunca se perca)
    localStorage.setItem('DARK_FACTORY_CONFIG_V1_BACKUP', JSON.stringify(config));

    if (this.useCloud && this.supabase) {
      const secrets = [
        { key_name: 'gemini_api_key', secret_value: config.apiKeys.gemini },
        { key_name: 'youtube_api_key', secret_value: config.apiKeys.youtube },
        { key_name: 'apify_token', secret_value: config.apiKeys.apify },
        { key_name: 'elevenlabs_api_key', secret_value: config.apiKeys.elevenLabs },
        { key_name: 'openai_api_key', secret_value: config.apiKeys.openai },
        { key_name: 'flux_api_key', secret_value: config.apiKeys.flux },
        { key_name: 'openrouter_api_key', secret_value: config.apiKeys.openrouter },
      ];

      for (const secret of secrets) {
        if (!secret.secret_value) continue;

        const { error } = await this.supabase
          .from('engine_secrets')
          .upsert({
            key_name: secret.key_name,
            secret_value: secret.secret_value,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key_name' });

        if (error) console.error(`Erro ao salvar secret ${secret.key_name}:`, error.message || error);
      }
    }
  }

  public async loadEngineConfig(): Promise<Partial<EngineConfig> | null> {
    // 1. Carregar local primeiro (veloz e garantido)
    const localRaw = localStorage.getItem('DARK_FACTORY_CONFIG_V1_BACKUP') || localStorage.getItem('DARK_FACTORY_CONFIG_V1');
    let config: Partial<EngineConfig> = localRaw ? JSON.parse(localRaw) : {};

    // 2. Se tiver Cloud, tentar enriquecer com os secrets do banco
    if (this.useCloud && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('engine_secrets').select('*');

        if (!error && data) {
          const cloudApiKeys: any = {};
          data.forEach((row: any) => {
            const keyMapping: any = {
              'gemini_api_key': 'gemini',
              'youtube_api_key': 'youtube',
              'apify_token': 'apify',
              'elevenlabs_api_key': 'elevenLabs',
              'openai_api_key': 'openai',
              'flux_api_key': 'flux',
              'openrouter_api_key': 'openrouter'
            };
            const camelKey = keyMapping[row.key_name];
            if (camelKey && row.secret_value) {
              cloudApiKeys[camelKey] = row.secret_value;
            }
          });

          // Mescla: Cloud sobrepõe Local apenas se o campo Cloud existir
          config = {
            ...config,
            apiKeys: {
              ...(config.apiKeys || {}),
              ...cloudApiKeys,
              supabaseUrl: config.apiKeys?.supabaseUrl || '',
              supabaseKey: config.apiKeys?.supabaseKey || ''
            }
          };
        }
      } catch (e) {
        console.warn("[Persistence] Erro ao carregar config da Cloud, usando apenas Local:", e);
      }
    }

    return Object.keys(config).length > 0 ? config : null;
  }
}