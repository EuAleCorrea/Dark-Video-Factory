# Dark Video Factory — PRD (Product Requirements Document)

> **Última atualização:** 2026-03-02 11:20
> **Consulta obrigatória:** Este documento deve ser lido no início de cada sessão antes de qualquer implementação.

---

## 1. Visão Geral

**Dark Video Factory** é uma aplicação desktop (Tauri v2) para automação de criação de vídeos para YouTube. Ela pega vídeos de referência de outros canais, transcreve, reescreve o roteiro com IA, gera áudio TTS, legendas, imagens, renderiza o vídeo final e publica no YouTube — tudo em um pipeline visual Kanban.

### Stack Técnico

| Camada | Tecnologia |
|--------|------------|
| Runtime Desktop | **Tauri v2** (Rust backend) |
| Frontend | **React 18 + Vite** |
| Styling | **Tailwind CSS v4** |
| State | React state local (`useState`, `useRef`) |
| Storage | **localStorage** (projetos/config) + **IndexedDB** (áudio binário) |
| AI/LLM | Google Gemini, OpenAI, OpenRouter (o1, o3, GPT-4o, etc.) |
| TTS | Google Gemini TTS, ElevenLabs |
| Imagens | **RunWare** (Flux.1 Schnell), Google Gemini Imagen, **Together.ai** (Flux.1 Schnell) |
| Transcrição | **APIFY** (`starvibe~youtube-video-transcript`) |
| YouTube API | YouTube Data API v3 (busca de vídeos) |
| Database | Supabase PostgreSQL (opcional, configuração dinâmica) |

---

## 2. Arquitetura de Componentes

### 2.1 Árvore de Componentes

```
App.tsx (42KB — componente raiz, orquestra tudo)
├── SettingsPanel.tsx — Config de API keys, providers, paths
├── ProfileEditor.tsx — Criar/editar perfis de canal + prompts
├── Dashboard.tsx — Métricas e overview
├── VideoSelectorModal.tsx — Buscar e selecionar vídeos do YouTube
├── TranscriptApprovalModal.tsx — Aprovar transcrições em batch
├── StageActionModal.tsx — Modal de ações de estágio (auto/manual)
├── KanbanBoard.tsx — Container do board Kanban
│   └── KanbanColumn.tsx — Uma coluna por estágio
│       └── ProjectCard.tsx — Card individual de projeto
├── StageDetailsModal.tsx — Visualização detalhada de dados do estágio (Referência/Roteiro)
│   └── VideoPlayerModal.tsx — Player de vídeo embedado via YouTube iFrame
├── ErrorDetailModal.tsx — Visualização profunda de logs de erro + Reset de estágio
├── PromptDebugModal.tsx — Preview visual de prompts antes de enviar para IA (P1/P2)
├── BatchActionBar.tsx — Barra de ações em lote (processar, deletar)
├── ImageGeneratorPanel.tsx — Interface de geração de imagens via RunWare (Flux.1 Schnell)
├── PreviewPlayer.tsx — Player de preview de vídeo
├── Storyboard.tsx — Visualização de segmentos do storyboard (Suporta edição de visualPrompt)
├── JobQueue.tsx — Fila de jobs (sistema legado)
├── Terminal.tsx — Log de terminal
├── SystemHealth.tsx — Status do sistema
├── AssetBrowser.tsx — Navegador de assets
├── DistributionPanel.tsx — Painel de distribuição
├── ElevenLabsPanel.tsx — Interface dedicada para geração TTS via ElevenLabs (Clone Visual Studio 3.0)
└── GoogleTTSPanel.tsx — Interface dedicada para geração TTS via Google Gemini
```

### 2.2 Fluxo de Dados

```
App.tsx
  ├── state: projects[], selectedProjectIds, config, profiles[]
  ├── refs: projectServiceRef, pipelineExecutorRef, persistenceRef
  │
  ├── handleCreateProject → ProjectService.createProject()
  ├── handleDeleteProject → ProjectService.deleteProject()
  ├── handleBatchAutoAdvance → PipelineExecutor.processProject()
  ├── handleBatchManualAdvance → ProjectService.advanceStage()
  │
  └── KanbanBoard
        └── KanbanColumn
              └── ProjectCard
                    ├── onToggleSelect → handleToggleProjectSelect
                    ├── onClick → handleProjectClick
                    └── onDelete → handleDeleteProject
```

---

## 3. Pipeline de Estágios (Kanban)

O coração do sistema é o **Pipeline Kanban** com 10 estágios sequenciais:

