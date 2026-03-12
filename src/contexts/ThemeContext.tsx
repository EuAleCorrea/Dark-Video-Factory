/**
 * ThemeContext — Gerencia o tema (dark/light) da aplicação.
 *
 * - Persiste tema via EditorPersistenceService (disco + Supabase)
 * - Define data-theme no <html> para controlar variáveis CSS
 * - Qualquer componente pode usar useTheme() sem prop drilling
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ThemeMode } from '../types/editor';
import { EditorPersistenceService } from '../services/EditorPersistenceService';
import { EngineConfig } from '../types';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: React.ReactNode;
  config?: EngineConfig;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, config }) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [persistence] = useState(() => new EditorPersistenceService(config));

  // Atualiza config do persistence quando muda
  useEffect(() => {
    persistence.updateConfig(config);
  }, [config, persistence]);

  // Carrega tema salvo no boot
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await persistence.loadTheme();
        if (saved?.mode) {
          setThemeState(saved.mode);
          document.documentElement.setAttribute('data-theme', saved.mode);
        }
      } catch (e) {
        console.warn('[Theme] Falha ao carregar tema, usando dark:', e);
      }
    };
    loadTheme();
  }, [persistence]);

  // Aplica data-theme no <html> sempre que muda
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    document.documentElement.setAttribute('data-theme', mode);
    try {
      await persistence.saveTheme({ mode });
    } catch (e) {
      console.warn('[Theme] Falha ao salvar tema:', e);
    }
  }, [persistence]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
