import { v4 as uuidv4 } from 'uuid';

export interface RunwareImageResult {
    taskType: string;
    taskUUID: string;
    imageUUID: string;
    imageURL: string;
    seed?: number;
    NSFWContent?: boolean;
    cost?: number;
}

interface RunwareResponse {
    data: RunwareImageResult[];
    errors?: { code: number; message: string }[];
}

export interface RunwareModelConfig {
    modelId?: string;
    steps?: number;
    CFGScale?: number;
    scheduler?: string;
    providerSettings?: Record<string, unknown>;
}

export const generateImageRunware = async (
    prompt: string,
    width: number,
    height: number,
    numberResults: number,
    apiKey: string,
    config?: RunwareModelConfig
): Promise<string[]> => {
    if (!apiKey) {
        throw new Error('Chave de API da RunWare não configurada.');
    }

    const taskUUID = uuidv4();
    const model = config?.modelId ?? 'runware:100@1';
    const isFluxModel = model.startsWith('runware:');

    const baseTask: Record<string, unknown> = {
        taskType: "imageInference",
        taskUUID,
        positivePrompt: prompt,
        width,
        height,
        model,
        numberResults,
        outputFormat: "JPEG",
        includeCost: true,
    };

    if (isFluxModel) {
        // FLUX models: outputType as string, with steps/CFGScale/scheduler
        baseTask.outputType = "URL";
        baseTask.steps = config?.steps ?? 4;
        baseTask.CFGScale = config?.CFGScale ?? 1;
        baseTask.scheduler = config?.scheduler ?? "FlowMatchEulerDiscreteScheduler";
    } else {
        // External models (Google, Ideogram, etc): outputType as array, no steps/CFGScale
        baseTask.outputType = ["URL"];
        if (config?.providerSettings) {
            baseTask.providerSettings = config.providerSettings;
        }
    }

    const requestBody = [baseTask];

    try {
        console.log("RunWare Request:", JSON.stringify(requestBody, null, 2));

        const response = await fetch("https://api.runware.ai/v1", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        console.log("RunWare Raw Response:", response.status, responseText);

        if (!response.ok) {
            throw new Error(`Erro na API RunWare (${response.status}): ${responseText}`);
        }

        const data: RunwareResponse = JSON.parse(responseText);

        if (data.errors && data.errors.length > 0) {
            throw new Error(`Erro RunWare: ${data.errors.map(e => e.message).join(', ')}`);
        }

        if (!data.data || data.data.length === 0) {
            throw new Error('Resposta da API vazia.');
        }

        // Each item in data array has imageURL directly
        const imageUrls = data.data
            .filter(item => item.imageURL)
            .map(item => item.imageURL);

        if (imageUrls.length === 0) {
            throw new Error(`Nenhuma imagem na resposta: ${responseText}`);
        }

        console.log(`RunWare: ${imageUrls.length} imagem(ns) gerada(s)`);
        return imageUrls;

    } catch (error) {
        console.error("RunWare Service Error:", error);
        throw error;
    }
};