| # | Estágio | Enum | Descrição | Automação |
|---|---------|------|-----------|-----------|
| 1 | **Referência** | `REFERENCE` | Selecionar vídeo, buscar transcrição via APIFY | Auto (APIFY) |
| 2 | **Roteiro** | `SCRIPT` | Reescrever transcript com IA (2 prompts: P1 Reescrita + P2 Estruturação) | Auto (LLM) |
| 3 | **Áudio** | `AUDIO` | Gerar narração TTS do roteiro | Auto (Gemini TTS / ElevenLabs) |
| 4 | **Compactar** | `AUDIO_COMPRESS` | Comprimir áudio WAV → MP3 via FFmpeg | Auto (FFmpeg) |
| 5 | **Legendas** | `SUBTITLES` | Gerar storyboard (segmentos 9-18s) + legendas .ass | Auto (smartChunker + alignmentEngine + subtitleGenerator) |
| 6 | **Imagens** | `IMAGES` | Agrupar segmentos em cenas inteligentes via LLM + Gerar imagens por cena via IA | Auto (StoryboardPlanner) → Review → 🔜 IA |
| 7 | **Vídeo** | `VIDEO` | Renderizar vídeo com FFmpeg nativo | Auto (VideoRenderService + FFmpeg) |
| 8 | **Publicar YT** | `PUBLISH_YT` | Upload para YouTube | 🔜 Não implementado |
| 9 | **Thumbnail** | `THUMBNAIL` | Gerar thumbnail com IA | 🔜 Não implementado |
| 10 | **Publicar Thumb** | `PUBLISH_THUMB` | Definir thumbnail no YouTube | 🔜 Não implementado |

### 3.1 Status de Projeto

Cada projeto tem um `status` que pode ser:

| Status | Significado | Visual |
|--------|-------------|--------|
| `waiting` | Aguardando (default) | Cinza |
| `pending` | Estágio necessita dados (ex: sem transcript) | Amarelo |
| `processing` | Sendo processado | Roxo + spinner |
| `review` | Processado, aguardando aprovação humana | Verde ✅ |
| `ready` | Dados do estágio completos, pronto para avançar | Verde |
| `error` | Falha no processamento | Vermelho |

### 3.2 Fluxo de Processamento (Auto)

```
1. Usuário seleciona projetos → clica "Processar"
2. handleBatchAutoAdvance()
   ├── REFERENCE: chama PipelineExecutor.processProject()
   │   └── processReferenceStage(): APIFY transcreve → status='review'
   │   └── Abre TranscriptApprovalModal
   ├── SCRIPT: chama PipelineExecutor.processProject()
   │   └── processScriptStage(): P1 + P2 → status='review'
   │   └── Abre StageActionModal (review roteiro)
   └── AUDIO: chama PipelineExecutor.processProject()
       └── processAudioStage(): TTS → salva IndexedDB → avança estágio
```

---

## 4. Serviços

### 4.1 ProjectService (`services/ProjectService.ts`)

CRUD de projetos com persistência em disco (`$APPDATA/DarkVideoFactory/projects/`) + Supabase (opcional).

| Método | Descrição |
|--------|-----------|
| `createProject(channelId, title, stageData?)` | Cria projeto novo |
| `loadProjects(channelId?)` | Carrega todos os projetos do disco |
| `updateProject(id, updates)` | Atualiza campos do projeto |
| `advanceStage(project, stageData)` | Move para próximo estágio |
| `deleteProject(id)` | Remove projeto (inclui diretório no disco) |

**Storage:**
- Cada projeto em `projects/{id}/project.json` via `DiskStorageService`
- Áudio bruto em `projects/{id}/audio.wav`, comprimido em `audio_compressed.mp3`
- Sem limite de tamanho (disco nativo via Tauri)

### 4.2 PipelineExecutor (`services/PipelineExecutor.ts`)

Orquestra o processamento automático de cada estágio. Possui captura enriquecida de erros (Stack Trace/JSON).

| Método | Descrição |
|--------|-----------|
| `processProject(project)` | Entry point: roteia para o handler do estágio atual |
| `processReferenceStage(project, config)` | Transcreve via APIFY, valida transcript |
| `processScriptStage(project, profile, config)` | Executa P1 (Reescrita) + P2 (Estruturação) com **debug visual** (PromptDebugModal) |
| `processAudioStage(project, profile, config)` | Gera TTS, converte PCM→WAV, salva IndexedDB |
| `processAudioCompressStage(project)` | Comprime WAV → MP3 via FFmpeg nativo |

**Dependências injetadas:** `ProjectService`, `PersistenceService`, `getConfig()`, `getProfile()`

**Debug de Prompts:** O executor suporta um callback `setPromptPreview()` que abre o `PromptDebugModal` antes de cada chamada LLM, permitindo inspeção do system/user prompt antes do envio.

### 4.3 GeminiService (`services/geminiService.ts`)

Funções de IA genéricas com routing dinâmico entre providers.

