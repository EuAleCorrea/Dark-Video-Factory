# Dark Video Factory — PRD (Product Requirements Document) — Versão V1.0

> **Última atualização:** 2026-03-17 19:10
> **Status:** Versão 1.0 (Editor Visual Centric) Estável
> **Consulta obrigatória:** Este documento define a especificação técnica atual do projeto.

---

## 1. Visão Geral (V1.0)

**Dark Video Factory** evoluiu de um pipeline Kanban sequencial para uma plataforma de **Editor de Vídeo Visual (tipo CapCut)** com inteligência artificial generativa integrada. A aplicação é focada na criação automatizada e semi-automatizada de vídeos para canais "dark" (YouTube/TikTok), permitindo que o usuário orquestre desde a pesquisa de nicho até a renderização final em uma única interface.

### Stack Técnico Final (V1.0)

| Camada | Tecnologia |
|--------|------------|
| Runtime Desktop | **Tauri v2** (Rust backend + Plugins) |
| Frontend | **React 18 + Vite** |
| Styling | **Tailwind CSS v4** |
| State | **React State/Context** (EditorShell como orquestrador) |
| Storage | **Híbrido**: Disco Local (JSON-on-Disk) + Supabase Sync |
| Timeline Engine | **Custom TypeScript Service** (Lógica de tracks, clips e snapping) |
| Renderização | **FFmpeg Nativo** (Tauri Sidebar Invoke) |
| IA de Voz | **Google Gemini TTS (flash-preview)** + **ElevenLabs** |
| IA de Imagem | **RunWare (Flux.1)** + **Together.ai** + **Gemini Imagen** |
| IA de Roteiro | **Gemini 2.0 Flash/Pro**, OpenAI, OpenRouter |

---

## 2. Nova Arquitetura de Interface

O sistema abandonou a navegação por sidebar lateral em favor de um **Header Unificado** e um layout focado no conteúdo.

### 2.1 EditorShell (O Coração da V1)
O `EditorShell.tsx` é agora o container principal. Ele gerencia:
- **ProjectTabs**: Sistema de abas para múltiplos projetos abertos.
- **EditorTabBar**: Barra horizontal superior para troca de contextos (Mídia, Áudio, Imagens, Texto, Workflow).
- **Undo/Redo System**: Histórico independente por projeto (CTRL+Z / CTRL+Y).
- **Auto-Save**: Persistência reativa no disco local.

### 2.2 Estrutura de Painéis (4-Quadrant Layout)
1.  **Painel Esquerdo (Ferramentas)**: Dinâmico conforme a tab selecionada (MediaLibrary, Workflow, AudioTools, etc.).
2.  **Painel Central (Preview)**: Canvas real que renderiza a composição (Imagem + Texto) e controla o tempo (Play/Pause).
3.  **Painel Direito (Propriedades)**: Edição de parâmetros do clip selecionado na timeline.
4.  **Painel Inferior (Timeline)**: Gestão de 3+ tracks (Vídeo, Áudio, Legendas) com suporte a drag-and-drop.

---

## 3. Workflow Integrado (Pipeline 2.0)

O antigo Kanban foi integrado diretamente no editor via aba **"Workflow"**. O pipeline consiste em:

1.  **Referência**: Busca de vídeos no YouTube + transcrição via APIFY.
2.  **Roteiro**: Reescrita do transcript em 2 fases (P1 Reescrita + P2 Estruturação Viral).
3.  **Áudio**: Geração de narração (Gemini ou ElevenLabs) com inserção automática na track de áudio.
4.  **Legendas**: Geração de storyboard (9-18s) + legendas ASS com inserção na track de texto.
5.  **Imagens**: Geração em lote para cada cena do storyboard com inserção na track de vídeo.
6.  **Exportação**: Renderização final via FFmpeg em formato Vertical (9:16) ou Horizontal (16:9).

---

## 4. Persistência e Dados

### 4.1 Local File System (`/data`)
- `projects/{id}/project.json`: Estado completo do projeto do editor.
- `projects/{id}/assets/`: Mídias (áudio, imagens) baixadas ou geradas.
- `preferences.json`: Chaves de API, tema, e caminhos configurados.

### 4.2 Supabase (Sincronização)
- Tabela `editor_projects`: Backup em nuvem do JSON do projeto.
- Tabela `profiles`: Canais e prompts customizados.
- Tabela `user_preferences`: Sincronização de configurações entre dispositivos.

---

## 5. Serviços Principais (V1.0)

| Serviço | Responsabilidade |
|---------|-----------------|
| `TimelineEngineService` | CRUD de clips, cálculo de tempos, snapping e splits. |
| `EditorPersistenceService` | Interface de I/O para projetos e preferências (Disco + Cloud). |
| `VideoRenderService` | Preparação de manifest FFmpeg e disparo da renderização nativa. |
| `PipelineExecutor` | Orquestração IA (Transcrição → Roteiro → Assets). |
| `geminiService` | Ponte para modelos Google (LLM + TTS + Imagen). |
| `imageProviders` | Strategy pattern para RunWare, Together e Gemini. |

---

## 6. Regras de Projeto (V1.0)

1.  **NUNCA** usar cores hardcoded; sempre utilizar variáveis CSS do `index.css` (`--df-bg-primary`, etc.).
2.  **Supabase** deve ser tratado como opcional; o modo "Local" deve ser funcional sem internet.
3.  **Editor-Centric**: Qualquer nova feature deve ser pensada para ser integrada a uma aba do editor ou um painel lateral do mesmo.
4.  **Performance**: Clips de mídia pesada devem ser carregados sob demanda e usar o path do Tauri File System.
5.  **Segurança**: Chaves de API são mascaradas nos logs e salvas de forma segura no disco local.

---

## 7. Legado

O **Kanban Board** clássico ainda está disponível na aba "Legado" da barra de navegação principal para quem prefere a visão de gestão massiva de projetos, mas o desenvolvimento oficial agora foca 100% no Editor Visual.
