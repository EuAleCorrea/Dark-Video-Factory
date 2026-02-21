import { StoryboardSegment, EngineConfig, ChannelProfile } from "../types";
import { callLLMWithRetry } from "./geminiService";

/**
 * Resposta esperada do LLM para o agrupamento de cenas.
 */
interface SceneGroupingResponse {
    scenes: {
        id: number;
        visualPrompt: string;
        segmentIds: number[];
    }[];
}

/**
 * StoryboardPlanner
 * 
 * Serviço responsável por analisar os segmentos de um vídeo e agrupá-los em cenas coesas,
 * gerando um prompt visual único para cada cena (ao invés de um por segmento).
 */
export const planStoryboard = async (
    segments: StoryboardSegment[],
    profile: ChannelProfile,
    config: EngineConfig,
    modelId: string = 'google/gemini-2.0-flash-lite-preview-02-05:free',
    provider: 'GEMINI' | 'OPENAI' | 'OPENROUTER' = 'OPENROUTER'
): Promise<StoryboardSegment[]> => {

    console.log(`[StoryboardPlanner] 🧠 Planejando cenas para ${segments.length} segmentos...`);
    console.log(`[StoryboardPlanner] 🤖 Usando modelo: ${provider}/${modelId}`);

    const scriptContext = segments.map(s => `[ID:${s.id}] ${s.scriptText}`).join('\n');

    const systemPrompt = `
Você é um diretor de arte e especialista em storyboards para YouTube.
Sua tarefa é analisar os segmentos de um roteiro e agrupá-los em "Cenas Visuais" lógicas.

REGRAS DE AGRUPAMENTO:
1. Um vídeo com muitos segmentos deve ser agrupado em 10 a 20 cenas no máximo (tente agrupar 3 a 6 segmentos por cena).
2. Segmentos que tratam do mesmo assunto ou ideia devem pertencer à mesma cena.
3. Para cada cena, você deve criar um "visualPrompt" em INGLÊS que será usado em uma IA de imagem como Midjourney ou Flux.
4. O estilo visual deve ser: ${profile.visualStyle}.
5. Personas/Contexto: ${profile.llmPersona}.

SAÍDA ESPERADA:
Você deve retornar um objeto JSON estrito com o seguinte formato:
{
  "scenes": [
    {
      "id": 1,
      "visualPrompt": "A highly detailed cinematic shot of...",
      "segmentIds": [1, 2, 3, 4]
    },
    ...
  ]
}

IMPORTANTE: Todos os segmentIds fornecidos na entrada (${segments.map(s => s.id).join(', ')}) devem ser incluídos em exatamente uma cena.
`;

    const userPrompt = `Abaixo estão os segmentos do roteiro:\n\n${scriptContext}`;

    try {
        const rawResponse = await callLLMWithRetry(systemPrompt, userPrompt, modelId, provider, config);
        const parsed: SceneGroupingResponse = JSON.parse(rawResponse);

        console.log(`[StoryboardPlanner] ✅ Agrupamento concluído: ${parsed.scenes.length} cenas geradas.`);

        // Mapear os prompts visuais de volta para os segmentos
        const updatedSegments = segments.map(seg => {
            const scene = parsed.scenes.find(s => s.segmentIds.includes(seg.id));
            return {
                ...seg,
                visualPrompt: scene ? scene.visualPrompt : seg.visualPrompt
            };
        });

        return updatedSegments;

    } catch (error) {
        console.error(`[StoryboardPlanner] Erro ao planejar storyboard:`, error);
        throw new Error(`Falha no agrupamento de cenas via IA: ${error instanceof Error ? error.message : String(error)}`);
    }
};
