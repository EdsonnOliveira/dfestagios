import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Verificar se há tema salvo no localStorage
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Verificar preferência do sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      // Aplicar tema ao documento
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      
      // Salvar no localStorage
      localStorage.setItem('theme', theme);
      
      // Forçar re-render para garantir que as classes sejam aplicadas
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const isDark = theme === 'dark';

  // Evitar hidratação incorreta no Next.js
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme, isDark: false }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
