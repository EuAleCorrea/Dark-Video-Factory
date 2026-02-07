import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChannelProfile, VideoJob, EngineConfig, JobStatus } from '../types';

const STORAGE_KEY_PROFILES = 'DARK_FACTORY_PROFILES_V1';

export class PersistenceService {
  private supabase: SupabaseClient | null = null;
  private useCloud: boolean = false;

  constructor(config?: EngineConfig) {
    this.updateConfig(config);
  }

  public updateConfig(config?: EngineConfig) {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (envUrl && envKey) {
      this.supabase = createClient(envUrl, envKey);
      this.useCloud = true;
    } else if (config?.apiKeys.supabaseUrl && config?.apiKeys.supabaseKey) {
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
            subtitle_style: p.subtitleStyle, // JSONB
            llm_persona: p.llmPersona,
            youtube_credentials: p.youtubeCredentials,
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
          youtubeCredentials: row.youtube_credentials
        }));
      }
    }
    const local = localStorage.getItem(STORAGE_KEY_PROFILES);
    return local ? JSON.parse(local) : null;
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
          reference_script: row.reference_script,
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

        await this.supabase
          .from('engine_secrets')
          .upsert({
            key_name: secret.key_name,
            secret_value: secret.secret_value,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key_name' });
      }

      localStorage.setItem('DARK_FACTORY_ENGINE_SETTINGS', JSON.stringify({
        hostVolumePath: config.hostVolumePath,
        ffmpegContainerImage: config.ffmpegContainerImage,
        maxConcurrentJobs: config.maxConcurrentJobs,
        providers: config.providers
      }));
    }
  }

  public async loadEngineConfig(): Promise<Partial<EngineConfig> | null> {
    if (this.useCloud && this.supabase) {
      const { data, error } = await this.supabase.from('engine_secrets').select('*');

      if (!error && data) {
        const apiKeys: any = {};
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
          if (camelKey) apiKeys[camelKey] = row.secret_value;
        });

        const localSettings = localStorage.getItem('DARK_FACTORY_ENGINE_SETTINGS');
        const settings = localSettings ? JSON.parse(localSettings) : {};

        return {
          ...settings,
          apiKeys: {
            ...apiKeys,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          }
        };
      }
    }
    return null;
  }
}