| Função | Descrição |
|--------|-----------|
| `callLLM(system, user, model, provider, config)` | Router genérico LLM |
| `callLLMWithRetry(...)` | Wrapper com exponential backoff (3 retries) |
| `rewriteTranscript(transcript, prompt, ...)` | P1 — Reescrita Magnética |
| `structureScript(text, prompt, ...)` | P2 — Estruturação Viral |
| `generateVideoScriptAndPrompts(profile, theme, ...)` | Pipeline completo de roteiro |
| `generateSpeech(text, voiceId, config)` | TTS via Gemini/ElevenLabs |
| `generateImage(prompt, ratio, config)` | Geração de imagens via Gemini/Flux |
| `generateVideoMetadata(profile, script, config)` | Gera título, descrição, tags SEO |

### 4.4 PersistenceService (`services/PersistenceService.ts`)

Gerencia perfis de canal e prompts (Supabase + localStorage).

### 4.5 AudioStorageService (`services/AudioStorageService.ts`)

Armazena áudio binário (WAV) no IndexedDB para evitar `QuotaExceededError` no localStorage.

| Função | Descrição |
|--------|-----------|
| `saveAudio(projectId, wavData)` | Salva Uint8Array no IndexedDB |
| `loadAudio(projectId)` | Recupera dados do áudio |
| `deleteAudio(projectId)` | Remove dados do áudio |

### 4.6 JobQueueService (`services/JobQueueService.ts`)

Sistema de fila de jobs (legado, anterior ao Kanban). Gerencia execução concorrente com limites.

### 4.7 LlmModelService (`services/llmModelService.ts`)

Catálogo de modelos de IA disponíveis por provider (Gemini, OpenAI, OpenRouter).

### 4.8 AudioCompressService (`services/AudioCompressService.ts`)

Comprime áudio WAV → MP3 via FFmpeg nativo (Tauri invoke).

| Função | Descrição |
|--------|-----------|
| `checkFfmpegAvailable()` | Verifica FFmpeg instalado |
| `compressProjectAudio(projectId, onLog)` | Orquestra compressão completa |
| `getTempPath(filename)` | Caminho temporário dinâmico via Tauri |

### 4.9 ElevenLabsService (`services/ElevenLabsService.ts`)

Serviço dedicado para interação com a API da Eleven Labs.

| Método | Descrição |
|--------|-----------|
| `getVoices()` | Lista vozes disponíveis |
| `getModels()` | Lista modelos de IA (Turbo v2.5, Multilingual v2, etc.) |
| `getUserInfo()` | Obtém dados de assinatura e créditos restantes |
| `generateAudio(text, voiceId, modelId, settings)` | Gera áudio e retorna Blob |

### 4.10 GeminiService — TTS (`services/geminiService.ts`)

Função `generateSpeech` usa o modelo dedicado `gemini-2.5-flash-preview-tts`.

| Detalhe | Valor |
|---------|-------|
| Modelo | `gemini-2.5-flash-preview-tts` |
| Formato de saída | PCM raw (24kHz, 16-bit, mono) |
| Config | `responseModalities: ['AUDIO']`, `speechConfig.voiceConfig.prebuiltVoiceConfig` |
| Vozes disponíveis | 30 vozes (Zephyr, Puck, Kore, Charon, Fenrir, Aoede, etc.) |

### 4.11 RunwareService (`services/runwareService.ts`)

Serviço para geração de imagens via API RunWare (Flux.1 Schnell).

| Função | Descrição |
|--------|-----------|
| `generateImageRunware(prompt, width, height, numberResults, apiKey)` | Gera imagens via Flux.1 Schnell, retorna array de URLs |

| Detalhe | Valor |
|---------|-------|
| Modelo | `runware:100@1` (Flux.1 Schnell) |
| Steps | 4 (otimizado para velocidade) |
| Scheduler | `FlowMatchEulerDiscreteScheduler` |
| Formato de saída | JPEG via URL |
| CFGScale | 1 |

### 4.12 Image Providers — Arquitetura Escalável (`services/imageProviders.ts`)

Strategy Pattern + Registry para geração de imagens com múltiplos providers.

| Interface/Tipo | Descrição |
|----------------|-----------|
| `IImageProvider` | Contrato comum: `generate(prompt, w, h, count, apiKey, onLog?)` |
| `ImageModel` | Metadata: id, label, provider, apiKeyField, **providerGroup**, badge, description |
| `IMAGE_MODELS[]` | Registry central de modelos disponíveis |

**Providers implementados:**

| Provider | Modelo | API Key Field | providerGroup | Detalhes |
|----------|--------|---------------|---------------|----------|
| `RunwareProvider` | FLUX.1 Schnell | `flux` | RunWare | Delega para `runwareService.ts` |
| `NanoBananaRunwareProvider` | Gemini 2.5 Flash Image | `flux` | RunWare | RunWare proxy para google:4@2 |
| `IdeogramRunwareProvider` | Ideogram | `flux` | RunWare | RunWare proxy para ideogram:4@1 |
| `TogetherProvider` | FLUX.1 Schnell | `together` | Together.ai | API REST direta `api.together.xyz`, retorna b64_json |

**Funções auxiliares:**

