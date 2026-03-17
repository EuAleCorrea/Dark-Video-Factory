# Dark Video Factory — Roadmap: Editor Visual Completo

> **Objetivo**: Transformar o app de sidebar-based para um editor CapCut-like com pipeline integrado, em micro-fases atômicas. Cada micro-fase é independente, testável e pequena o suficiente para ser implementada por qualquer agente IA com poucos tokens.

> **Convenções**: ✅ = Concluído | 🔲 = Pendente | Cada fase lista: Objetivo, Arquivos, Dependências e Critério de "Pronto"

> **Branch**: `feature/editor-fullstack` (base: `Desktop_Video_Factory`)

---

## ✅ FASE 0 — Infraestrutura do Editor (CONCLUÍDA)

Sprint 0: Banco de dados, persistência, tipos globais do editor (Track, Clip), EditorPersistenceService, integração Supabase.

---

## ✅ FASE 1 — Sistema de Temas (CONCLUÍDA)

Sprint 1: ThemeContext, Dark/Light mode, migração de toda a UI para variáveis CSS (`--df-*`), persistência de preferências.

---

## ✅ FASE 2 — Layout do Editor (CONCLUÍDA)

Criação do layout 4 painéis redimensionáveis (MediaLibrary, Preview, Properties, Timeline) + integração como tab "Editor Visual" na sidebar. CSS `.editor-panel` e `.editor-resize-handle` tema-aware.

---

## 🔲 FASE 3 — Reestruturação do Header e Navegação

**Meta**: Trocar sidebar lateral por tab bar horizontal. O editor vira a view principal.

### 3.1 — Simplificar Header

> **Objetivo**: Remover métricas (CPU/GPU/RAM/Temp) do header principal. Manter: logo, nome do projeto, theme toggle, botão config.
>
> **Arquivos**:
> - `MODIFY` `App.tsx` — Remover seções de métricas do header, adicionar campo de nome do projeto
>
> **Dependências**: Nenhuma
>
> **Pronto quando**: Header mostra `[Logo] [Nome do Projeto] [☀/🌙] [⚙]` sem barras de CPU/GPU/RAM. App compila e funciona.

---

### 3.2 — Criar Tab Bar Horizontal

> **Objetivo**: Criar componente `EditorTabBar.tsx` — barra de tabs horizontal que substitui a sidebar como navegação principal.
>
> **Arquivos**:
> - `NEW` `components/editor/EditorTabBar.tsx` — Barra horizontal com ícones+labels. Tabs: Workflow, Mídia, Áudio, Texto, Imagens, Efeitos. Recebe `activeTab` e `onTabChange` como props.
>
> **Dependências**: Nenhuma
>
> **Pronto quando**: Componente renderiza uma barra horizontal clicável. Não precisa estar integrado no app ainda.

---

### 3.3 — Criar EditorShell (Container Principal)

> **Objetivo**: Criar `EditorShell.tsx` — layout que combina Header simplificado + Tab Bar + 4 painéis (esquerda muda baseado na tab ativa, preview/props/timeline ficam fixos).
>
> **Arquivos**:
> - `NEW` `components/editor/EditorShell.tsx` — Importa `EditorTabBar`, `PreviewPanel`, `PropertiesPanel`, `TimelinePanel`. Renderiza o painel esquerdo conforme a tab ativa. Por agora, todas as tabs mostram o `MediaLibraryPanel` como placeholder.
>
> **Dependências**: 3.2
>
> **Pronto quando**: `EditorShell` renderiza o layout completo com tab bar funcional (mesmo que todas mostrem o mesmo conteúdo).

---

### 3.4 — Substituir VideoEditor por EditorShell

