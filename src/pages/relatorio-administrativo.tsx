import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import { AnimatedModal } from '../components/AnimatedModal';
import {
  buildRelatorioAdministrativoDiario,
  formatDateLongPtBr,
  formatDateShortPtBr,
  getTodayIsoDate,
  parseDataReferenciaToIso,
} from '../lib/relatorioAdministrativo';
import { relatorioAdministrativoService } from '../services/relatorioAdministrativoService';
import type { RelatorioAdministrativoEvento } from '../types/firebase';

type ReposicaoEditValue = 'true' | 'false' | 'null';

type EditFormState = {
  clienteNome: string;
  estagiarioNome: string;
  dataReferencia: string;
  haveraReposicao: ReposicaoEditValue;
};

const emptyEditForm: EditFormState = {
  clienteNome: '',
  estagiarioNome: '',
  dataReferencia: '',
  haveraReposicao: 'null',
};

export default function RelatorioAdministrativoPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());
  const [eventos, setEventos] = useState<RelatorioAdministrativoEvento[]>([]);
  const [historicoDatas, setHistoricoDatas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [eventoEmEdicao, setEventoEmEdicao] = useState<RelatorioAdministrativoEvento | null>(
    null
  );
  const [formEdit, setFormEdit] = useState<EditFormState>(emptyEditForm);
  const [eventoParaExcluir, setEventoParaExcluir] = useState<RelatorioAdministrativoEvento | null>(
    null
  );
  const [showExcluirDiaModal, setShowExcluirDiaModal] = useState(false);

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

  const refreshAll = useCallback(async () => {
    await loadHistorico();
    await loadEventos(selectedDate);
  }, [loadEventos, loadHistorico, selectedDate]);

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

  const handleOpenEdit = (evento: RelatorioAdministrativoEvento) => {
    setEventoEmEdicao(evento);
    setFormEdit({
      clienteNome: evento.clienteNome,
      estagiarioNome: evento.estagiarioNome,
      dataReferencia: parseDataReferenciaToIso(evento.dataReferencia),
      haveraReposicao:
        evento.haveraReposicao === true
          ? 'true'
          : evento.haveraReposicao === false
            ? 'false'
            : 'null',
    });
  };

  const handleCloseEdit = () => {
    setEventoEmEdicao(null);
    setFormEdit(emptyEditForm);
  };

  const handleSaveEdit = async () => {
    if (!eventoEmEdicao?.id) return;
    if (!formEdit.clienteNome.trim() || !formEdit.estagiarioNome.trim() || !formEdit.dataReferencia) {
      toast.error('Preencha empresa, estagiário e data.');
      return;
    }

    try {
      setActionLoading(true);
      await relatorioAdministrativoService.updateEvento(eventoEmEdicao.id, {
        clienteNome: formEdit.clienteNome,
        estagiarioNome: formEdit.estagiarioNome,
        dataReferencia: formEdit.dataReferencia,
        ...(eventoEmEdicao.tipo === 'rescisao'
          ? {
              haveraReposicao:
                formEdit.haveraReposicao === 'true'
                  ? true
                  : formEdit.haveraReposicao === 'false'
                    ? false
                    : null,
            }
          : {}),
      });
      handleCloseEdit();
      await refreshAll();
      toast.success('Registro atualizado.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteEvento = async () => {
    if (!eventoParaExcluir?.id) return;
    try {
      setActionLoading(true);
      await relatorioAdministrativoService.deleteEvento(eventoParaExcluir.id);
      setEventoParaExcluir(null);
      await refreshAll();
      toast.success('Registro excluído.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir registro.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteDia = async () => {
    try {
      setActionLoading(true);
      const removed = await relatorioAdministrativoService.deleteEventosByDataRegistro(
        selectedDate
      );
      setShowExcluirDiaModal(false);
      await refreshAll();
      toast.success(
        removed > 0 ? `${removed} registro(s) excluído(s).` : 'Nenhum registro para excluir.'
      );
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir registros do dia.');
    } finally {
      setActionLoading(false);
    }
  };

  const contratosCount = eventos.filter((item) => item.tipo === 'contrato').length;
  const rescisoesCount = eventos.filter((item) => item.tipo === 'rescisao').length;
  const contratos = eventos.filter((item) => item.tipo === 'contrato');
  const rescisoes = eventos.filter((item) => item.tipo === 'rescisao');

  const renderEventoRow = (evento: RelatorioAdministrativoEvento) => {
    const dataLabel =
      evento.tipo === 'contrato'
        ? `Início ${formatDateShortPtBr(evento.dataReferencia)}`
        : `Saída ${formatDateShortPtBr(evento.dataReferencia)}`;
    const reposicaoLabel =
      evento.tipo === 'rescisao' && evento.haveraReposicao === true
        ? 'Haverá reposição'
        : evento.tipo === 'rescisao' && evento.haveraReposicao === false
          ? 'Sem reposição'
          : null;

    return (
      <div
        key={evento.id}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {evento.clienteNome} — {evento.estagiarioNome}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {dataLabel}
            {reposicaoLabel ? ` · ${reposicaoLabel}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenEdit(evento)}
            className="px-3 py-1.5 text-sm text-[#004085] dark:text-blue-400 border border-[#004085]/30 dark:border-blue-400/30 rounded-lg hover:bg-[#004085]/5 dark:hover:bg-blue-400/10"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => setEventoParaExcluir(evento)}
            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Excluir
          </button>
        </div>
      </div>
    );
  };

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
              onClick={() => void refreshAll()}
              className="bg-slate-600 dark:bg-slate-600 hover:bg-slate-700 dark:hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Recarregar
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 transition-colors">
                <h2 className="text-sm font-bold text-[#004085] dark:text-blue-400 mb-2">
                  Histórico
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Cada dia com registro aparece aqui (até 90 dias). Hoje sempre fica visível.
                </p>
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
                  <div className="flex flex-wrap gap-2">
                    {eventos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowExcluirDiaModal(true)}
                        disabled={loading || actionLoading}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Excluir dia inteiro
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCopyRelatorio()}
                      disabled={loading}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Copiar relatório
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="py-10 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400" />
                    <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando...</p>
                  </div>
                ) : (
                  <>
                    {eventos.length > 0 && (
                      <div className="mb-6 space-y-4">
                        {contratos.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-green-700 dark:text-green-400 mb-2">
                              Contratos ({contratos.length})
                            </h3>
                            <div className="space-y-2">{contratos.map(renderEventoRow)}</div>
                          </div>
                        )}
                        {rescisoes.length > 0 && (
                          <div>
                            <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-2">
                              Rescisões ({rescisoes.length})
                            </h3>
                            <div className="space-y-2">{rescisoes.map(renderEventoRow)}</div>
                          </div>
                        )}
                      </div>
                    )}

                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-slate-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 font-sans leading-relaxed">
                      {relatorioTexto}
                    </pre>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <AnimatedModal open={Boolean(eventoEmEdicao)} onClose={handleCloseEdit}>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
              Editar {eventoEmEdicao?.tipo === 'contrato' ? 'contrato' : 'rescisão'}
            </h3>
            <button
              type="button"
              onClick={handleCloseEdit}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Empresa
              </label>
              <input
                type="text"
                value={formEdit.clienteNome}
                onChange={(e) => setFormEdit((prev) => ({ ...prev, clienteNome: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estagiário
              </label>
              <input
                type="text"
                value={formEdit.estagiarioNome}
                onChange={(e) =>
                  setFormEdit((prev) => ({ ...prev, estagiarioNome: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {eventoEmEdicao?.tipo === 'contrato' ? 'Data de início' : 'Data de saída'}
              </label>
              <input
                type="date"
                value={formEdit.dataReferencia}
                onChange={(e) =>
                  setFormEdit((prev) => ({ ...prev, dataReferencia: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            {eventoEmEdicao?.tipo === 'rescisao' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reposição
                </label>
                <select
                  value={formEdit.haveraReposicao}
                  onChange={(e) =>
                    setFormEdit((prev) => ({
                      ...prev,
                      haveraReposicao: e.target.value as ReposicaoEditValue,
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="null">Não informado</option>
                  <option value="true">Haverá reposição</option>
                  <option value="false">Não haverá reposição</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={actionLoading}
              className="w-full px-4 py-2 bg-[#004085] hover:bg-[#0056B3] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={handleCloseEdit}
              disabled={actionLoading}
              className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
          </div>
        </div>
      </AnimatedModal>

      <AnimatedModal open={Boolean(eventoParaExcluir)} onClose={() => setEventoParaExcluir(null)}>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">Excluir registro</h3>
            <button
              type="button"
              onClick={() => setEventoParaExcluir(null)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Excluir{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {eventoParaExcluir?.clienteNome} — {eventoParaExcluir?.estagiarioNome}
            </span>{' '}
            do relatório deste dia?
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleConfirmDeleteEvento()}
              disabled={actionLoading}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Excluindo...' : 'Sim, excluir'}
            </button>
            <button
              type="button"
              onClick={() => setEventoParaExcluir(null)}
              disabled={actionLoading}
              className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Voltar
            </button>
          </div>
        </div>
      </AnimatedModal>

      <AnimatedModal open={showExcluirDiaModal} onClose={() => setShowExcluirDiaModal(false)}>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
              Excluir dia inteiro
            </h3>
            <button
              type="button"
              onClick={() => setShowExcluirDiaModal(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Excluir todos os {eventos.length} registro(s) de{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatDateLongPtBr(selectedDate)}
            </span>
            ? Isso remove contratos e rescisões deste dia do relatório.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleConfirmDeleteDia()}
              disabled={actionLoading}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Excluindo...' : 'Sim, excluir tudo'}
            </button>
            <button
              type="button"
              onClick={() => setShowExcluirDiaModal(false)}
              disabled={actionLoading}
              className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Voltar
            </button>
          </div>
        </div>
      </AnimatedModal>
    </ProtectedRoute>
  );
}
