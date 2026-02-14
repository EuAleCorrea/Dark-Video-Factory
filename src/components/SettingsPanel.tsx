import React, { useState } from 'react';
import { Save, HardDrive, Key, Server, AlertCircle, Cpu, Image as ImageIcon, Mic, Youtube, Box, Database, CheckCircle, XCircle, Loader2, ShieldCheck, Info } from 'lucide-react';
import { EngineConfig } from '../types';
import { PersistenceService } from '../services/PersistenceService';

interface SettingsPanelProps {
    config: EngineConfig;
    onSave: (config: EngineConfig) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave }) => {
    const [localConfig, setLocalConfig] = useState<EngineConfig>(config);
    const [isSaved, setIsSaved] = useState(false);

    // Connection Test State
    const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [testMessage, setTestMessage] = useState('');

    const handleChange = (field: keyof EngineConfig, value: any) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
        setIsSaved(false);
    };

    const handleProviderChange = (field: keyof EngineConfig['providers'], value: string) => {
        setLocalConfig(prev => ({
            ...prev,
            providers: { ...prev.providers, [field]: value }
        }));
        setIsSaved(false);
    }

    const handleKeyChange = (provider: keyof EngineConfig['apiKeys'], value: string) => {
        setLocalConfig(prev => ({
            ...prev,
            apiKeys: { ...prev.apiKeys, [provider]: value }
        }));
        setIsSaved(false);
        // Reset test status when keys change
        if (provider === 'supabaseUrl' || provider === 'supabaseKey') {
            setTestStatus('IDLE');
            setTestMessage('');
        }
    };

    const save = () => {
        onSave(localConfig);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const testSupabaseConnection = async () => {
        setTestStatus('TESTING');
        setTestMessage('Conectando...');

        try {
            const { createClient } = await import('@supabase/supabase-js');
            const url = localConfig.apiKeys.supabaseUrl;
            const key = localConfig.apiKeys.supabaseKey;
            if (!url || !key) throw new Error('URL ou Key não fornecidas');
            const client = createClient(url, key);
            const { error } = await client.from('profiles').select('id').limit(1);
            if (error) throw error;
            setTestStatus('SUCCESS');
            setTestMessage('Conexão bem-sucedida! Supabase está acessível.');
        } catch (e) {
            setTestStatus('ERROR');
            setTestMessage(`Falha: ${(e as Error).message}`);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">

            {/* HEADER */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Server size={100} />
                </div>
                <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2 mb-2 relative z-10">
                    <Server className="text-primary" />
                    Configuração do Motor Neural
                </h2>
                <p className="text-sm text-[#64748B] relative z-10">
                    Gerencie o roteamento de modelos de IA e credenciais de API.
                </p>
            </div>

            {/* INFO CARD: PERSISTENCE ARCHITECTURE */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-4 items-start">
                <div className="bg-blue-100 p-2 rounded-full mt-1">
                    <ShieldCheck size={18} className="text-blue-500" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-blue-700 mb-1">Armazenamento Seguro de Chaves</h4>
                    <p className="text-sm text-[#64748B] leading-relaxed">
                        <strong className="text-[#0F172A]">🔐 Criptografia AES-256:</strong> Suas chaves de API são criptografadas com <code className="bg-blue-100 px-1 rounded text-blue-700">pgp_sym_encrypt</code> antes de serem armazenadas no <strong>Supabase</strong>. Ninguém — nem mesmo administradores do banco — pode lê-las sem a passphrase.
                        <br />
                        <strong className="text-[#0F172A]">💾 Backup Local:</strong> Uma cópia também é mantida no <strong>LocalStorage</strong> do app para acesso offline. Configure as credenciais Supabase abaixo para habilitar a sincronização segura na nuvem.
                    </p>
                </div>
            </div>

            {/* MODEL ROUTING */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#64748B] uppercase tracking-wider mb-6 flex items-center gap-2 pb-4 border-b border-[#E2E8F0]">
                    <Cpu size={18} className="text-primary" /> Lógica de Roteamento de IA
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* ROTEIRO */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-[#64748B] uppercase flex items-center gap-2">
                            <Cpu size={16} className="text-blue-500" /> Inteligência de Roteiro
                        </label>
                        <div className="relative">
                            <select
                                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] text-sm font-medium outline-none focus:border-blue-500 transition appearance-none"
                                value={localConfig.providers.scripting}
                                onChange={(e) => handleProviderChange('scripting', e.target.value)}
                            >
                                <option value="GEMINI">Gemini 1.5 Pro (Gratuito / Rápido)</option>
                                <option value="OPENAI">OpenAI GPT-4o (Pago / Complexo)</option>
                                <option value="OPENROUTER">OpenRouter / Claude 3.5 (Pago)</option>
                            </select>
                            <div className="absolute right-3 top-3.5 pointer-events-none text-[#94A3B8]">▼</div>
                        </div>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">
                            Escolha "GPT-4o" para roteiros com nuances complexas ou "Gemini" para velocidade e eficiência de custo.
                        </p>
                    </div>

                    {/* VISUAL */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-[#64748B] uppercase flex items-center gap-2">
                            <ImageIcon size={16} className="text-purple-500" /> Motor de Renderização
                        </label>
                        <div className="relative">
                            <select
                                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] text-sm font-medium outline-none focus:border-purple-500 transition appearance-none"
                                value={localConfig.providers.image}
                                onChange={(e) => handleProviderChange('image', e.target.value)}
                            >
                                <option value="GEMINI">Gemini Imagen 3 (Rápido)</option>
                                <option value="FLUX">Flux.1 Pro (Alta Fidelidade)</option>
                            </select>
                            <div className="absolute right-3 top-3.5 pointer-events-none text-[#94A3B8]">▼</div>
                        </div>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">
                            Flux.1 oferece texturas fotorrealistas superiores, mas requer chave BFL paga.
                        </p>
                    </div>

                    {/* VOZ */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-[#64748B] uppercase flex items-center gap-2">
                            <Mic size={16} className="text-primary" /> Síntese de Voz (TTS)
                        </label>
                        <div className="relative">
                            <select
                                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] text-sm font-medium outline-none focus:border-primary transition appearance-none"
                                value={localConfig.providers.tts}
                                onChange={(e) => handleProviderChange('tts', e.target.value)}
                            >
                                <option value="GEMINI">Gemini TTS (Gratuito)</option>
                                <option value="ELEVENLABS">ElevenLabs v2 (Emotivo/Pago)</option>
                            </select>
                            <div className="absolute right-3 top-3.5 pointer-events-none text-[#94A3B8]">▼</div>
                        </div>
                        <p className="text-xs text-[#94A3B8] leading-relaxed">
                            ElevenLabs fornece entonação ultra-realista. Gemini é excelente para testes rápidos.
                        </p>
                    </div>
                </div>
            </div>

            {/* DATABASE & CLOUD SYNC */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-4 mb-6">
                    <h3 className="text-base font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-2">
                        <Database size={18} className="text-primary" /> Persistência & Cloud Sync (Supabase)
                    </h3>
                    <button
                        onClick={testSupabaseConnection}
                        disabled={!localConfig.apiKeys.supabaseUrl || !localConfig.apiKeys.supabaseKey || testStatus === 'TESTING'}
                        className="text-xs font-bold px-4 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded border border-[#E2E8F0] text-[#64748B] disabled:opacity-50 flex items-center gap-2 transition"
                    >
                        {testStatus === 'TESTING' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        Testar Conexão
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-primary mb-2">Supabase URL</label>
                        <input
                            type="text"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-primary outline-none tracking-widest"
                            value={localConfig.apiKeys.supabaseUrl || ''}
                            onChange={(e) => handleKeyChange('supabaseUrl', e.target.value)}
                            placeholder="https://xyz.supabase.co"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-primary mb-2">Supabase Anon Key</label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-primary outline-none tracking-widest"
                            value={localConfig.apiKeys.supabaseKey || ''}
                            onChange={(e) => handleKeyChange('supabaseKey', e.target.value)}
                            placeholder="eyJh..."
                        />
                    </div>

                    {/* Connection Feedback */}
                    <div className="col-span-2">
                        {testStatus === 'SUCCESS' && (
                            <div className="flex items-center gap-2 p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold">
                                <CheckCircle size={16} /> {testMessage}
                            </div>
                        )}
                        {testStatus === 'ERROR' && (
                            <div className="flex items-center gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm font-bold">
                                <XCircle size={16} /> {testMessage}
                            </div>
                        )}
                        {testStatus === 'IDLE' && (
                            <div className="flex gap-2 items-center text-xs text-[#94A3B8]">
                                <Info size={14} />
                                <p>
                                    Dica: Você pode injetar estas chaves via <code>process.env.SUPABASE_URL</code> no build para não precisar digitar aqui.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* API KEYS */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#64748B] uppercase tracking-wider mb-6 flex items-center gap-2 pb-4 border-b border-[#E2E8F0]">
                    <Key size={18} className="text-yellow-500" /> Cofre de Chaves (API Secrets)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-[#64748B] mb-2">Google Gemini API Key (Essencial)</label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-primary outline-none tracking-widest"
                            value={localConfig.apiKeys.gemini}
                            onChange={(e) => handleKeyChange('gemini', e.target.value)}
                            placeholder="sk-..."
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-red-500 mb-2 flex items-center gap-2">
                            <Youtube size={14} /> YouTube Data API v3
                        </label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-red-500 outline-none tracking-widest placeholder:text-[#CBD5E1]"
                            value={localConfig.apiKeys.youtube || ''}
                            onChange={(e) => handleKeyChange('youtube', e.target.value)}
                            placeholder="AIza..."
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-cyan-500 mb-2 flex items-center gap-2">
                            APIFY Token (Scraper)
                        </label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-cyan-500 outline-none tracking-widest placeholder:text-[#CBD5E1]"
                            value={localConfig.apiKeys.apify || ''}
                            onChange={(e) => handleKeyChange('apify', e.target.value)}
                            placeholder="apify_api_..."
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-purple-500 mb-2 flex items-center gap-2">
                            Flux API Key (BFL)
                        </label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-purple-500 outline-none tracking-widest placeholder:text-[#CBD5E1]"
                            value={localConfig.apiKeys.flux || ''}
                            onChange={(e) => handleKeyChange('flux', e.target.value)}
                            placeholder="sk-..."
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1 opacity-50 hover:opacity-100 transition">
                        <label className="block text-sm font-bold text-[#94A3B8] mb-2">ElevenLabs API Key (Opcional)</label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#64748B] font-mono text-sm focus:border-primary outline-none tracking-widest"
                            value={localConfig.apiKeys.elevenLabs}
                            onChange={(e) => handleKeyChange('elevenLabs', e.target.value)}
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-blue-600 mb-2 flex items-center gap-2">
                            OpenRouter API Key
                        </label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-blue-500 outline-none tracking-widest placeholder:text-[#CBD5E1]"
                            value={localConfig.apiKeys.openrouter || ''}
                            onChange={(e) => handleKeyChange('openrouter', e.target.value)}
                            placeholder="sk-or-v1-..."
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-bold text-emerald-600 mb-2 flex items-center gap-2">
                            OpenAI API Key
                        </label>
                        <input
                            type="password"
                            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-[#0F172A] font-mono text-sm focus:border-emerald-500 outline-none tracking-widest placeholder:text-[#CBD5E1]"
                            value={localConfig.apiKeys.openai || ''}
                            onChange={(e) => handleKeyChange('openai', e.target.value)}
                            placeholder="sk-..."
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={save}
                    className={`flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-white transition shadow-xl transform active:scale-95 ${isSaved ? 'bg-green-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                >
                    <Save size={18} />
                    {isSaved ? 'CONFIGURAÇÃO SALVA' : 'SALVAR ALTERAÇÕES'}
                </button>
            </div>

        </div>
    );
};

export default SettingsPanel;