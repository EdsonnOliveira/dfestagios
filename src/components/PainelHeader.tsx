import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import {
  authService,
  clientesService,
  estagiariosService
} from '../services/firebase';
import {
  formatContractEndDatePtBr,
  hasCompletedOneYearContractTerm
} from '../lib/contractTerm';

import { isPanelAdminEmail } from '../constants/admin';

type ContractYearAlert = {
  key: string;
  clienteId: string;
  nomeEstagiario: string;
  nomeEmpresa: string;
  dataFimLabel: string;
};

export default function PainelHeader() {
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [contractAlerts, setContractAlerts] = useState<ContractYearAlert[]>(
    []
  );

  const handleToggleTheme = () => {
    toggleTheme();
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    if (!isPanelAdminEmail(user?.email)) {
      setContractAlerts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [clientes, estagiarios] = await Promise.all([
          clientesService.getAll(),
          estagiariosService.getAll()
        ]);
        if (cancelled) return;
        const estagToCliente = new Map<
          string,
          { clienteId: string; empresa: string }
        >();
        for (const c of clientes) {
          if (!c.id) continue;
          const empresa = c.nomeFantasia?.trim() || c.razaoSocial || '—';
          for (const eid of c.estagiariosVinculados || []) {
            if (!estagToCliente.has(eid)) {
              estagToCliente.set(eid, { clienteId: c.id, empresa });
            }
          }
        }
        const list: ContractYearAlert[] = [];
        for (const est of estagiarios) {
          if (!est.id) continue;
          if (est.status !== 'ativo') continue;
          const inicio = est.estagioDataInicio?.trim();
          if (!inicio) continue;
          if (!hasCompletedOneYearContractTerm(inicio)) continue;
          const link = estagToCliente.get(est.id);
          if (!link) continue;
          list.push({
            key: est.id,
            clienteId: link.clienteId,
            nomeEstagiario: est.nome?.trim() || '—',
            nomeEmpresa: link.empresa,
            dataFimLabel: formatContractEndDatePtBr(inicio)
          });
        }
        list.sort((a, b) =>
          a.nomeEstagiario.localeCompare(b.nomeEstagiario, 'pt-BR')
        );
        setContractAlerts(list);
      } catch (err) {
        console.error(err);
        if (!cancelled) setContractAlerts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const visibleContractAlerts = useMemo(() => {
    if (!router.isReady) return contractAlerts;
    const path = router.pathname.replace(/\/$/, '');
    if (path !== '/cliente-detalhes') return contractAlerts;
    const raw = router.query.id;
    const pageClienteId =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw[0]
          : '';
    if (!pageClienteId) return contractAlerts;
    return contractAlerts.filter((a) => a.clienteId !== pageClienteId);
  }, [contractAlerts, router.isReady, router.pathname, router.query.id]);

  const handleLogout = async () => {
    try {
      await authService.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-white dark:bg-slate-800 shadow-lg fixed top-0 left-0 right-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto flex justify-between items-center py-4 px-4">
        <div className="flex items-center">
          <Image 
            src="/logo.png" 
            alt="DF ESTÁGIOS" 
            width={200} 
            height={60} 
            className="h-12 w-auto"
          />
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => handleNavigation('/painel')}
            className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium transition-colors"
          >
            Estagiários
          </button>
          {isPanelAdminEmail(user?.email) && (
            <>
              <button
                onClick={() => handleNavigation('/entrevistas')}
                className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium transition-colors"
              >
                Entrevistas
              </button>
              <button
                onClick={() => handleNavigation('/clientes')}
                className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium transition-colors"
              >
                Clientes
              </button>
              <button
                onClick={() => handleNavigation('/mensalidades')}
                className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium transition-colors"
              >
                Mensalidades
              </button>
              <button
                onClick={() => handleNavigation('/drive')}
                className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium transition-colors"
              >
                Drive
              </button>
              <button
                onClick={() => handleNavigation('/configuracoes')}
                className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium transition-colors"
              >
                Configurações
              </button>
            </>
          )}
          <button
            onClick={() => handleNavigation('/painel-grupos')}
            className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium transition-colors"
          >
            Grupos WhatsApp
          </button>
        </nav>
        
        <div className="hidden md:flex items-center gap-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isDark ? 'Escuro' : 'Claro'}
          </span>
          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            title={isDark ? 'Modo claro' : 'Modo escuro'}
          >
            {isDark ? (
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
          <button 
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>

        <button
          onClick={toggleMobileMenu}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 space-y-1"
          aria-label="Toggle mobile menu"
        >
          <span className={`block w-6 h-0.5 bg-[#004085] dark:bg-blue-400 transition-all duration-300 ${
            isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
          }`}></span>
          <span className={`block w-6 h-0.5 bg-[#004085] dark:bg-blue-400 transition-all duration-300 ${
            isMobileMenuOpen ? 'opacity-0' : ''
          }`}></span>
          <span className={`block w-6 h-0.5 bg-[#004085] dark:bg-blue-400 transition-all duration-300 ${
            isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
          }`}></span>
        </button>
      </div>

      {isPanelAdminEmail(user?.email) && visibleContractAlerts.length > 0 && (
        <div className="border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 max-h-52 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
              Contratos — 1 ano de vigência concluído
            </p>
            <ul className="mt-2 space-y-2 text-sm text-amber-950 dark:text-amber-100">
              {visibleContractAlerts.map((a) => (
                <li key={a.key}>
                  O contrato do estagiário{' '}
                  <span className="font-semibold">{a.nomeEstagiario}</span> da
                  empresa <span className="font-semibold">{a.nomeEmpresa}</span>{' '}
                  completou 1 ano (vigência até {a.dataFimLabel}).{' '}
                  <button
                    type="button"
                    onClick={() =>
                      void router.push(
                        `/cliente-detalhes?id=${encodeURIComponent(a.clienteId)}`
                      )
                    }
                    className="text-[#004085] dark:text-blue-400 underline font-medium"
                  >
                    Ver ficha do cliente
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={`md:hidden fixed top-0 left-0 w-full h-screen bg-[#00408580] dark:bg-slate-900/80 z-[9999] transition-opacity duration-300 ${
        isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`} onClick={closeMobileMenu}></div>

      <div className={`md:hidden fixed top-0 right-0 h-screen w-64 bg-white dark:bg-slate-800 shadow-lg z-[10000] transform transition-transform duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col p-6 space-y-6">
          <div className="flex justify-between items-center">
            <button
              onClick={closeMobileMenu}
              className="text-[#004085] dark:text-blue-400 hover:text-[#007BFF] dark:hover:text-blue-300 transition-colors"
              aria-label="Close mobile menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tema:</span>
              <button
                onClick={handleToggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                title={isDark ? 'Modo claro' : 'Modo escuro'}
              >
                {isDark ? (
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
            </div>
            
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => {
                  handleNavigation('/painel');
                  closeMobileMenu();
                }}
                className="text-left py-2 px-4 rounded-lg transition-colors text-[#004085] dark:text-blue-400 hover:bg-[#004085] dark:hover:bg-blue-400 hover:text-white font-medium"
              >
                Estagiários
              </button>
              {isPanelAdminEmail(user?.email) && (
                <>
                  <button
                    onClick={() => {
                      handleNavigation('/entrevistas');
                      closeMobileMenu();
                    }}
                    className="text-left py-2 px-4 rounded-lg transition-colors text-[#004085] dark:text-blue-400 hover:bg-[#004085] dark:hover:bg-blue-400 hover:text-white font-medium"
                  >
                    Entrevistas
                  </button>
                  <button
                    onClick={() => {
                      handleNavigation('/clientes');
                      closeMobileMenu();
                    }}
                    className="text-left py-2 px-4 rounded-lg transition-colors text-[#004085] dark:text-blue-400 hover:bg-[#004085] dark:hover:bg-blue-400 hover:text-white font-medium"
                  >
                    Clientes
                  </button>
                  <button
                    onClick={() => {
                      handleNavigation('/mensalidades');
                      closeMobileMenu();
                    }}
                    className="text-left py-2 px-4 rounded-lg transition-colors text-[#004085] dark:text-blue-400 hover:bg-[#004085] dark:hover:bg-blue-400 hover:text-white font-medium"
                  >
                    Mensalidades
                  </button>
                  <button
                    onClick={() => {
                      handleNavigation('/drive');
                      closeMobileMenu();
                    }}
                    className="text-left py-2 px-4 rounded-lg transition-colors text-[#004085] dark:text-blue-400 hover:bg-[#004085] dark:hover:bg-blue-400 hover:text-white font-medium"
                  >
                    Drive
                  </button>
                  <button
                    onClick={() => {
                      handleNavigation('/configuracoes');
                      closeMobileMenu();
                    }}
                    className="text-left py-2 px-4 rounded-lg transition-colors text-[#004085] dark:text-blue-400 hover:bg-[#004085] dark:hover:bg-blue-400 hover:text-white font-medium"
                  >
                    Configurações
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  handleNavigation('/painel-grupos');
                  closeMobileMenu();
                }}
                className="text-left py-2 px-4 rounded-lg transition-colors text-[#004085] dark:text-blue-400 hover:bg-[#004085] dark:hover:bg-blue-400 hover:text-white font-medium"
              >
                Grupos WhatsApp
              </button>
            </div>
            
            <button 
              onClick={() => {
                handleLogout();
                closeMobileMenu();
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