| Função | Descrição |
|--------|-----------|
| `getImageProvider(modelId)` | Factory — retorna instância do provider correto |
| `getImageModel(modelId)` | Busca metadata do modelo no registry |
| `getImageModelsByGroup()` | Agrupa modelos por `providerGroup` para UI com `<optgroup>` |

**Para adicionar novo modelo:** (1) criar classe `implements IImageProvider`, (2) add ao `IMAGE_MODELS[]`, (3) registrar no switch de `getImageProvider()`.

**Segurança:** API keys são mascaradas nos logs via `maskGeminiKey()` — exibe apenas 5+3 caracteres.

### 4.13 Gemini Key Manager (`lib/geminiKeyManager.ts`)

Gerenciamento de múltiplas chaves Gemini com rotação automática.

| Função | Descrição |
|--------|-----------|
| `parseGeminiKeys(field)` | Separa chaves por `,`, `;` ou `\n` |
| `maskGeminiKey(key)` | Máscara para exibição segura |
| `isGeminiRetryableError(msg)` | Detecta erros de quota/rate limit (429, 403, etc.) |
| `withGeminiKeyRotation(field, fn)` | Tenta `fn` com cada chave; rota se erro retryable |

### ImageGeneratorPanel — Modal de Status (`components/ImageGeneratorPanel.tsx`)

| Feature | Detalhes |
|---------|----------|
| Modelos | Dropdown dinâmico via `IMAGE_MODELS` registry |
| Badge | Dinâmico (ex: "RunWare" / "Gemini") conforme modelo selecionado |
| Modal de Status | Exibe logs em tempo real: chave tentada, quota esgotada, sucesso/erro |
| Estados do Modal | `progress` (spinner + "Aguarde..."), `success` (verde), `error` (vermelho) |
| Layout fixo | Header + Logs (h-300px scroll) + Footer permanecem com tamanho constante |
| Callback `onLog` | Providers enviam logs para o modal via callback opcional |

### 4.14 StoryboardPlanner (`services/storyboardPlanner.ts`)

Serviço de inteligência visual para consolidação de cenas.

| Função | Descrição |
|--------|-----------|
| `planStoryboard(segments, profile, config)` | Agrupa segmentos adjacentes em cenas lógicas via LLM e gera `visualPrompt` único por cena. |

**Lógica de Negócio:**
- Agrupa segmentos que compartilham o mesmo contexto visual para economizar em geração de imagens e manter coesão.
- Gera prompts otimizados para modelos de imagem (Flux/Gemini).
- Permite que o usuário revise e edite os prompts no estágio `review` antes da geração real.

### 4.12 ReferenceService (`services/ReferenceService.ts`)

Fachada para busca de vídeos de referência e transcrição.

| Método | Descrição |
|--------|-----------|
| `fetchTopReferenceVideo(channelQuery, config)` | Busca o vídeo mais recente/relevante de um canal |
| `transcribeReference(videoId, config)` | Transcreve via APIFY (wrapper do apifyClient) |
| `log(jobId, message, level)` | Log auxiliar para o Supabase |

### 4.13 SystemMonitor (`services/SystemMonitor.ts`)

Simula telemetria de hardware (CPU, RAM, GPU, temperatura). Reage ao status dos jobs para simular picos de carga.

---

## 4.14 Componentes TTS — UI e Funcionalidades

### ElevenLabsPanel (`components/ElevenLabsPanel.tsx`)

Interface visual clone do ElevenLabs Studio 3.0.

| Feature | Detalhes |
|---------|----------|
| Vozes | Listagem dinâmica via API com busca, favoritos e categorias |
| Modelos | Seletor dinâmico (Turbo v2.5, Multilingual v2, Flash v2.5, etc.) |
| Settings | Stability, Similarity Boost, Style, Speaker Boost |
| Player | `<audio>` nativo com `controlsList="nodownload"` |
| Download | Diálogo nativo "Salvar como" via `tauri-plugin-dialog` → `write_file` |
| Créditos | Exibição em tempo real de caracteres restantes |

### GoogleTTSPanel (`components/GoogleTTSPanel.tsx`)

Interface dedicada para geração TTS via Google Gemini.

| Feature | Detalhes |
|---------|----------|
| Vozes | 30 vozes pré-configuradas com tags (narrative, news, promo, etc.) |
| Style Instructions | Campo para instruções de estilo/entonação |
| Pipeline de áudio | PCM raw → WAV header (`createWavFromPcm`) → FFmpeg WAV→MP3 (192kbps, 44100Hz, mono) |
| Fallback | Se FFmpeg falhar, usa WAV diretamente |
| Player | `<audio>` nativo com `controlsList="nodownload"` |
| Download | Diálogo nativo "Salvar como" via `tauri-plugin-dialog` → `write_file` |
| Favoritos | Persistência local via `localStorage` |

### ImageGeneratorPanel (`components/ImageGeneratorPanel.tsx`)

