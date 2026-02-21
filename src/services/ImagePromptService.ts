
import { EngineConfig } from '../types';
import { callLLMWithRetry } from './geminiService';

/**
 * IMAGE PROMPT SERVICE
 * 
 * Especialista em expandir frases curtas do roteiro em prompts visuais ultra detalhados
 * para geração de imagens (Flux/Gemini).
 */

const DEFAULT_EXPANSION_INSTRUCTION = `You are an expert in creating image generation prompts. Based on this phrase, create a concise and lean prompt with a maximum of 2000 characters to generate a romantic and melancholic landscape, using natural elements, symbolic objects, and, when appropriate, human figures. If including human figures, always provide an extremely detailed and explicit description, specifying: approximate age (young adult, middle-aged), gender, exact and natural pose (for example: standing upright with arms at sides, sitting on a bench with hands on lap, walking along a path with visible legs and arms), detailed clothing (such as: long blue coat, white cotton dress), precise body positioning (for example: head slightly tilted down, hands clasped behind back, feet firmly on the ground), and clear placement within the scene (for example: in the foreground, walking away on a path, sitting alone on a bench under a tree). Ensure the description makes it absolutely clear that the entire human figure should be visible, with all body parts present and naturally proportioned, avoiding ambiguity or partial figures. The prompt should contain a strong emotional ambiance with visual symbols representing time, love, and separation through: forking paths, solitary bridges, open windows, forgotten letters or objects, wilted flowers, antique clocks, empty benches, trails in the sand, footprints walking away, intertwined trees, melancholic sunset, crescent moon, distant stars, waves receding from shore, mountains separated by valleys, diverging rivers, lonely lighthouses, houses with a single light on, and solitary human figures when relevant to the emotional narrative. Use rich and specific visual language, as if describing an impressionist painting or cinematic scene. IMPORTANT: If including people, be extremely detailed and explicit in physical description, pose, body position, and placement, always making it clear that the full human figure must be present, with all limbs and body parts visible and naturally integrated into the scene, to ensure precise and complete rendering by FLUX. Output only the prompt description itself. Do not include line breaks or blank lines, the text should be sequential without interruptions. Do not use '\\n' or '\\n\\n' - the text should be clean and sequential.`;

export class ImagePromptService {
    /**
     * Expande um texto de cena em um prompt visual detalhado.
     * Tenta OpenRouter (Free) -> Fallback para Gemini Direct.
     */
    static async expandPrompt(
        sceneText: string,
        artDirectionStyle: string,
        config: EngineConfig,
        customInstruction?: string
    ): Promise<string> {
        const systemInstruction = customInstruction || DEFAULT_EXPANSION_INSTRUCTION;

        // Combinamos a descrição da cena com o estilo visual global para dar contexto à LLM
        const userPrompt = `FRASE DA CENA: "${sceneText}"\nESTILO VISUAL DESEJADO: ${artDirectionStyle}`;

        console.log(`[ImagePrompt] 🧠 Expandindo prompt para: "${sceneText.substring(0, 50)}..."`);

        try {
            // TENTATIVA 1: OpenRouter Gemini 2.0 Flash Lite (FREE)
            if (config.apiKeys.openrouter) {
                try {
                    console.log(`[ImagePrompt] 🚀 Tentando OpenRouter (Gemini 2.0 Flash Lite Free)...`);
                    const result = await callLLMWithRetry(
                        systemInstruction,
                        userPrompt,
                        'google/gemini-2.0-flash-lite-preview-02-05:free',
                        'OPENROUTER',
                        config,
                        'text'
                    );
                    if (result) return result.trim();
                } catch (orErr) {
                    console.warn(`[ImagePrompt] ⚠️ OpenRouter falhou ou quota atingida. Ativando fallback...`, orErr);
                }
            }

            // TENTATIVA 2: Gemini Direct (API Key Principal)
            if (config.apiKeys.gemini) {
                console.log(`[ImagePrompt] 🔄 Usando fallback: Gemini Direct...`);
                const result = await callLLMWithRetry(
                    systemInstruction,
                    userPrompt,
                    'gemini-2.0-flash', // Ou 1.5-flash dependendo do que estiver disponível
                    'GEMINI',
                    config,
                    'text'
                );
                return result.trim();
            }

            throw new Error("Nenhuma API Key configurada para expansão de prompt (OpenRouter ou Gemini).");
        } catch (err) {
            console.error(`[ImagePrompt] ❌ Falha crítica na expansão do prompt:`, err);
            // Em caso de falha TOTAL, retorna o texto original + estilo para não travar a geração
            return `${sceneText}. ${artDirectionStyle}`;
        }
    }
}
