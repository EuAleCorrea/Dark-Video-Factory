const fs = require('fs');
const file = 'z:/Documentos/Projetos/Dark Video Factory/src/components/StageDetailsModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
if (!content.includes('ElevenLabsService')) {
    content = content.replace(
        `import { PersistenceService } from '../services/PersistenceService';`,
        `import { PersistenceService } from '../services/PersistenceService';\nimport { ElevenLabsService } from '../services/ElevenLabsService';`
    );
}

// Replace states
if (!content.includes('sceneAudioConfigs')) {
    content = content.replace(
        `    const [imageViewerData, setImageViewerData] = React.useState<{ url: string, text: string } | null>(null);\r\n    const isGeneratingRef = React.useRef(false);\r\n    const status = useStatusModal();`,
        `    const [imageViewerData, setImageViewerData] = React.useState<{ url: string, text: string } | null>(null);\n    const [sceneAudioConfigs, setSceneAudioConfigs] = React.useState<Record<number, { provider: string, voiceId: string }>>({});\n    const [elevenLabsVoices, setElevenLabsVoices] = React.useState<any[]>([]);\n    const [elevenLabsLoading, setElevenLabsLoading] = React.useState(false);\n    const isGeneratingRef = React.useRef(false);\n    const status = useStatusModal();`
    );
}

// Replace effects
if (!content.includes('fetchVoices')) {
    content = content.replace(
        `    React.useEffect(() => {\r\n        if (!isOpen || !project || !stage) return;`,
        `    React.useEffect(() => {\n        if (!isOpen || !config?.apiKeys?.elevenLabs) return;\n        const fetchVoices = async () => {\n            try {\n                setElevenLabsLoading(true);\n                const service = new ElevenLabsService(config.apiKeys.elevenLabs!);\n                const voices = await service.getVoices();\n                setElevenLabsVoices(voices);\n            } catch (err) {\n                console.error('Failed to load ElevenLabs voices:', err);\n            } finally {\n                setElevenLabsLoading(false);\n            }\n        };\n        fetchVoices();\n    }, [isOpen, config?.apiKeys?.elevenLabs]);\n\n    React.useEffect(() => {\n        if (!isOpen || !project || !stage) return;`
    );
}

// Replace override
if (!content.includes('override as any')) {
    content = content.replace(
        `            await pipeline.processSingleSceneAudio(project, sceneId, profile, config);\r\n            status.success('Áudio gerado com sucesso!');`,
        `            const override = sceneAudioConfigs[sceneId] || { \n                provider: config.providers.tts || 'google', \n                voiceId: profile.voiceProfile || 'Kore' \n            };\n\n            await pipeline.processSingleSceneAudio(project, sceneId, profile, config, override as any);\n            status.success('Áudio gerado com sucesso!');`
    );
}

// Replace selects UI
if (!content.includes('sceneAudioConfigs[scene.id]?.provider')) {
    const target = `                                        <div className="mt-3 flex items-center justify-between">\r\n                                            <button\r\n                                                onClick={() => handleGenerateSceneAudio(scene.id)}`;
    const replacement = `                                        <div className="mt-3 flex flex-col gap-3">
                                            {/* Controles de Áudio (Seletores) */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Motor TTS:</span>
                                                    <select
                                                        value={sceneAudioConfigs[scene.id]?.provider || config?.providers?.tts || 'google'}
                                                        onChange={(e) => {
                                                            const newProvider = e.target.value;
                                                            setSceneAudioConfigs(prev => ({
                                                                ...prev,
                                                                [scene.id]: {
                                                                    provider: newProvider,
                                                                    voiceId: newProvider === 'google' ? 'Kore' : (elevenLabsVoices[0]?.voice_id || '')
                                                                }
                                                            }));
                                                        }}
                                                        className="text-xs border border-slate-200 rounded px-2 py-1 outline-none text-slate-700 bg-slate-50 focus:border-blue-300"
                                                    >
                                                        <option value="google">Google TTS</option>
                                                        <option value="elevenlabs">ElevenLabs</option>
                                                    </select>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Voz:</span>
                                                    <select
                                                        value={sceneAudioConfigs[scene.id]?.voiceId || profile?.voiceProfile || 'Kore'}
                                                        onChange={(e) => {
                                                            setSceneAudioConfigs(prev => ({
                                                                ...prev,
                                                                [scene.id]: {
                                                                    ...(prev[scene.id] || { provider: config?.providers?.tts || 'google' }),
                                                                    voiceId: e.target.value
                                                                }
                                                            }));
                                                        }}
                                                        className="text-xs border border-slate-200 rounded px-2 py-1 outline-none text-slate-700 bg-slate-50 focus:border-blue-300 max-w-[150px]"
                                                    >
                                                        {(sceneAudioConfigs[scene.id]?.provider || config?.providers?.tts || 'google') === 'google' ? (
                                                            <>
                                                                <option value="Kore">Alloy (Feminina)</option>
                                                                <option value="Puck">Echo (Masculino)</option>
                                                                <option value="Charon">Fable (Masculino)</option>
                                                                <option value="Fenrir">Onyx (Masculino)</option>
                                                                <option value="Zephyr">Nova (Feminina)</option>
                                                                <option value="Aoede">Shimmer (Feminina)</option>
                                                            </>
                                                        ) : (
                                                            elevenLabsLoading ? (
                                                                <option value="">Carregando...</option>
                                                            ) : elevenLabsVoices.length > 0 ? (
                                                                elevenLabsVoices.map(v => (
                                                                    <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                                                                ))
                                                            ) : (
                                                                <option value="">Nenhuma voz</option>
                                                            )
                                                        )}
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                            <button
                                                onClick={() => handleGenerateSceneAudio(scene.id)}`;
                                                
    content = content.replace(target, replacement);
    
    // FIND </button>\n                                        </div> to replace with proper closing div
    const target2 = `                                                {generatingAudioIds.includes(scene.id) ? 'Gerando...' : 'Gerar Áudio'}\r\n                                            </button>\r\n                                        </div>`;
    const replacement2 = `                                                {generatingAudioIds.includes(scene.id) ? 'Gerando...' : 'Gerar Áudio'}
                                            </button>
                                            </div>
                                        </div>`;
    content = content.replace(target2, replacement2);
}

fs.writeFileSync(file, content, 'utf8');
console.log('done patching!');
