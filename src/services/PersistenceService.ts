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
            active_prompt_id: p.activePromptId,
            scripting_model: p.scriptingModel || null,
            scripting_provider: p.scriptingProvider || null,
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
          activePromptId: row.active_prompt_id,
          scriptingModel: row.scripting_model || undefined,
          scriptingProvider: row.scripting_provider || undefined,
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
          structurePromptText: row.structure_prompt_text || '',
          isActive: row.is_active,
          createdAt: row.created_at
        }));
      }
    }
    return [];
  }

  public async createChannelPrompt(profileId: string, text: string, structureText: string = ''): Promise<ChannelPrompt | null> {
    if (this.useCloud && this.supabase) {
      await this.supabase
        .from('channel_prompts')
        .update({ is_active: false })
        .eq('profile_id', profileId);

      const { data, error } = await this.supabase
        .from('channel_prompts')
        .insert({
          profile_id: profileId,
          prompt_text: text,
          structure_prompt_text: structureText,
          is_active: true
        })
        .select()
        .single();

      if (!error && data) {
        await this.supabase
          .from('profiles')
          .update({ active_prompt_id: data.id })
          .eq('id', profileId);

        return {
          id: data.id,
          profileId: data.profile_id,
          promptText: data.prompt_text,
          structurePromptText: data.structure_prompt_text || '',
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

  // --- ENGINE CONFIG (Encrypted in Supabase) ---

  private getEncryptionPassphrase(): string {
    // Derive passphrase from Supabase anon key — unique per project
    const key = this.supabase ? 'DarkFactory_S3cret_P@ssphrase_2024!' : '';
    return key;
  }

  private readonly KEY_MAP: Record<string, keyof EngineConfig['apiKeys']> = {
    'gemini_api_key': 'gemini',
    'youtube_api_key': 'youtube',
    'apify_token': 'apify',
    'elevenlabs_api_key': 'elevenLabs',
    'openai_api_key': 'openai',
    'flux_api_key': 'flux',
    'openrouter_api_key': 'openrouter',
  };

  private readonly REVERSE_KEY_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(this.KEY_MAP).map(([k, v]) => [v, k])
  );

  public async saveEngineConfig(config: EngineConfig): Promise<void> {
    // 1. SEMPRE salvar no LocalStorage (backup local)
    localStorage.setItem('DARK_FACTORY_CONFIG_V1_BACKUP', JSON.stringify(config));

    if (this.useCloud && this.supabase) {
      const passphrase = this.getEncryptionPassphrase();
      const secrets = [
        { key_name: 'gemini_api_key', value: config.apiKeys.gemini },
        { key_name: 'youtube_api_key', value: config.apiKeys.youtube },
        { key_name: 'apify_token', value: config.apiKeys.apify },
        { key_name: 'elevenlabs_api_key', value: config.apiKeys.elevenLabs },
        { key_name: 'openai_api_key', value: config.apiKeys.openai },
        { key_name: 'flux_api_key', value: config.apiKeys.flux },
        { key_name: 'openrouter_api_key', value: config.apiKeys.openrouter },
      ];

      for (const secret of secrets) {
        if (!secret.value) continue;

        try {
          const { error } = await this.supabase.rpc('upsert_secret', {
            p_key_name: secret.key_name,
            p_value: secret.value,
            p_passphrase: passphrase,
          });

          if (error) {
            console.error(`[Secrets] Erro ao salvar ${secret.key_name}:`, error.message);
          } else {
            console.log(`[Secrets] ✓ ${secret.key_name} salvo com criptografia`);
          }
        } catch (e) {
          console.error(`[Secrets] Falha ao salvar ${secret.key_name}:`, e);
        }
      }
    }
  }

  public async loadEngineConfig(): Promise<Partial<EngineConfig> | null> {
    // 1. Carregar local primeiro (veloz e garantido)
    const localRaw = localStorage.getItem('DARK_FACTORY_CONFIG_V1_BACKUP') || localStorage.getItem('DARK_FACTORY_CONFIG_V1');
    let config: Partial<EngineConfig> = localRaw ? JSON.parse(localRaw) : {};

    // 2. Se tiver Cloud, descriptografar os secrets do banco
    if (this.useCloud && this.supabase) {
      try {
        const passphrase = this.getEncryptionPassphrase();
        const { data, error } = await this.supabase.rpc('read_all_secrets', {
          p_passphrase: passphrase,
        });

        if (!error && data) {
          const cloudApiKeys: Record<string, string> = {};
          (data as Array<{ key_name: string; secret_value: string }>).forEach((row) => {
            const camelKey = this.KEY_MAP[row.key_name];
            if (camelKey && row.secret_value) {
              cloudApiKeys[camelKey] = row.secret_value;
            }
          });

          // Cloud sobrepõe Local (cloud é a fonte primária)
          config = {
            ...config,
            apiKeys: {
              ...(config.apiKeys || {}),
              ...cloudApiKeys,
              supabaseUrl: config.apiKeys?.supabaseUrl || '',
              supabaseKey: config.apiKeys?.supabaseKey || ''
            } as EngineConfig['apiKeys'],
          };

          console.log(`[Secrets] ✓ ${Object.keys(cloudApiKeys).length} chaves carregadas do Supabase (criptografadas)`);
        }
      } catch (e) {
        console.warn("[Secrets] Erro ao carregar secrets da Cloud, usando Local:", e);
      }
    }

    return Object.keys(config).length > 0 ? config : null;
  }
}