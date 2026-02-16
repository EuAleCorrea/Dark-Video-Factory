import { ElevenLabsVoice, ElevenLabsModel, ElevenLabsUser } from '../types';

export class ElevenLabsService {
    private apiKey: string;
    private baseUrl = 'https://api.elevenlabs.io/v1';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail?.message || `ElevenLabs API error: ${response.statusText}`);
        }

        return response.json();
    }

    async getVoices(): Promise<ElevenLabsVoice[]> {
        const data = await this.fetchApi<{ voices: ElevenLabsVoice[] }>('/voices');
        return data.voices;
    }

    async getModels(): Promise<ElevenLabsModel[]> {
        return this.fetchApi<ElevenLabsModel[]>('/models');
    }

    async getUserInfo(): Promise<ElevenLabsUser> {
        return this.fetchApi<ElevenLabsUser>('/user');
    }

    async generateAudio(voiceId: string, text: string, modelId: string = 'eleven_multilingual_v2', settings?: any): Promise<Blob> {
        const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model_id: modelId,
                voice_settings: settings,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail?.message || `TTS generation failed: ${response.statusText}`);
        }

        return response.blob();
    }
}
