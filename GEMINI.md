---
trigger: always_on
---

# Dark Video Factory - Regras Master (V1.0)

## 📦 Git & Branching

| Informação | Valor |
|------------|-------|
| **Remote** | `DarkVideoFactory` |
| **Branch Oficial** | `Desktop_Video_Factory` |
| **Commit Rule** | Mensagens de commit em inglês: `feat:`, `fix:`, `refactor:`. |

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Runtime | **Tauri v2** (Desktop Nativo) |
| Frontend | **React 18 + Vite** |
| Styling | **Tailwind CSS v4** + Variáveis CSS (`index.css`) |
| Backend | Rust (para comandos nativos e renderização) |
| State | `EditorShell` Context + Hooks Customizados |
| Storage | Local Disk (`PROJECT_DIR/data/`) + Supabase Sync |

## 🚀 Comandos de Operação

- **Dev Mode**: `npx tauri dev`
- **Build**: `npx tauri build`
- **Lint/Check**: `npx tsc --noEmit`

## ⚠️ Regras Cruciais (Seguimento Obrigatório)

1.  **NO SIDEBAR**: A sidebar lateral antiga foi removida. Toda navegação ocorre no **Header** e no **EditorTabBar**. Novo componente deve ser integrado a uma das abas do editor ou em painéis laterais.
2.  **EDITOR-CENTRIC**: O `EditorShell` é a view principal. Qualquer modificação no fluxo de trabalho deve respeitar a estrutura de clips, tracks e playhead.
3.  **STYLING SEM HARDCODE**: Proibido `bg-white`, `text-slate-900`, etc. Use **SEMPRE** `bg-theme-primary`, `text-theme-primary`, `border-theme`.
4.  **RESTART AUTOMÁTICO**: Ao aplicar mudanças no código, mate os processos (`dark-video-tauri`) e reinicie o servidor imediatamente via `npx tauri dev`.
5.  **PERSISTÊNCIA HÍBRIDA**: Use `EditorPersistenceService` para qualquer dado que precise ser salvo. Ele gerencia o salvamento local em disco e o sync com Supabase.
6.  **UNDO/REDO (CTRL+Z)**: Qualquer mudança no estado do projeto dentro do editor DEVE ser disparada via `handleProjectUpdate` para garantir o histórico de desfazer/refazer.
7.  **MULTI-PROJECT**: O app suporta abas de projeto. Use o `activeProjectId` para garantir que as operações afetem o projeto correto.

## 📋 Documentação Obrigatória (Consultar antes de codar)

-   **PRD Central**: `docs/PRD.md` (Contém a especificação técnica de cada módulo).
-   **Roadmap Final**: `docs/EDITOR_PLAN.md` (Histórico das fases concluídas).
-   **User Guide**: `docs/USER_GUIDE.md` (Para entender o fluxo de uso da V1).

## 📂 Pastas Críticas

-   `/src/components/editor/`: Componentes da nova interface visual.
-   `/src/services/`: Toda a lógica pesada (IA, Render, Persistence, Engine).
-   `/src-tauri/`: Backend Rust (comandos de disco e FFmpeg).
-   `/data/`: (Criada em runtime) Onde os projetos reais são salvos (.json).