> **Objetivo**: Trocar o `VideoEditor.tsx` atual pelo novo `EditorShell`. O `VideoEditor` passa a ser apenas uma re-exportação do `EditorShell`.
>
> **Arquivos**:
> - `MODIFY` `components/editor/VideoEditor.tsx` — Importa e re-exporta `EditorShell` (mantém compatibilidade com `App.tsx`)
> - `MODIFY` `App.tsx` — Nenhuma mudança necessária se mantiver a re-exportação
>
> **Dependências**: 3.3
>
> **Pronto quando**: Clicar "Editor Visual" na sidebar abre o novo layout com tab bar horizontal.

---

### 3.5 — Migrar Sidebar para Tab Bar

> **Objetivo**: Transformar sidebar lateral em uma barra colapsada de ícones (apenas Pipeline Legado, Dashboard, Perfis) + a tab bar horizontal como navegação principal para as ferramentas.
>
> **Arquivos**:
> - `MODIFY` `App.tsx` — Reduzir sidebar para mini-sidebar com ícones colapsados (Pipeline, Dashboard, Perfis). Remover itens que vão para a tab bar do editor (Gerador de Imagens, Pexels, Áudio, etc.)
>
> **Dependências**: 3.4
>
> **Pronto quando**: Sidebar mostra apenas ícones de Pipeline/Dashboard/Perfis. Ferramentas são acessadas via tab bar horizontal dentro do editor.

---

## 🔲 FASE 4 — Migração de Features para Tabs do Editor

**Meta**: Mover as features existentes (ElevenLabs, Google TTS, Image Generator, Pexels, Extract Audio) para dentro dos painéis do editor.

### 4.1 — Criar AudioToolsPanel

> **Objetivo**: Criar painel que agrupa todas as ferramentas de áudio em sub-tabs.
>
> **Arquivos**:
> - `NEW` `components/editor/AudioToolsPanel.tsx` — Sub-tabs: "Google TTS" | "ElevenLabs" | "Extrair Áudio". Cada sub-tab renderiza o componente existente (`GoogleTTSPanel`, `ElevenLabsPanel`, `ExtractAudioPanel`), passando as props necessárias.
>
> **Dependências**: 3.3
>
> **Pronto quando**: Tab "Áudio" na tab bar mostra as 3 ferramentas em sub-tabs. Funcionalidade idêntica à versão standalone.

---

### 4.2 — Criar ImageToolsPanel

> **Objetivo**: Criar painel que agrupa geração de imagens e galeria.
>
> **Arquivos**:
> - `NEW` `components/editor/ImageToolsPanel.tsx` — Sub-tabs: "Gerar" | "Galeria". "Gerar" renderiza o `ImageGeneratorPanel` existente. "Galeria" mostra imagens já geradas no projeto.
>
> **Dependências**: 3.3
>
> **Pronto quando**: Tab "Imagens" mostra o gerador de imagens funcional.

---

### 4.3 — Integrar Pexels na Tab Mídia

> **Objetivo**: Adicionar Pexels como sub-tab dentro do `MediaLibraryPanel`.
>
> **Arquivos**:
> - `MODIFY` `components/editor/MediaLibraryPanel.tsx` — Sub-tab "Pexels" renderiza o `PexelsHub` existente dentro do painel esquerdo do editor.
>
> **Dependências**: 3.3
>
> **Pronto quando**: Tab "Mídia" → sub-tab "Pexels" funciona igual ao Pexels Hub standalone.

---

### 4.4 — Criar TextToolsPanel

> **Objetivo**: Criar painel de ferramentas de texto/legendas.
>
> **Arquivos**:
> - `NEW` `components/editor/TextToolsPanel.tsx` — Lista de legendas editáveis. Por agora, mostra placeholder "Gere legendas na aba Workflow". Será expandido quando a timeline funcional estiver pronta.
>
> **Dependências**: 3.3
>
> **Pronto quando**: Tab "Texto" mostra UI de edição de legendas (mesmo que placeholder).

---

### 4.5 — Wiring: Conectar Tabs ao EditorShell

