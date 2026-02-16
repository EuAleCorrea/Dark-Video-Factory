# Dark Video Factory — PRD (Product Requirements Document)

> **Última atualização:** 2026-02-16 17:34
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
| Imagens | Google Gemini Imagen, Flux |
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
├── BatchActionBar.tsx — Barra de ações em lote (processar, deletar)
├── PreviewPlayer.tsx — Player de preview de vídeo
├── Storyboard.tsx — Visualização de segmentos do storyboard
├── JobQueue.tsx — Fila de jobs (sistema legado)
├── Terminal.tsx — Log de terminal
├── SystemHealth.tsx — Status do sistema
├── AssetBrowser.tsx — Navegador de assets
├── DistributionPanel.tsx — Painel de distribuição
└── ElevenLabsPanel.tsx — Interface dedicada para geração de áudio (Clone Visual Studio 3.0)
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
| 5 | **Legendas** | `SUBTITLES` | Gerar SRT a partir do áudio | 🔜 Não implementado |
| 6 | **Imagens** | `IMAGES` | Gerar imagens por segmento via IA | 🔜 Não implementado |
| 7 | **Vídeo** | `VIDEO` | Renderizar vídeo com FFmpeg | 🔜 Não implementado |
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

CRUD de projetos com persistência em localStorage + Supabase (opcional).

| Método | Descrição |
|--------|-----------|
| `createProject(channelId, title, stageData?)` | Cria projeto novo |
| `loadProjects(channelId?)` | Carrega todos os projetos |
| `updateProject(id, updates)` | Atualiza campos do projeto |
| `advanceStage(project, stageData)` | Move para próximo estágio |
| `deleteProject(id)` | Remove projeto |
| `saveLocal(project)` | Persiste em localStorage |
| `loadLocal(channelId?)` | Lê do localStorage (com sanitização) |

**Regras de negócio:**
- Sanitiza data URLs > 100KB do áudio → substitui por `idb://projectId`
- try/catch para `QuotaExceededError` no localStorage

### 4.2 PipelineExecutor (`services/PipelineExecutor.ts`)

Orquestra o processamento automático de cada estágio. Possui captura enriquecida de erros (Stack Trace/JSON).

| Método | Descrição |
|--------|-----------|
| `processProject(project)` | Entry point: roteia para o handler do estágio atual |
| `processReferenceStage(project, config)` | Transcreve via APIFY, valida transcript |
| `processScriptStage(project, profile, config)` | Executa P1 (Reescrita) + P2 (Estruturação) |
| `processAudioStage(project, profile, config)` | Gera TTS, converte PCM→WAV, salva IndexedDB |

**Dependências injetadas:** `ProjectService`, `PersistenceService`, `getConfig()`, `getProfile()`

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

---

## 5. Libs Utilitárias

| Arquivo | Responsabilidade |
|---------|-----------------|
| `lib/youtubeMock.ts` | `searchChannelVideos()` (YouTube API) + `transcribeVideo()` (APIFY wrapper) |
| `lib/apifyClient.ts` | `fetchYoutubeTranscriptFromApify()` — chama ator APIFY com **rotação de chaves**, failover automático e retry |
| `lib/audioUtils.ts` | `pcmToWav()` — converte PCM base64 → WAV. `getAudioDuration()` |
| `lib/supabase.ts` | `configureSupabase()`, `getSupabase()`, `isSupabaseConfigured()` |
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
| Google Gemini | LLM (roteiros), TTS, Geração de imagens | `apiKeys.gemini` |
| OpenAI | LLM alternativo (GPT-4o etc.) | `apiKeys.openai` |
| OpenRouter | LLM alternativo (Claude, Llama etc.) | `apiKeys.openrouter` |
| ElevenLabs | TTS alternativo | `apiKeys.elevenLabs` |
| Flux | Geração de imagens alternativa | `apiKeys.flux` |
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
│   ├── types.ts                   # Todos os tipos e interfaces
│   ├── components/                # 17 componentes React
│   ├── services/                  # 9 serviços
│   ├── lib/                       # 8 libs utilitárias
│   └── hooks/                     # 1 hook (useJobMonitor)
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
