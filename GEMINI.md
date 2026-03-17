---
trigger: always_on
---

# Dark Video Factory - Regras do Projeto

## 📦 Git

| Informação | Valor |
|------------|-------|
| **Remote** | `DarkVideoFactory` |
| **Repositório** | `https://github.com/EuAleCorrea/Dark-Video-Factory.git` |
| **Branch Oficial** | `Desktop_Video_Factory` |
| **Tipo de App** | Tauri Desktop (não mais web/Next.js) |

### Push
```powershell
git push DarkVideoFactory Desktop_Video_Factory
```

## 🛠️ Stack

| Camada | Tecnologia |
|--------|------------|
| Desktop Runtime | Tauri v2 |
| Frontend | React + Vite |
| Styling | Tailwind CSS v4 |
| Backend Rust | src-tauri/ |
| Database/Auth | Supabase (configuração dinâmica) |
| AI | Google Gemini API |

## 🚀 Comandos

| Ação | Comando |
|------|---------|
| Dev | `npx tauri dev` |
| Build | `npx tauri build` |
| Vite only | `npm run dev` |
| Type check | `npx tsc --noEmit` |

## ⚠️ Regras Importantes

1. **SEM `process.env`** — Todas as configs são dinâmicas via Settings UI
2. **Supabase dinâmico** — Usar `configureSupabase(url, key)` de `@/lib/supabase`
3. **Guard no Supabase** — Sempre usar `isSupabaseConfigured()` antes de chamar Supabase
4. **`.gitignore`** — `src-tauri/target/` nunca deve ser commitado
5. **Restart Automático** — Sempre que uma implementação for aplicada, matar todos os processos abertos do app (`dark-video-tauri`, `*Dark Video Factory*`) e subir o novo (`npx tauri dev`) imediatamente, sem necessidade de monitorar o processo no terminal. Faça e solte a aplicação.
6. **Tema e CSS** — NUNCA usar cores hardcoded (ex: `bg-white`, `text-black`). Usar variáveis de tema do `index.css` (ex: `bg-theme-primary`, `text-theme-primary`, `border-theme`).
7. **Persistência do Editor** — Usar `EditorPersistenceService` para carregar/salvar preferências e projetos do editor visual.
8. **Dark Mode** — Todo novo componente deve ser testado em Dark e Light mode. Usar o `useTheme()` para lógica condicional se necessário.

## 📋 PRD — Documentação Técnica Obrigatória

> 🔴 **REGRA OBRIGATÓRIA:** Antes de QUALQUER implementação, leia `docs/PRD.md`.
> Este documento contém a arquitetura completa, pipeline, serviços, tipos, APIs e regras de negócio.
> **NÃO pesquise o código do zero** — consulte o PRD primeiro para entender a estrutura existente.
> Após implementações significativas, **atualize o PRD** com as mudanças feitas.

- **Caminho:** `docs/PRD.md`
- **Conteúdo:** Arquitetura, Pipeline Kanban (10 estágios), Serviços, Tipos, APIs externas, Storage map, Regras de negócio
- **Quando consultar:** Sempre, antes de qualquer código novo
- **Quando atualizar:** Após adicionar novos componentes, serviços, estágios ou regras

## 📂 Caminhos de Referência

| Recurso | Caminho |
|---------|---------|
| **CapCut Drafts** | `C:\Users\aless\OneDrive\Área de Trabalho\Canais Dark\Rascunhos\CapCut Drafts` |
| **Áudios TTS (CapCut)** | `{CapCut Drafts}\{pasta}\textReading\` (arquivos .wav individuais) |
| **Áudio Composto (CapCut)** | `{CapCut Drafts}\{pasta}\Resources\combination\` (arquivos .aac) |