> **Objetivo**: Conectar todos os painéis criados (4.1–4.4) à lógica de troca de tabs do EditorShell.
>
> **Arquivos**:
> - `MODIFY` `components/editor/EditorShell.tsx` — Importar e renderizar `AudioToolsPanel`, `ImageToolsPanel`, `TextToolsPanel`, `MediaLibraryPanel` baseado na tab ativa.
>
> **Dependências**: 4.1, 4.2, 4.3, 4.4
>
> **Pronto quando**: Cada tab na barra horizontal mostra seu painel correto no lado esquerdo. Preview/Properties/Timeline permanecem fixos.

---

### 4.6 — Migrar Settings para Modal/Dialog

> **Objetivo**: Transformar Settings em um modal acessível pelo ícone ⚙ no header, em vez de ser uma tab na sidebar.
>
> **Arquivos**:
> - `MODIFY` `App.tsx` — Botão ⚙ abre modal com `SettingsPanel` (overlay) em vez de trocar de tab.
>
> **Dependências**: 3.5
>
> **Pronto quando**: Clicar ⚙ abre settings como modal sobreposta, sem sair da view atual.

---

## 🔲 FASE 5 — Workflow Panel (Pipeline Integrado ao Editor)

**Meta**: Criar o painel de Workflow com as etapas do pipeline como accordions colapsáveis.

### 5.1 — WorkflowPanel (Estrutura + UI)

> **Objetivo**: Criar container com 6 steps colapsáveis (Referência, Roteiro, Áudio, Legendas, Imagens, Exportar). Cada step mostra apenas o header com status (🔲/⏳/✅/❌). O conteúdo interno é placeholder por enquanto.
>
> **Arquivos**:
> - `NEW` `components/editor/WorkflowPanel.tsx` — Container com 6 `WorkflowStep` colapsáveis
> - `NEW` `components/editor/WorkflowStep.tsx` — Componente genérico: header clicável + conteúdo expandível + status badge
>
> **Dependências**: 3.3
>
> **Pronto quando**: Tab "Workflow" mostra 6 steps colapsáveis com headers e badges de status. Expandir mostra placeholder.

---

### 5.2 — Step Referência (Busca + Transcrição)

> **Objetivo**: Implementar o conteúdo do step "Referência" — campo de busca por canal YouTube, lista de vídeos, botão de transcrição APIFY.
>
> **Arquivos**:
> - `NEW` `components/editor/steps/ReferenceStep.tsx` — Input de URL/Canal → busca via `searchChannelVideos()` → lista de resultados → botão "Transcrever" → exibe transcript. Reutiliza lógica do `VideoSelectorModal` e `apifyClient`.
> - `MODIFY` `components/editor/WorkflowPanel.tsx` — Renderiza `ReferenceStep` dentro do step 1.
>
> **Dependências**: 5.1
>
> **Pronto quando**: Buscar canal → selecionar vídeo → transcrever via APIFY funciona dentro do editor. Transcript exibida e editável.

---

### 5.3 — Step Roteiro (Reescrita IA)

> **Objetivo**: Implementar o step "Roteiro" — mostra transcript, permite reescrita P1+P2, exibe resultado editável.
>
> **Arquivos**:
> - `NEW` `components/editor/steps/ScriptStep.tsx` — Exibe transcript vinda do step 1. Seletor de modelo/provider. Botão "Reescrever com IA". Reutiliza `geminiService.rewriteTranscript()` + `structureScript()`. Resultado editável em textarea.
> - `MODIFY` `components/editor/WorkflowPanel.tsx` — Renderiza `ScriptStep` dentro do step 2.
>
> **Dependências**: 5.2
>
> **Pronto quando**: Reescrever transcript com P1+P2, resultado exibido e editável. Preview de prompts funciona.

---

### 5.4 — Step Áudio (TTS + Auto-Place Timeline)