Interface dedicada para geração e edição de imagens.

| Feature | Detalhes |
|---------|----------|
| Prompt | Campo de texto livre para descrever a imagem desejada |
| Aspect Ratio | Seletor de proporção (16:9, 9:16) |
| Quantidade | Geração de 1 a 4 imagens por vez |
| Galeria | Grid de resultados com zoom, download e remoção (últimas 3 auto-carregadas do disco) |
| Auto-Save | Imagens geradas são salvas automaticamente em `Pictures/DarkVideoFactory/Generated/` |
| File Picker | Importar imagens do disco com conversão base64 otimizada (chunked O(n)) |
| Mini-Canva | Editor de thumbnails (`ThumbnailEditorModal`) com Fabric.js, textos, templates, fontes |
| Lazy Fonts | 5 fontes base carregam no startup; 40+ fontes restantes carregam sob demanda |
| Alinhamento | Snap magnético a centro do canvas e entre objetos (com `getBoundingRect()` cacheado) |
| Download | Diálogo nativo "Salvar como" via `tauri-plugin-dialog` → `write_file` |
| Preview | Lightbox com imagem em tela cheia ao clicar |
| Lógica de biblioteca | Extraída para hook `useImageLibrary` (carregamento, save, delete, file picker) |

### PromptDebugModal (`components/PromptDebugModal.tsx`)

Modal de debug visual de prompts antes do envio para a IA.

| Feature | Detalhes |
|---------|----------|
| Estágios | P1 (Reescrita Magnética) e P2 (Estruturação Viral) |
| Info exibidas | Modelo, Provider, tipo de prompt (custom/default), input length |
| Ações | System Prompt, User Prompt, botões Confirmar/Cancelar |
| Uso | Ativado pelo `PipelineExecutor.setPromptPreview()` |

---

## 5. Libs Utilitárias

| Arquivo | Responsabilidade |
|---------|-----------------|
| `lib/youtubeMock.ts` | `searchChannelVideos()` (YouTube API) + `transcribeVideo()` (APIFY wrapper) |
| `lib/apifyClient.ts` | `fetchYoutubeTranscriptFromApify()` — chama ator APIFY com **rotação de chaves**, failover automático, detecção de `error:true` e normalização snake_case→camelCase |
| `lib/audioUtils.ts` | `pcmToWav()` — converte PCM base64 → WAV. `getAudioDuration()` |
| `lib/supabase.ts` | `configureSupabase()`, `getSupabase()`, `isSupabaseConfigured()` |
| `lib/geminiKeyManager.ts` | **Rotação de chaves Gemini** — `withGeminiKeyRotation()`, `parseGeminiKeys()`, `isGeminiRetryableError()` |
| `lib/subtitleGenerator.ts` | Geração de legendas SRT |
| `lib/smartChunker.ts` | Chunking inteligente de texto |
| `lib/alignmentEngine.ts` | Alinhamento de texto/áudio |
| `lib/ffmpegGenerator.ts` | Comandos FFmpeg para renderização |

---

## 6. Tipos Principais

### VideoProject
```typescript
{
  id: string;              // UUID
  channelId: string;       // ID do perfil de canal
  title: string;
  currentStage: PipelineStage;
  status: ProjectStatus;   // 'waiting' | 'processing' | 'ready' | 'error' | 'review'
  stageData: StageDataMap; // Dados de cada estágio
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

### ReferenceStageData
```typescript
{
  videoId: string;
  videoUrl?: string;
  videoTitle: string;
  channelName: string;
  transcript?: string;
  thumbnailUrl?: string;
  description?: string;
  viewCount?: number;
  publishedAt?: string;
  duration?: string;
  apifyRawData?: Record<string, unknown>; // Resposta bruta completa do APIFY
  mode: 'auto' | 'manual';
}
```

### ChannelProfile
```typescript
{
  id: string;
  name: string;
  format: VideoFormat;        // SHORTS | LONG_FORM
  visualStyle: string;
  voiceProfile: string;       // Voice ID para TTS
  bgmTheme: string;
  subtitleStyle: SubtitleConfig;
  llmPersona: string;
  activePromptId?: string;
  scriptingModel?: string;    // ex: 'gemini-2.0-flash'
  scriptingProvider?: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
}
```

### EngineConfig
```typescript
{
  hostVolumePath: string;
  ffmpegContainerImage: string;
  maxConcurrentJobs: number;
  providers: {
    scripting: 'GEMINI' | 'OPENAI' | 'OPENROUTER';
    image: 'GEMINI' | 'FLUX';
    tts: 'GEMINI' | 'ELEVENLABS';
  };
  apiKeys: {
    gemini, youtube?, apify?, supabaseUrl?, supabaseKey?,
    elevenLabs, flux, openai, openrouter
  };
}
```

> **Nota:** A chave `flux` é usada tanto para o provider Flux legado quanto para a **RunWare API** (campo "Runware/Flux" no Settings).

---

## 7. Regras de Negócio

1.  **Filtro de views:** Só exibir vídeos com ≥ 500 views na busca (evita vídeos sem legendas)
2.  **Supabase é opcional:** Tudo funciona com localStorage. Supabase é configurável via Settings
3.  **Sem `process.env`:** Configs são dinâmicas via Settings UI
4.  **Áudio em IndexedDB:** Referências `idb://projectId` no `stageData.audio.fileUrl`
5.  **Pipeline P1+P2:** Roteiro passa por 2 prompts — Reescrita Magnética, depois Estruturação Viral
6.  **Validação de transcript:** Usa `trim()` e verifica length > 0 antes de aceitar
7.  **Review obrigatório:** Estágios REFERENCE e SCRIPT pausam em `status='review'` para aprovação humana
8.  **Batch processing:** Permite selecionar múltiplos projetos e processar/avançar em lote
9.  **Tratamento de Erros:** Erros no pipeline capturam o estágio e o stack trace. Projetos em erro podem ter o estágio "resetado" para `ready`.

