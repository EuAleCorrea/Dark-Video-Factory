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