> **Objetivo**: Implementar o step "Áudio" — seletor de voz, geração TTS, e auto-colocação do áudio na track de áudio da timeline.
>
> **Arquivos**:
> - `NEW` `components/editor/steps/AudioStep.tsx` — Seletor de provider (Gemini/ElevenLabs), seletor de voz, botão "Gerar Narração". Reutiliza `geminiService.generateSpeech()` e `ElevenLabsService`. Após gerar, chama callback para criar clip na timeline.
> - `MODIFY` `components/editor/WorkflowPanel.tsx` — Renderiza `AudioStep` dentro do step 3. Passa callback de `onAudioGenerated(audioData)` que cria clip na track de áudio.
>
> **Dependências**: 5.3, Fase 6 (Timeline Engine) — **pode ser implementado em paralelo**, a auto-colocação na timeline pode ser adicionada depois.
>
> **Pronto quando**: Gerar áudio TTS funciona dentro do editor + áudio é reproduzível no preview.

---

### 5.5 — Step Legendas (Geração + Auto-Place Timeline)

> **Objetivo**: Implementar o step "Legendas" — gera segmentos do roteiro + timing do áudio, coloca na timeline.
>
> **Arquivos**:
> - `NEW` `components/editor/steps/SubtitlesStep.tsx` — Botão "Gerar Legendas". Reutiliza `smartChunker`, `alignmentEngine`, `subtitleGenerator`. Mostra lista de segmentos editáveis (texto, start, end). Callback para criar clips na track de legendas.
> - `MODIFY` `components/editor/WorkflowPanel.tsx` — Renderiza `SubtitlesStep` dentro do step 4.
>
> **Dependências**: 5.4
>
> **Pronto quando**: Segmentos gerados e exibidos como lista editável.

---

### 5.6 — Step Imagens (Planejamento + Geração + Auto-Place)

> **Objetivo**: Implementar o step "Imagens" — agrupa segmentos em cenas, gera imagens, coloca na timeline.
>
> **Arquivos**:
> - `NEW` `components/editor/steps/ImagesStep.tsx` — Botão "Planejar Cenas" (reutiliza `storyboardPlanner`). Preview de cenas com prompt editável. Seletor de provider de imagem (RunWare/Together/Gemini). Botão "Gerar Imagens" (reutiliza `imageProviders`). Callback para criar clips na track de vídeo.
> - `MODIFY` `components/editor/WorkflowPanel.tsx` — Renderiza `ImagesStep` dentro do step 5.
>
> **Dependências**: 5.5
>
> **Pronto quando**: Planejamento de cenas + geração de imagens funciona dentro do editor.

---

### 5.7 — Step Exportar (Render FFmpeg)

> **Objetivo**: Implementar o step "Exportar" — configuração de saída + render.
>
> **Arquivos**:
> - `NEW` `components/editor/steps/ExportStep.tsx` — Seletores de resolução (1080p landscape/portrait), FPS, formato. Barra de progresso. Botão "Renderizar". Reutiliza `VideoRenderService` e `ffmpegGenerator`. Gera comandos FFmpeg a partir do estado da timeline.
> - `MODIFY` `components/editor/WorkflowPanel.tsx` — Renderiza `ExportStep` dentro do step 6.
>
> **Dependências**: 5.6, Fase 6 (Timeline funcional)
>
> **Pronto quando**: Exportar vídeo a partir do editor funciona.

---

## 🔲 FASE 6 — Timeline Engine (Lógica Funcional)

**Meta**: A timeline deixa de ser placeholder e ganha lógica real de manipulação de clips.

### 6.1 — TimelineEngineService (Core)

> **Objetivo**: Criar serviço para manipulação lógica da timeline (CRUD de clips, snapping, cálculo de duração).
>
> **Arquivos**:
> - `NEW` `services/TimelineEngineService.ts` — Funções puras: `addClip()`, `removeClip()`, `moveClip()`, `resizeClip()`, `splitClip()`, `getTimelineDuration()`, `snapToGrid()`.
>
> **Dependências**: Nenhuma (lógica pura)
>
> **Pronto quando**: Funções exportadas e testáveis. Sem dependência de UI.

---

### 6.2 — Integrar Engine no TimelinePanel

