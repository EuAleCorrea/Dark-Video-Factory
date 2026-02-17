/**
 * STATUS MODAL — Sistema Global de Logs de Execução
 * 
 * Context + Provider + Hook + Modal UI reutilizável.
 * Qualquer componente pode chamar useStatusModal() para controlar o modal.
 * 
 * Uso:
 *   const status = useStatusModal();
 *   status.open('Gerando imagens via Gemini...');
 *   status.log('🔑 Tentando chave 1/3...');
 *   status.log('⚠️ Quota esgotada, tentando próxima...');
 *   status.success('Geração concluída!');   // ou status.error('Falha na geração');
 *   // Usuário clica "Fechar" para dispensar
 */

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';

// =============================================
// TYPES
// =============================================

type StatusType = 'progress' | 'success' | 'error';

interface StatusModalState {
    open: boolean;
    type: StatusType;
    title: string;
    logs: string[];
}

interface StatusModalAPI {
    /** Abre o modal com título e estado progress */
    open: (title: string) => void;
    /** Adiciona uma linha de log ao modal */
    log: (msg: string) => void;
    /** Marca como sucesso (verde) com título opcional */
    success: (title?: string) => void;
    /** Marca como erro (vermelho) com mensagem de erro */
    error: (errorMsg: string, title?: string) => void;
    /** Fecha o modal */
    close: () => void;
    /** Estado atual do modal (para leitura externa) */
    state: StatusModalState;
}

const initialState: StatusModalState = {
    open: false,
    type: 'progress',
    title: '',
    logs: [],
};

// =============================================
// CONTEXT
// =============================================

const StatusModalContext = createContext<StatusModalAPI | null>(null);

// =============================================
// HOOK
// =============================================

export const useStatusModal = (): StatusModalAPI => {
    const ctx = useContext(StatusModalContext);
    if (!ctx) {
        throw new Error('useStatusModal deve ser usado dentro de <StatusModalProvider>');
    }
    return ctx;
};

// =============================================
// PROVIDER + MODAL UI
// =============================================

export const StatusModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [modal, setModal] = useState<StatusModalState>(initialState);
    const logsRef = useRef<string[]>([]);

    const open = useCallback((title: string) => {
        logsRef.current = [];
        setModal({
            open: true,
            type: 'progress',
            title,
            logs: [],
        });
    }, []);

    const log = useCallback((msg: string) => {
        logsRef.current = [...logsRef.current, msg];
        setModal(prev => ({
            ...prev,
            logs: [...logsRef.current],
        }));
    }, []);

    const success = useCallback((title?: string) => {
        setModal(prev => ({
            ...prev,
            type: 'success',
            title: title ?? prev.title,
            logs: [...prev.logs, '✅ Concluído com sucesso!'],
        }));
    }, []);

    const error = useCallback((errorMsg: string, title?: string) => {
        setModal(prev => ({
            ...prev,
            type: 'error',
            title: title ?? 'Falha na execução',
            logs: [...prev.logs, `❌ ${errorMsg}`],
        }));
    }, []);

    const close = useCallback(() => {
        setModal(prev => ({ ...prev, open: false }));
    }, []);

    const api: StatusModalAPI = {
        open,
        log,
        success,
        error,
        close,
        state: modal,
    };

    return (
        <StatusModalContext.Provider value={api}>
            {children}

            {/* MODAL UI — Renderizado uma única vez no topo da árvore */}
            {modal.open && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ height: '460px' }}>
                        {/* Header */}
                        <div className={`px-6 py-4 flex items-center gap-3 shrink-0 ${modal.type === 'progress' ? 'bg-blue-50 text-blue-700' :
                                modal.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                                    'bg-red-50 text-red-700'
                            }`}>
                            {modal.type === 'progress' && <Loader2 size={20} className="animate-spin" />}
                            {modal.type === 'success' && <CheckCircle2 size={20} />}
                            {modal.type === 'error' && <AlertTriangle size={20} />}
                            <h3 className="font-bold text-base flex-1">{modal.title}</h3>
                            {modal.type !== 'progress' && (
                                <button
                                    onClick={close}
                                    className="p-1 hover:bg-black/10 rounded-full transition"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Logs — Área fixa com scroll */}
                        <div className="px-6 py-4 flex-1 overflow-y-auto space-y-1.5">
                            {modal.logs.map((entry, i) => (
                                <div key={i} className="text-sm text-slate-700 font-mono flex items-start gap-2">
                                    <span className="text-slate-300 text-xs mt-0.5 select-none shrink-0">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="break-all">{entry}</span>
                                </div>
                            ))}
                            {modal.type === 'progress' && modal.logs.length > 0 && (
                                <div className="text-sm text-blue-400 font-mono flex items-center gap-2 animate-pulse">
                                    <Loader2 size={12} className="animate-spin" />
                                    Processando...
                                </div>
                            )}
                        </div>

                        {/* Footer — Sempre visível */}
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                onClick={close}
                                disabled={modal.type === 'progress'}
                                className={`px-6 py-2.5 rounded-full font-bold text-sm text-white transition ${modal.type === 'progress'
                                        ? 'bg-slate-300 cursor-not-allowed'
                                        : modal.type === 'success'
                                            ? 'bg-emerald-600 hover:bg-emerald-500'
                                            : 'bg-red-600 hover:bg-red-500'
                                    }`}
                            >
                                {modal.type === 'progress' ? 'Aguarde...' : 'Fechar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </StatusModalContext.Provider>
    );
};
