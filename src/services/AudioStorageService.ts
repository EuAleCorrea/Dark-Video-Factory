/**
 * AudioStorageService — IndexedDB para armazenar áudio binário
 * Resolve o limite de ~5MB do localStorage para dados de áudio.
 */

const DB_NAME = 'DarkVideoFactory_Audio';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

/** Salva áudio binário (Uint8Array WAV) no IndexedDB com a chave = projectId */
export async function saveAudio(projectId: string, wavData: Uint8Array): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(wavData, projectId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Carrega áudio do IndexedDB e retorna como Blob URL reproduzível */
export async function loadAudioBlobUrl(projectId: string): Promise<string | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(projectId);
        request.onsuccess = () => {
            const data = request.result as Uint8Array | undefined;
            if (!data) return resolve(null);
            const blob = new Blob([data.buffer as ArrayBuffer], { type: 'audio/wav' });
            resolve(URL.createObjectURL(blob));
        };
        request.onerror = () => reject(request.error);
    });
}

/** Carrega áudio raw do IndexedDB como Uint8Array (sem converter para Blob) */
export async function loadAudioRaw(projectId: string): Promise<Uint8Array | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(projectId);
        request.onsuccess = () => {
            const data = request.result as Uint8Array | undefined;
            resolve(data ?? null);
        };
        request.onerror = () => reject(request.error);
    });
}

/** Remove áudio do IndexedDB */
export async function deleteAudio(projectId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(projectId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