> **Objetivo**: Conectar o `TimelineEngineService` ao `TimelinePanel` — clips visuais reagindo ao estado.
>
> **Arquivos**:
> - `MODIFY` `components/editor/TimelinePanel.tsx` — Renderizar clips reais (retângulos coloridos com duração proporcional). Estado dos clips controlado via `TimelineEngineService`.
>
> **Dependências**: 6.1
>
> **Pronto quando**: Clips adicionados via código aparecem visualmente nas tracks com tamanho proporcional.

---

### 6.3 — Drag-and-Drop de Clips

> **Objetivo**: Permitir arrastar clips na timeline (reposicionar horizontalmente).
>
> **Arquivos**:
> - `MODIFY` `components/editor/TimelinePanel.tsx` — Mouse handlers para drag horizontal de clips. Snapping ao grid/outros clips.
>
> **Dependências**: 6.2
>
> **Pronto quando**: Arrastar um clip horizontalmente muda sua posição na timeline.

---

### 6.4 — Resize e Split de Clips

> **Objetivo**: Arrastar bordas de clips para redimensionar (trim). Cortar clip em dois no ponto do playhead.
>
> **Arquivos**:
> - `MODIFY` `components/editor/TimelinePanel.tsx` — Handles nas bordas L/R dos clips. Botão Split usa posição do playhead.
>
> **Dependências**: 6.3
>
> **Pronto quando**: Redimensionar e cortar clips funciona.

---

### 6.5 — Drag da Media Library para Timeline

> **Objetivo**: Arrastar itens do painel de mídia e soltar numa track da timeline.
>
> **Arquivos**:
> - `MODIFY` `components/editor/MediaLibraryPanel.tsx` — Itens draggables.
> - `MODIFY` `components/editor/TimelinePanel.tsx` — Drop zone nas tracks.
>
> **Dependências**: 6.2
>
> **Pronto quando**: Arrastar imagem/áudio do painel esquerdo para a timeline cria um clip.

---

## 🔲 FASE 7 — Preview Player Funcional

**Meta**: Preview mostra composição real (imagem + legenda no tempo correto).

### 7.1 — Canvas Compositor

> **Objetivo**: Preview renderiza no canvas: imagem de fundo da cena ativa + legenda sobreposta.
>
> **Arquivos**:
> - `MODIFY` `components/editor/PreviewPanel.tsx` — Canvas 2D renderiza imagem do clip de vídeo ativo no tempo do playhead + texto do clip de legenda ativo.
>
> **Dependências**: 6.2
>
> **Pronto quando**: Mover o playhead na timeline muda a imagem e legenda exibidas no preview.

---

### 7.2 — Playback (Play/Pause/Seek)

> **Objetivo**: Botões de transporte funcionais. Play avança playhead em tempo real; áudio sincronizado.
>
> **Arquivos**:
> - `MODIFY` `components/editor/PreviewPanel.tsx` — `requestAnimationFrame` loop para avanço do playhead. Web Audio API para sync de áudio.
> - `MODIFY` `components/editor/TimelinePanel.tsx` — Playhead animado durante play.
>
> **Dependências**: 7.1
>
> **Pronto quando**: Clicar Play reproduz o vídeo preview (imagem + legenda + áudio) sincronizado com a timeline.

---

## 🔲 FASE 8 — Multi-Projeto

**Meta**: Suporte a múltiplos projetos de editor abertos como tabs.

### 8.1 — Tabs de Projeto no Header

> **Objetivo**: Barra de tabs no header para projetos abertos (estilo abas do navegador).
>
> **Arquivos**:
> - `NEW` `components/editor/ProjectTabs.tsx` — Tabs com nome do projeto, botão fechar, botão "+"
> - `MODIFY` `components/editor/EditorShell.tsx` — Gerenciar array de projetos abertos, mostrar `ProjectTabs`.
>
> **Dependências**: 3.3
>
> **Pronto quando**: Abrir/fechar múltiplos projetos funciona. Mudar de aba carrega o projeto correspondente.

