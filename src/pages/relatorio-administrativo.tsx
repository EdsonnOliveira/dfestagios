import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import {
  buildRelatorioAdministrativoDiario,
  formatDateLongPtBr,
  getTodayIsoDate,
} from '../lib/relatorioAdministrativo';
import { relatorioAdministrativoService } from '../services/relatorioAdministrativoService';
import type { RelatorioAdministrativoEvento } from '../types/firebase';

export default function RelatorioAdministrativoPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [eventos, setEventos] = useState<RelatorioAdministrativoEvento[]>([]);
  const [historicoDatas, setHistoricoDatas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  const relatorioTexto = useMemo(
    () => buildRelatorioAdministrativoDiario(selectedDate, eventos),
    [selectedDate, eventos]
  );

  const loadEventos = useCallback(async (isoDate: string) => {
    setLoading(true);
    try {
      const data = await relatorioAdministrativoService.getByDataRegistro(isoDate);
      setEventos(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar relatório do dia.');
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistorico = useCallback(async () => {
    setLoadingHistorico(true);
    try {
      const datas = await relatorioAdministrativoService.getHistoricoDatas();
      const today = getTodayIsoDate();
      const merged = Array.from(new Set([today, ...datas])).sort((a, b) =>
        b.localeCompare(a)
      );
      setHistoricoDatas(merged);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar histórico.');
      setHistoricoDatas([getTodayIsoDate()]);
    } finally {
      setLoadingHistorico(false);
    }
  }, []);

  useEffect(() => {
    void loadHistorico();
  }, [loadHistorico]);

  useEffect(() => {
    void loadEventos(selectedDate);
  }, [selectedDate, loadEventos]);

  const handleCopyRelatorio = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(relatorioTexto);
      toast.success('Relatório copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
      toast(relatorioTexto, { duration: 10000 });
    }
  };

  const contratosCount = eventos.filter((item) => item.tipo === 'contrato').length;
  const rescisoesCount = eventos.filter((item) => item.tipo === 'rescisao').length;

  return (
    <ProtectedRoute>
      <Head>
        <title>Relatório Administrativo | DF Estágios</title>
      </Head>
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 transition-colors">
        <PainelHeader />
        <main className="max-w-7xl mx-auto px-4 py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#004085] dark:text-blue-400">
                Relatório Administrativo
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Contratos vinculados e rescisões registradas por dia
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadHistorico();
                void loadEventos(selectedDate);
              }}
              className="bg-slate-600 dark:bg-slate-600 hover:bg-slate-700 dark:hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Recarregar
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 transition-colors">
                <h2 className="text-sm font-bold text-[#004085] dark:text-blue-400 mb-3">
                  Histórico
                </h2>
                {loadingHistorico ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto">
                    {historicoDatas.map((isoDate) => {
                      const isSelected = isoDate === selectedDate;
                      return (
                        <button
                          key={isoDate}
                          type="button"
                          onClick={() => setSelectedDate(isoDate)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? 'bg-[#004085] text-white dark:bg-blue-600'
                              : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600'
                          }`}
                        >
                          {formatDateLongPtBr(isoDate)}
                          {isoDate === getTodayIsoDate() ? ' (Hoje)' : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 transition-colors">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Contratos
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {contratosCount}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 transition-colors">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Rescisões
                  </p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {rescisoesCount}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                    {formatDateLongPtBr(selectedDate)}
                  </h2>
                  <button
                    type="button"
                    onClick={() => void handleCopyRelatorio()}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Copiar relatório
                  </button>
                </div>

                {loading ? (
                  <div className="py-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400" />
                    <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando...</p>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 font-sans leading-relaxed">
                    {relatorioTexto}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