---

## 8. Storage Map

| Dado | Storage | Chave/DB |
|------|---------|----------|
| Projetos | localStorage | `DARK_FACTORY_PROJECTS_V1` |
| Config (EngineConfig) | localStorage | via SettingsPanel |
| Perfils de canal | localStorage + Supabase | `DARK_CHANNELS_V1` |
| Prompts de canal | localStorage + Supabase | `DARK_CHANNEL_PROMPTS_V1` |
| Áudio binário (WAV) | **IndexedDB** | DB: `dark-factory-audio`, Store: `audio-files` |

---

## 9. APIs Externas

| API | Uso | Chave Config |
|-----|-----|-------------|
| YouTube Data API v3 | Busca de vídeos por canal | `apiKeys.youtube` |
| APIFY | Transcrição (`starvibe~youtube-video-transcript`) c/ **Rotação de Chaves + Failover** | `apiKeys.apify` (Multi-line) |
| Google Gemini | LLM (roteiros), TTS, Geração de imagens | `apiKeys.gemini` (Multi-line) |
| OpenAI | LLM alternativo (GPT-4o etc.) | `apiKeys.openai` |
| OpenRouter | LLM alternativo (Claude, Llama etc.) | `apiKeys.openrouter` |
| ElevenLabs | TTS alternativo | `apiKeys.elevenLabs` |
| **RunWare** | Geração de imagens (Flux.1 Schnell, Nano Banana, Ideogram) | `apiKeys.flux` |
| **Together.ai** | Geração de imagens (Flux.1 Schnell) | `apiKeys.together` |
| Supabase | Database + Auth (opcional) | `apiKeys.supabaseUrl` + `apiKeys.supabaseKey` |

---

## 10. UI — Barra de Ícones do Card (ProjectCard)

Cada `ProjectCard` exibe uma barra de ícones abaixo da data:

-   **Lixeira** 🗑️ — sempre presente (remove projeto do pipeline)
-   **Ícones de etapas concluídas** — acumulam da esquerda → direita
-   Cada ícone é clicável para abrir o `StageDetailsModal` com informações completas

Ícones por estágio:
| Estágio | Ícone | Cor |
|---------|-------|-----|
| Reference | BookOpen | emerald |
| Script | FileText | emerald |
| Audio | Mic | emerald |
| Audio Compress | Volume2 | emerald |
| Subtitles | Subtitles | emerald |
| Images | ImageIcon | emerald |
| Video | Film | emerald |
| Publish YT | Upload | emerald |
| Thumbnail | ImagePlus | emerald |
| Publish Thumb | Send | emerald |

---

## 11. Estrutura de Arquivos

