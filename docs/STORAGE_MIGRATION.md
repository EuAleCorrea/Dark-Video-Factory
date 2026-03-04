# Migração de Storage: localStorage → JSON em Disco

> **Status:** ✅ Implementado  
> **Solução Escolhida:** Alternativa B (JSON em Disco)  
> **Implementado em:** 2026-03-04

## Problema Resolvido

O Dark Video Factory usava `localStorage` e `IndexedDB` para persistir dados localmente — isso causava:
- QuotaExceededError com muitos projetos ou imagens base64
- Perda de dados no HMR durante desenvolvimento
- Performance ruim com JSON.parse de payloads grandes

## Solução Implementada

### Arquitetura Final

```
$APPDATA/DarkVideoFactory/              ← Pasta de dados da app (cross-platform)
├── config.json                         ← API keys, configurações do engine
├── profiles.json                       ← Perfis de canal
├── migration_flag.json                 ← Flag de migração concluída
├── preferences/
│   ├── elevenlabs_favorites.json       ← Vozes favoritas ElevenLabs
│   ├── google_tts_favorites.json       ← Vozes favoritas Google TTS
│   └── thumbnail_templates.json        ← Templates de thumbnail personalizados
└── projects/
    └── {projectId}/
        ├── project.json                ← Metadados + stageData completo
        ├── audio.wav                   ← Áudio bruto (TTS)
        └── audio_compressed.mp3        ← Áudio comprimido (FFmpeg)
```

### Serviços Implementados

| Serviço | Função |
|---------|--------|
| `DiskStorageService.ts` | Core — abstrai leitura/escrita de JSON e binários no disco via Tauri |
| `MigrationService.ts` | Migração automática de localStorage → disco (1x no boot) |

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `lib.rs` | +4 comandos Tauri (`get_appdata_dir`, `list_dir_entries`, `delete_dir_cmd`, `file_exists`) |
| `default.json` | Escopo `$APPDATA` adicionado às capabilities |
| `ProjectService.ts` | localStorage → `DiskStorage.writeJson/readJson` |
| `AudioStorageService.ts` | IndexedDB → `DiskStorage.writeBinary/readBinary` |
| `PersistenceService.ts` | Perfis + config em disco |
| `App.tsx` | `runMigration()` no boot, remoção de `STORAGE_KEY_CONFIG` |
| `ElevenLabsPanel.tsx` | Favoritos → `preferences/elevenlabs_favorites.json` |
| `GoogleTTSPanel.tsx` | Favoritos → `preferences/google_tts_favorites.json` |
| `ThumbnailEditorModal.tsx` | Templates → `preferences/thumbnail_templates.json` |
| `ImageDiskService.ts` | Removida função morta `sanitizeSegmentImagesForStorage` |

### Migração Automática

O `MigrationService.ts` executa **uma única vez** no boot da aplicação:
1. Verifica flag `migration_flag.json` no disco
2. Migra config, perfis, projetos, favoritos e templates do localStorage
3. Limpa as chaves do localStorage após migração bem-sucedida
4. Marca flag como `done: true`

---

## Alternativa A: SQLite (Não Implementada)

> Documentada aqui para referência futura, caso a escala exija (>100 projetos).

Usaria `tauri-plugin-sql` para armazenar projetos em banco SQLite (`dark_factory.db`).
Vantagens: queries complexas, escalabilidade para milhares de projetos, transações ACID.
Custo: dependência extra de plugin Rust, ORM ou queries manuais.
