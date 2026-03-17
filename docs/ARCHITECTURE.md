# Arquitetura Técnica — Dark Video Factory V1.0

Este documento descreve a organização interna do código e o fluxo de dados do editor visual.

---

## 1. O Modelo de Dados do Editor

O estado de um projeto do editor é definido em `src/types.ts` e gerenciado pelo `EditorShell.tsx`.

### 1.1 Entidades Principais
- **Clip**: A unidade básica de conteúdo (Vídeo, Imagem, Áudio, Texto). Possui `id`, `trackId`, `startTime`, `duration`, e `content` (ex: URL da imagem ou texto da legenda).
- **Track**: Uma raia horizontal na timeline. Atualmente suportamos:
    - `video`: Para imagens/vídeos de fundo.
    - `audio`: Para narração TTS ou trilha sonora.
    - `text`: Para legendas ou sobreposições de texto.

---

## 2. Separação de Responsabilidades (UI vs Engine)

### 2.1 TimelineEngineService (Lógica Pura)
Para manter o código testável e performático, toda a manipulação matemática da timeline está concentrada no `TimelineEngineService.ts`.
- **Snapping**: Cálculo de atração magnética entre clips e playhead.
- **Duração Automática**: Ajuste de clips de texto conforme a duração do áudio.
- **Validação de Sobreposição**: Impede que clips da mesma track ocupem o mesmo espaço de tempo (em desenvolvimento progressivo).

### 2.2 EditorShell (Gestão de Estado)
O `EditorShell` funciona como um "Contexto Pai" que orquestra:
- **Project Swapping**: Quando o usuário troca de aba, o `EditorShell` salva o projeto anterior e carrega o novo do objeto `projects` em memória.
- **Undo/Redo History**: Mantém um `historyMapRef` (um array de estados por `projectId`) e um `indexMapRef`.
- **Global Shortcuts**: Captura `CTRL+Z`, `CTRL+Y`, `CTRL+S` (Salvar) e `Space` (Play/Pause).

---

## 3. Fluxo de Persistência (EditorPersistenceService)

A aplicação usa um modelo de **Persistência Reativa**:

1.  **Mudança**: O usuário arrasta um clip ou gera um áudio.
2.  **Dispatcher**: O evento chama `handleProjectUpdate`.
3.  **Histórico**: O novo estado é adicionado ao Undo Stack do projeto ativo.
4.  **Auto-Save**: O `EditorPersistenceService.saveEditorProject()` é chamado de forma otimizada (debounced) para escrever o JSON no disco local.
5.  **Cloud Sync**: Se o Supabase estiver configurado, o JSON é enviado para a tabela `editor_projects`.

---

## 4. Renderização (VideoRenderService)

O processo de exportação transforma o estado reativo em um arquivo de mídia binário:

1.  **Manifest Generation**: O `VideoRenderService` percorre a timeline e gera uma lista de comandos FFmpeg (filtros, concatenações).
2.  **Asset Export**: Todas as imagens e áudios necessários são garantidos no disco local (cache).
3.  **Tauri Command**: O frontend chama `invoke("process_ffmpeg", { args })`.
4.  **FFmpeg Worker**: O backend Rust dispara o binário FFmpeg nativo do sistema e retorna logs de progresso para a UI via eventos Tauri.

---

## 5. Extensibilidade

Para adicionar uma nova ferramenta (ex: Filtros de Efeito):
1.  Criar um novo painel em `src/components/editor/Tools/`.
2.  Adicionar uma nova tab no `EditorTabBar`.
3.  Registrar o componente no `EditorShell` para exibição lateral.
4.  Utilizar as props de `projects` e `onUpdate` passadas pelo `EditorShell`.
