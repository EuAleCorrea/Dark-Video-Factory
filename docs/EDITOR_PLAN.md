# Dark Video Factory — Editor Visual (CapCut-Like)

## Fase 0: Análise e Planejamento
- [x] Analisar PRD e codebase completa
- [x] Formular perguntas estratégicas
- [x] Receber respostas do usuário
- [x] Criar auditoria completa (elementos vs status)
- [x] Sprint 0: Infraestrutura do Editor Visual & Persistência Híbrida
- [x] Sprint 1: Dark Mode Completo & Tematização Dinâmica
- [x] Atualizar PRD.md e GEMINI.md com as novas regras e estrutura
- [x] Sprint 2: Motor da Timeline (Lógica e Modelagem)
- [x] Obter aprovação do plano

## Sprint 0: Banco de Dados e Persistência
- [x] Migration Supabase: criar tabela `user_preferences`
- [x] Migration Supabase: criar tabela `editor_projects`
- [x] Criar `types/editor.ts` (tipos do editor)
- [x] Criar `EditorPersistenceService.ts` (dual-storage)
- [x] Expandir `DiskStorageService.ts` (diretórios editor/preferences)
- [x] Verificar compilação

## Sprint 1: Sistema de Temas (Dark/Light)
- [x] Criar ThemeContext + Provider
- [x] Definir variáveis CSS para dark/light
- [x] Criar toggle de tema no header
- [x] Migrar componentes existentes para usar variáveis de tema
- [x] Verificar compilação e visual
- [x] Sincronizar com Git (Commit/Push)

## Fase 2: Layout do Editor Visual
- [x] Criar novo componente `VideoEditor.tsx` (container principal)
- [x] Layout 4 painéis: Media Library (esq), Preview (centro), Properties (dir), Timeline (baixo)
- [x] Integrar como nova tab no App.tsx
- [x] Resizable panels (drag para redimensionar)

## Fase 3: Timeline Engine
- [ ] Criar `TimelineEngine.ts` (modelo de dados: tracks, clips, markers)
- [ ] Criar `Timeline.tsx` (componente visual)
- [ ] Track de Imagens/Vídeo (visual track)
- [ ] Track de Áudio (waveform)
- [ ] Track de Legendas
- [ ] Playhead + seek + zoom
- [ ] Drag and drop de clipes
- [ ] Corte/split de clipes

## Fase 4: Preview Player (upgrade)
- [ ] Composição canvas-based (imagem + legenda sincronizada)
- [ ] Sincronização com timeline (playhead → canvas)
- [ ] Play/Pause/Seek controlado pela timeline
- [ ] Renderização em tempo real de transições

## Fase 5: Biblioteca de Mídia (Media Panel)
- [ ] Importar arquivos locais (imagens, vídeos, áudio)
- [ ] Integração com Pexels (reusar PexelsHub)
- [ ] Integração com gerador de imagens IA (reusar ImageGeneratorPanel)
- [ ] Drag from library → timeline

## Fase 6: Transições e Efeitos
- [ ] Transições entre clipes (crossfade, fade, dissolve, wipe)
- [ ] Efeitos visuais básicos (zoom, pan, brightness/contrast)
- [ ] Preview de transições em tempo real

## Fase 7: Exportação via FFmpeg
- [ ] Converter timeline state → FFmpeg commands
- [ ] Exportação assíncrona com barra de progresso
- [ ] Suporte a 1080p landscape + portrait (shorts)

## Fase 8: Estágios Pendentes (Pipeline)
- [ ] Estágio 8: Publicar no YouTube (YouTube Data API upload)
- [ ] Estágio 9: Thumbnail (geração IA)
- [ ] Estágio 10: Publicar Thumbnail

## Fase 9: Integração Pipeline ↔ Editor
- [ ] Abrir projeto no editor a partir do Kanban
- [ ] Carregar assets do pipeline (imagens, áudio, legendas) no editor
- [ ] Salvar edições de volta no projeto