---

### 8.2 — Gerenciamento de Projetos

> **Objetivo**: Novo projeto, abrir existente, salvar, salvar como.
>
> **Arquivos**:
> - `MODIFY` `components/editor/EditorShell.tsx` — Menu "Arquivo" ou botões: Novo, Abrir, Salvar. Usa `EditorPersistenceService` para carregar/salvar.
>
> **Dependências**: 8.1
>
> **Pronto quando**: Criar, salvar e reabrir projetos de editor funciona.

---

## 🔲 FASE 9 — Cleanup e Transição Final

**Meta**: Editor vira a view padrão. Sidebar removida. Pipeline Kanban disponível como "legado".

### 9.1 — Pipeline Kanban como "Legado"

> **Objetivo**: Mover Pipeline Kanban para item "Pipeline Legado" acessível via menu no header ou tab extra.
>
> **Arquivos**:
> - `MODIFY` `App.tsx` — Pipeline acessível via botão no header ou menu dropdown, não mais como tab lateral.
>
> **Dependências**: 4.6
>
> **Pronto quando**: Pipeline Kanban acessível, mas não é a view padrão.

---

### 9.2 — Editor como View Padrão

> **Objetivo**: App abre diretamente no editor. `activeTab` default = `video-editor`.
>
> **Arquivos**:
> - `MODIFY` `App.tsx` — Estado inicial de `activeTab` = `'video-editor'`.
>
> **Dependências**: 9.1
>
> **Pronto quando**: Ao abrir o app, o editor visual aparece como tela principal.

---

### 9.3 — Remover Sidebar Lateral

> **Objetivo**: Remover completamente a sidebar lateral. Toda navegação está no header/tab bar.
>
> **Arquivos**:
> - `MODIFY` `App.tsx` — Remover componente `<aside>` e todo código de sidebar.
> - Limpar CSS e imports não utilizados.
>
> **Dependências**: 9.2 (só fazer após tudo funcionar sem sidebar)
>
> **Pronto quando**: Sidebar removida. App ocupa 100% da largura. Zero referências a sidebar no código.

---

## Resumo de Fases

| Fase | Nome | Steps | Depende de |
|------|------|-------|-----------|
| ✅ 0 | Infraestrutura do Editor | — | — |
| ✅ 1 | Sistema de Temas | — | — |
| ✅ 2 | Layout do Editor | 4 | — |
| 🔲 3 | Header e Tab Bar | 5 | Fase 2 |
| 🔲 4 | Migração de Features | 6 | Fase 3 |
| 🔲 5 | Workflow (Pipeline no Editor) | 7 | Fase 3 |
| 🔲 6 | Timeline Engine | 5 | Fase 2 |
| 🔲 7 | Preview Funcional | 2 | Fase 6 |
| 🔲 8 | Multi-Projeto | 2 | Fase 3 |
| 🔲 9 | Cleanup Final | 3 | Fases 4-8 |

**Total: 34 micro-steps pendentes**

### Ordem de execução recomendada

```
Fase 3 (3.1→3.2→3.3→3.4→3.5)      ← Primeiro: nova navegação
  ↓
Fase 4 (4.1→4.2→4.3→4.4→4.5→4.6)  ← Migra features
Fase 5 (5.1→5.2→5.3→5.4→5.5→5.6→5.7) ← Pipeline no editor
  ↓ (podem rodar em paralelo ↕)
Fase 6 (6.1→6.2→6.3→6.4→6.5)      ← Timeline funcional
  ↓
Fase 7 (7.1→7.2)                    ← Preview real
Fase 8 (8.1→8.2)                    ← Multi-projeto
  ↓
Fase 9 (9.1→9.2→9.3)                ← Limpeza
```

> [!IMPORTANT]
> **Fases 4, 5 e 6 podem ser desenvolvidas em paralelo** por agentes diferentes, desde que a Fase 3 esteja concluída. A Fase 6 não depende da 4 ou 5.
