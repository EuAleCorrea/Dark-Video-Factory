import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _url: string = '';
let _key: string = '';

export function configureSupabase(url: string, key: string): void {
    _url = url;
    _key = key;
    _supabase = null;
}

export function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase;

    if (!_url || !_key) {
        throw new Error('Supabase não configurado. Configure as chaves em Settings.');
    }

    _supabase = createClient(_url, _key);
    return _supabase;
}

export function isSupabaseConfigured(): boolean {
    return !!_url && !!_key;
}

export const supabase = new Proxy({} as SupabaseClient, {
    get(_, prop) {
        return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
    }
});
