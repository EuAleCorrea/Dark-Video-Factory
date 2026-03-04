/**
 * MigrationService — Migra dados do localStorage e IndexedDB para disco
 * 
 * Executado uma única vez no boot da aplicação.
 * Após migração bem-sucedida, limpa os dados antigos.
 */
import * as DiskStorage from './DiskStorageService';
import type { ChannelProfile, EngineConfig } from '../types';

const MIGRATION_FLAG = 'DARK_FACTORY_MIGRATED_TO_DISK_V1';

/**
 * Checa se a migração já foi feita.
 * Usamos um flag no próprio disco para evitar re-execução.
 */
async function isMigrated(): Promise<boolean> {
    try {
        const flag = await DiskStorage.readJson<{ done: boolean }>('migration_flag.json');
        return flag?.done === true;
    } catch {
        return false;
    }
}

/**
 * Marca a migração como concluída no disco.
 */
async function markMigrated(): Promise<void> {
    await DiskStorage.writeJson('migration_flag.json', {
        done: true,
        migratedAt: new Date().toISOString(),
        version: 1
    });
}

/**
 * Migra Config do localStorage → disco
 */
async function migrateConfig(): Promise<void> {
    // Já existe config no disco? Não sobrescrever.
    const existing = await DiskStorage.readJson<EngineConfig>('config.json');
    if (existing) {
        console.log('[Migration] config.json já existe no disco, pulando.');
        return;
    }

    const raw = localStorage.getItem('DARK_FACTORY_CONFIG_V1_BACKUP')
        || localStorage.getItem('DARK_FACTORY_CONFIG_V1');
    if (raw) {
        try {
            const config = JSON.parse(raw);
            await DiskStorage.writeJson('config.json', config);
            console.log('[Migration] ✅ Config migrado para disco.');
        } catch (e) {
            console.error('[Migration] ❌ Erro ao migrar config:', e);
        }
    }
}

/**
 * Migra Perfis do localStorage → disco
 */
async function migrateProfiles(): Promise<void> {
    const existing = await DiskStorage.readJson<ChannelProfile[]>('profiles.json');
    if (existing && existing.length > 0) {
        console.log('[Migration] profiles.json já existe no disco, pulando.');
        return;
    }

    const raw = localStorage.getItem('DARK_FACTORY_PROFILES_V1');
    if (raw) {
        try {
            const profiles = JSON.parse(raw);
            await DiskStorage.writeJson('profiles.json', profiles);
            console.log(`[Migration] ✅ ${profiles.length} perfis migrados para disco.`);
        } catch (e) {
            console.error('[Migration] ❌ Erro ao migrar perfis:', e);
        }
    }
}

/**
 * Migra favoritos do ElevenLabs
 */
async function migrateElevenLabsFavorites(): Promise<void> {
    const raw = localStorage.getItem('elevenlabs_favorites');
    if (raw) {
        try {
            const existing = await DiskStorage.readJson<string[]>('preferences/elevenlabs_favorites.json');
            if (existing && existing.length > 0) return;

            const favorites = JSON.parse(raw);
            await DiskStorage.writeJson('preferences/elevenlabs_favorites.json', favorites);
            console.log('[Migration] ✅ Favoritos ElevenLabs migrados.');
        } catch (e) {
            console.error('[Migration] ❌ Erro favoritos ElevenLabs:', e);
        }
    }
}

/**
 * Migra favoritos do Google TTS
 */
async function migrateGoogleTTSFavorites(): Promise<void> {
    const raw = localStorage.getItem('google_tts_favorites');
    if (raw) {
        try {
            const existing = await DiskStorage.readJson<string[]>('preferences/google_tts_favorites.json');
            if (existing && existing.length > 0) return;

            const favorites = JSON.parse(raw);
            await DiskStorage.writeJson('preferences/google_tts_favorites.json', favorites);
            console.log('[Migration] ✅ Favoritos Google TTS migrados.');
        } catch (e) {
            console.error('[Migration] ❌ Erro favoritos Google TTS:', e);
        }
    }
}

/**
 * Migra templates de thumbnail
 */
async function migrateThumbnailTemplates(): Promise<void> {
    const raw = localStorage.getItem('thumbnail_templates');
    if (raw) {
        try {
            const existing = await DiskStorage.readJson<any[]>('preferences/thumbnail_templates.json');
            if (existing && existing.length > 0) return;

            const templates = JSON.parse(raw);
            await DiskStorage.writeJson('preferences/thumbnail_templates.json', templates);
            console.log('[Migration] ✅ Templates de thumbnail migrados.');
        } catch (e) {
            console.error('[Migration] ❌ Erro templates thumbnail:', e);
        }
    }
}

/**
 * Migra projetos do localStorage → disco
 * Os projetos eram armazenados como DARK_FACTORY_PROJECTS_V1
 */
async function migrateProjects(): Promise<void> {
    const raw = localStorage.getItem('DARK_FACTORY_PROJECTS_V1');
    if (!raw) return;

    try {
        const projects = JSON.parse(raw);
        if (!Array.isArray(projects) || projects.length === 0) return;

        let migrated = 0;
        for (const project of projects) {
            if (!project.id) continue;

            // Verifica se já existe no disco
            const existingPath = `projects/${project.id}/project.json`;
            const existing = await DiskStorage.readJson(existingPath);
            if (existing) continue;

            await DiskStorage.writeJson(existingPath, project);
            migrated++;
        }

        console.log(`[Migration] ✅ ${migrated}/${projects.length} projetos migrados para disco.`);
    } catch (e) {
        console.error('[Migration] ❌ Erro ao migrar projetos:', e);
    }
}

/**
 * Limpa dados antigos do localStorage após migração bem-sucedida.
 * Não remove TUDO — apenas as chaves que migramos.
 */
function cleanupLocalStorage(): void {
    const keysToRemove = [
        'DARK_FACTORY_CONFIG_V1',
        'DARK_FACTORY_CONFIG_V1_BACKUP',
        'DARK_FACTORY_PROFILES_V1',
        'DARK_FACTORY_PROJECTS_V1',
        'elevenlabs_favorites',
        'google_tts_favorites',
        'thumbnail_templates',
    ];

    for (const key of keysToRemove) {
        if (localStorage.getItem(key) !== null) {
            localStorage.removeItem(key);
            console.log(`[Migration] 🧹 localStorage.${key} removido.`);
        }
    }
}

/**
 * Executa a migração completa.
 * Deve ser chamado no boot da aplicação (App.tsx useEffect).
 */
export async function runMigration(): Promise<void> {
    try {
        // 1. Verificar se já migrou
        if (await isMigrated()) {
            console.log('[Migration] Migração já realizada, pulando.');
            return;
        }

        console.log('[Migration] 🚀 Iniciando migração localStorage → disco...');

        // 2. Migrar cada tipo de dado
        await migrateConfig();
        await migrateProfiles();
        await migrateProjects();
        await migrateElevenLabsFavorites();
        await migrateGoogleTTSFavorites();
        await migrateThumbnailTemplates();

        // 3. Limpar dados antigos
        cleanupLocalStorage();

        // 4. Marcar como migrado
        await markMigrated();

        console.log('[Migration] ✅ Migração concluída com sucesso!');
    } catch (e) {
        console.error('[Migration] ❌ Erro fatal na migração:', e);
        // Não marca como migrado se falhou — tenta novamente no próximo boot
    }
}