```
Dark Video Factory/
├── src/
│   ├── App.tsx                    # Componente raiz (42KB)
│   ├── main.tsx                   # Entry point React
│   ├── index.css                  # Estilos globais
│   ├── types.ts                   # Tipos globais do pipeline
│   ├── types/
│   │   └── images.ts              # Tipo GeneratedImage compartilhado
│   ├── components/                # 24 componentes React
│   ├── services/                  # 12 serviços
│   ├── lib/                       # 9 libs utilitárias
│   └── hooks/                     # 2 hooks (useJobMonitor, useImageLibrary)
├── src-tauri/                     # Backend Rust (Tauri v2)
├── GEMINI.md                      # Regras do projeto para IA
├── docs/
│   └── PRD.md                     # ← ESTE DOCUMENTO
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 12. Esquema de Banco de Dados (Supabase)

Tabelas essenciais para funcionamento híbrido (Local + Cloud).

### Tabela `profiles`
- `id` (uuid, PK)
- `name` (text)
- `active_prompt_id` (uuid, FK -> channel_prompts.id)
- ... (outros campos de config do canal)

### Tabela `channel_prompts`
Armazena histórico de versões dos prompts de cada canal.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `profile_id` | uuid | FK -> profiles.id |
| `prompt_text` | text | **P1** - Prompt de Reescrita Magnética |
| `structure_prompt_text` | text | **P2** - Prompt de Estruturação Viral |
| `is_active` | boolean | Se é a versão atual do canal |
| `created_at` | timestamp | Data de criação da versão |

### Tabela `jobs`
- `id` (uuid, PK)
- `applied_prompt_id` (uuid, FK -> channel_prompts.id) - Rastreabilidade de qual prompt gerou este vídeo.

### Tabela `video_projects`
Armazena o estado completo de cada projeto para persistência em nuvem.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `channel_id` | uuid | FK -> profiles.id |
| `title` | text | Título do projeto |
| `current_stage` | text | Estágio atual do pipeline |
| `status` | text | Status do estágio (waiting, review, etc.) |
| `stage_data` | jsonb | Dados de todos os estágios (inclui transcript, apifyRawData, refs de áudio) |
| `errorMessage` | text | Mensagem de erro se houver |
| `created_at` | timestamp | Data de criação |
| `updated_at` | timestamp | Última modificação |

---

## 13. Changelog

| Data | Alteração |
|------|-----------|
| 2026-02-14 | Documento criado com scan completo da codebase |
| 2026-02-14 | Pipeline de áudio/IndexedDB e filtro de views implementados |
| 2026-02-15 | Estágio AUDIO_COMPRESS (FFmpeg) e comandos Rust nativos |
| 2026-02-15 | **Persistência V2**: Tabelas Supabase para Prompts e Projetos (`video_projects`) |
| 2026-02-15 | **APIFY Full Capture**: Armazenamento da resposta bruta do scraper no `stage_data` |
| 2026-02-15 | **Sincronização Global**: Configuração automática do cliente Supabase no `App.tsx` |
| 2026-02-15 | **Stage Details UI**: Implementado `StageDetailsModal` para visualização profunda de Referência e Roteiro |
| 2026-02-15 | **YouTube Preview**: Criado `VideoPlayerModal` para preview de vídeos dentro do app e correção de links via `opener` |
| 2026-02-15 | **Fix Channel Name**: Corrigido bug de "Canal Desconhecido" capturando `channelTitle` real na busca |
| 2026-02-15 | **AI Model Expansion**: Suporte total a OpenAI (o1, o3-mini, GPT-4o) e OpenRouter com seletores dinâmicos |
| 2026-02-15 | **Robust Error Handling**: Criado `ErrorDetailModal` com exibição de logs detalhados e função de Reset Stage |
| 2026-02-15 | **Multi-Key Apify**: Implementado suporte a múltiplas chaves com rotação, failover automático e diagnóstico de quota no Settings |
| 2026-02-16 | **Eleven Labs Integration**: Interface visual clone do Studio 3.0, geração de áudio, validação de créditos, download robusto e layout em cards independentes |
| 2026-02-16 | **Google TTS Panel**: Interface dedicada para Gemini TTS (`gemini-2.5-flash-preview-tts`), 30 vozes, style instructions, pipeline PCM→WAV→MP3 via FFmpeg |
| 2026-02-16 | **Native Save Dialog**: Instalado `tauri-plugin-dialog` para diálogo nativo "Salvar como" no download de áudio (ElevenLabs + Google TTS) |
| 2026-02-16 | **Tauri Commands**: Adicionados `get_downloads_dir`, registrado `tauri_plugin_dialog`, permissão `dialog:default` nas capabilities |
| 2026-02-16 | **Image Generator (RunWare)**: Criado `ImageGeneratorPanel` + `runwareService` para geração de imagens via Flux.1 Schnell (modelo `runware:100@1`), galeria com lightbox, download nativo |
| 2026-02-16 | **Prompt Debug Modal**: Criado `PromptDebugModal` para preview visual dos prompts P1/P2 antes do envio para a IA, integrado ao `PipelineExecutor.setPromptPreview()` |
| 2026-02-16 | **Gemini Key Rotation**: Criado `geminiKeyManager.ts` para rotação automática de múltiplas chaves Gemini com detecção de erros retryable (429, quota, rate limit) |
| 2026-02-17 | **APIFY Error Fix**: Corrigida detecção de erro no `apifyClient.ts` — agora verifica `result.error === true`. Normalização de snake_case → camelCase. |
| 2026-02-17 | **Image Providers Expansion**: Adicionado suporte a **Ideogram** (`ideogram:4@1`) e migrado **Nano Banana** para RunWare (`google:4@2`) devido a quotas da API Gemini. Implementado `providerSettings` dinâmico e `dimension snapping` para ambos. |
| 2026-02-17 | **Image Providers Architecture**: Strategy Pattern + Registry (`imageProviders.ts`) para múltiplos providers de imagem (RunWare FLUX.1 + NanoBanana Gemini). Rotação automática de chaves Gemini (`geminiKeyManager.ts`). Modal de status com logs em tempo real. |
| 2026-02-17 | **Global Status Modal**: Extraído modal de status para `StatusModalContext.tsx` (Context + Provider + Hook). Renderizado uma vez no `App.tsx`, qualquer componente usa `useStatusModal()` para abrir/logar/fechar. API: `open()`, `log()`, `success()`, `error()`, `close()`. |
| 2026-02-19 | **Mini-Canva Editor**: Implementado `ThumbnailEditorModal` com Fabric.js — editor visual de thumbnails com textos, templates, Google Fonts (40+), alinhamento magnético, e save/export |
| 2026-02-19 | **Auto-Save & Image Library**: Imagens geradas são salvas automaticamente no disco. Galeria carrega últimas 3 imagens salvas no startup. File picker para importar imagens externas com conversão base64 chunked (O(n)) |
| 2026-02-19 | **Revisão Técnica (12 melhorias)**: (Alta) Persist edits, base64 O(n), remove shell permissions, mask API keys, remove orphaned permission. (Média) Shared `GeneratedImage` type, remove thinking comments, replace `alert()` → `status.error()`. (Baixa) Extract `useImageLibrary` hook, lazy Google Fonts, cache `getBoundingRect()`, remove empty ResizeObserver |
| 2026-02-19 | **Security Hardening**: Removidas permissões `shell:allow-execute/spawn/stdin-write` e `opener:allow-reveal-item-in-dir` do `default.json`. API keys mascaradas nos logs via `maskGeminiKey()` |
| 2026-02-20 | **Estágio 5 — Legendas**: Implementado `processSubtitlesStage` no `PipelineExecutor`. Integra `smartChunker` (divide em chunks 9-18s), `alignmentEngine` (alinha c/ duração do áudio) e `subtitleGenerator` (gera .ass estilizado). `SubtitlesStageData` expandido com `segments`, `assContent`, `segmentCount`, `totalDuration`. Visualização no `StageDetailsModal` com tabela de segmentos e preview ASS colapsável |
| 2026-02-21 | **Estágio 6 — Imagens & Storyboard**: Implementado agrupamento de cenas via `storyboardPlanner` (LLM). Geração de imagens agora suporta **multi-select** no Storyboard. Adicionado **Interpretador de Erros via IA** (`interpretErrorWithAI`) usando DeepSeek/OpenRouter para diagnósticos assertivos. Refinamentos de UI: zoom/lightbox no Storyboard, overlay "CRIANDO...", e limpeza nos botões de geração. |
| 2026-03-01 | **Together.ai Provider**: Adicionado `TogetherProvider` para geração de imagens FLUX.1 Schnell via API REST Together.ai (`api.together.xyz`). Seletor de modelos reorganizado com `<optgroup>` agrupado por provider (RunWare, Together.ai). Adicionado campo `providerGroup` ao `ImageModel`. Nova API key `together` no `EngineConfig`. |
| 2026-03-01 | **Travas de Segurança (Geração de Imagens)**: Implementadas 3 proteções no `handleGenerateImages` do `StageDetailsModal.tsx`: (1) **Anti double-click** via `isGeneratingRef` com liberação no `finally`, (2) **Confirmação de substituição** com `window.confirm` se já existem imagens geradas, (3) **Modo Teste** (DESATIVADO) — constante `TEST_MODE_MAX_IMAGES` permanece no código como referência, basta descomentar o bloco para reativar o limite. **Evolução futura**: geração paralela em batches de 5 para ganho de performance sem causar rate limit. |
| 2026-03-02 | **Estágio 7 — Vídeo Final**: Implementado `processVideoStage` no `PipelineExecutor`. Criado `VideoRenderService.ts` — orquestra exportação de assets (MP3 + .ass + imagens por cena) para temp, gera concat file, executa FFmpeg nativo (H.264 CRF20 + AAC 192k), salva MP4 em `Videos/DarkVideoFactory/`. Reescrito `ffmpegGenerator.ts` com funções nativas (`buildConcatFileContent`, `buildRenderArgs`). UI no `StageDetailsModal` com player `<video>` via `convertFileSrc`. Capabilities Tauri expandidas com `$VIDEO` e `$TEMP`. |

## 14. Inteligência e Otimização

O sistema conta com camadas de IA para diagnóstico e redução de custos:

- **Interpretador de Erros (IA Diagnostics)**:
    - **Modelo**: `deepseek/deepseek-chat` (OpenRouter)
    - **Tom de voz**: Assertivo, direto e com autoridade.
    - **Funcionamento**: Transforma logs técnicos em instruções claras para o usuário.
  
- **Consolidação de Cenas**: 
    - **Lógica**: Agrupa segmentos de legenda via `sceneId` no storyboard.
    - **Economia**: Gera apenas uma imagem por cena e a replica, reduzindo drasticamente as chamadas de API (aplica-se a todos os providers: RunWare, Together.ai, etc.).
