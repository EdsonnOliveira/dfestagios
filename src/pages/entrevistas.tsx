import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import PainelHeader from '../components/PainelHeader';
import { AnimatedModal } from '../components/AnimatedModal';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import {
  clientesService,
  entrevistaCandidatosService,
  entrevistasService,
  estagiariosService,
  vinculacoesService,
} from '../services/firebase';
import {
  buildEntrevistaWhatsappMessage,
  getWeekStartMonday,
  getWeekdayDatesMonToFri,
  parseHorarioTrabalho,
  toIsoDate,
} from '../lib/entrevistaMessage';
import type {
  Cliente,
  Entrevista,
  EntrevistaCandidato,
  EntrevistaCandidatoStatus,
  EntrevistaStatus,
  EntrevistaTipoVaga,
} from '../types/firebase';
import {
  ENTREVISTA_CANDIDATO_STATUS_LABELS,
} from '../types/firebase';

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const;

const emptyForm = {
  clienteId: '',
  quantidadeVagas: '1',
  tipoVaga: 'nova' as EntrevistaTipoVaga,
  endereco: '',
  bairro: '',
  cidade: '',
  cep: '',
  googleMapsLink: '',
  pontoReferencia: '',
  dataEntrevista: '',
  horarioEntrevista: '',
  tituloVaga: '',
  horarioTrabalho: '',
  valorBolsa: '',
  atividades: '',
  requisitos: '',
  status: 'agendada' as EntrevistaStatus,
};

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100';

const labelClass =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

function maskPhone(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length === 0) return '';
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function resolveCandidatoStatus(
  candidato: EntrevistaCandidato,
  hasContract: boolean
): EntrevistaCandidatoStatus {
  if (hasContract) return 'contrato_preenchido';
  if (candidato.estagiarioId) return 'contrato_pendente';
  return candidato.status;
}

export default function EntrevistasPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(new Date()));
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEntrevista, setEditingEntrevista] = useState<Entrevista | null>(
    null
  );
  const [formData, setFormData] = useState(emptyForm);
  const [selectedEntrevista, setSelectedEntrevista] = useState<Entrevista | null>(
    null
  );
  const [candidatos, setCandidatos] = useState<EntrevistaCandidato[]>([]);
  const [loadingCandidatos, setLoadingCandidatos] = useState(false);
  const [novoCandidatoNome, setNovoCandidatoNome] = useState('');
  const [novoCandidatoTelefone, setNovoCandidatoTelefone] = useState('');

  const weekDays = useMemo(() => getWeekdayDatesMonToFri(weekStart), [weekStart]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[4];
    if (!start || !end) return '';
    const startLabel = start.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
    const endLabel = end.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `${startLabel} — ${endLabel}`;
  }, [weekDays]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [entrevistasData, clientesData] = await Promise.all([
        entrevistasService.getAll(),
        clientesService.getAll(),
      ]);
      setEntrevistas(entrevistasData);
      setClientes(clientesData);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar entrevistas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const entrevistasByDay = useMemo(() => {
    const weekIsoSet = new Set(weekDays.map((day) => toIsoDate(day)));
    const map = new Map<string, Entrevista[]>();
    weekDays.forEach((day) => map.set(toIsoDate(day), []));
    entrevistas.forEach((entrevista) => {
      if (!weekIsoSet.has(entrevista.dataEntrevista)) return;
      const list = map.get(entrevista.dataEntrevista) ?? [];
      list.push(entrevista);
      map.set(entrevista.dataEntrevista, list);
    });
    map.forEach((list, key) => {
      list.sort((a, b) => a.empresaNome.localeCompare(b.empresaNome, 'pt-BR'));
      map.set(key, list);
    });
    return map;
  }, [entrevistas, weekDays]);

  const selectedCliente = useMemo(
    () => clientes.find((cliente) => cliente.id === formData.clienteId) ?? null,
    [clientes, formData.clienteId]
  );

  const whatsappMessage = useMemo(
    () => (selectedEntrevista ? buildEntrevistaWhatsappMessage(selectedEntrevista) : ''),
    [selectedEntrevista]
  );

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    setFormData((prev) => ({
      ...prev,
      clienteId,
      endereco: cliente?.endereco ?? prev.endereco,
      bairro: cliente?.bairro ?? prev.bairro,
      cidade: cliente?.cidade ?? prev.cidade,
      cep: cliente?.cep ?? prev.cep,
    }));
  };

  const openCreateModal = (isoDate?: string) => {
    setEditingEntrevista(null);
    setFormData({
      ...emptyForm,
      dataEntrevista: isoDate ?? toIsoDate(new Date()),
    });
    setShowFormModal(true);
  };

  const openEditModal = (entrevista: Entrevista) => {
    setEditingEntrevista(entrevista);
    setFormData({
      clienteId: entrevista.clienteId,
      quantidadeVagas: String(entrevista.quantidadeVagas),
      tipoVaga: entrevista.tipoVaga,
      endereco: entrevista.endereco,
      bairro: entrevista.bairro,
      cidade: entrevista.cidade,
      cep: entrevista.cep,
      googleMapsLink: entrevista.googleMapsLink ?? '',
      pontoReferencia: entrevista.pontoReferencia ?? '',
      dataEntrevista: entrevista.dataEntrevista,
      horarioEntrevista: entrevista.horarioEntrevista,
      tituloVaga: entrevista.tituloVaga,
      horarioTrabalho: entrevista.horarioTrabalho,
      valorBolsa: entrevista.valorBolsa,
      atividades: entrevista.atividades,
      requisitos: entrevista.requisitos,
      status: entrevista.status,
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingEntrevista(null);
    setFormData(emptyForm);
  };

  const handleSaveEntrevista = async () => {
    if (
      !formData.clienteId ||
      !formData.dataEntrevista ||
      !formData.tituloVaga.trim() ||
      !formData.horarioEntrevista.trim()
    ) {
      toast.error('Preencha cliente, data, título da vaga e horário da entrevista.');
      return;
    }
    const cliente = clientes.find((item) => item.id === formData.clienteId);
    if (!cliente) {
      toast.error('Cliente não encontrado.');
      return;
    }
    const payload = {
      clienteId: formData.clienteId,
      empresaNome: cliente.nomeFantasia?.trim() || cliente.razaoSocial,
      quantidadeVagas: Math.max(1, parseInt(formData.quantidadeVagas, 10) || 1),
      tipoVaga: formData.tipoVaga,
      endereco: formData.endereco.trim(),
      bairro: formData.bairro.trim(),
      cidade: formData.cidade.trim(),
      cep: formData.cep.trim(),
      googleMapsLink: formData.googleMapsLink.trim(),
      pontoReferencia: formData.pontoReferencia.trim(),
      dataEntrevista: formData.dataEntrevista,
      horarioEntrevista: formData.horarioEntrevista.trim(),
      tituloVaga: formData.tituloVaga.trim(),
      horarioTrabalho: formData.horarioTrabalho.trim(),
      valorBolsa: formData.valorBolsa.trim(),
      atividades: formData.atividades.trim(),
      requisitos: formData.requisitos.trim(),
      status: formData.status,
    };
    try {
      setLoadingAction(true);
      if (editingEntrevista?.id) {
        await entrevistasService.update(editingEntrevista.id, payload);
        setEntrevistas((prev) =>
          prev.map((item) =>
            item.id === editingEntrevista.id ? { ...item, ...payload } : item
          )
        );
        if (selectedEntrevista?.id === editingEntrevista.id) {
          setSelectedEntrevista({ ...selectedEntrevista, ...payload });
        }
        toast.success('Entrevista atualizada.');
      } else {
        const id = await entrevistasService.add(payload);
        setEntrevistas((prev) => [...prev, { id, ...payload, createdAt: new Date(), updatedAt: new Date() }]);
        toast.success('Entrevista criada.');
      }
      closeFormModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar entrevista.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteEntrevista = async (entrevista: Entrevista) => {
    if (!entrevista.id) return;
    if (!confirm('Excluir esta entrevista?')) return;
    try {
      setLoadingAction(true);
      const candidatosData = await entrevistaCandidatosService.getByEntrevistaId(
        entrevista.id
      );
      await Promise.all(
        candidatosData.map((candidato) =>
          candidato.id
            ? entrevistaCandidatosService.delete(candidato.id)
            : Promise.resolve()
        )
      );
      await entrevistasService.delete(entrevista.id);
      setEntrevistas((prev) => prev.filter((item) => item.id !== entrevista.id));
      if (selectedEntrevista?.id === entrevista.id) {
        setSelectedEntrevista(null);
        setCandidatos([]);
      }
      toast.success('Entrevista excluída.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir entrevista.');
    } finally {
      setLoadingAction(false);
    }
  };

  const refreshCandidatos = useCallback(async (entrevistaId: string) => {
    setLoadingCandidatos(true);
    try {
      const list = await entrevistaCandidatosService.getByEntrevistaId(entrevistaId);
      const enriched = await Promise.all(
        list.map(async (candidato) => {
          if (!candidato.estagiarioId) return candidato;
          const estagiario = await estagiariosService.getById(candidato.estagiarioId);
          const hasContract = Boolean(estagiario?.contratoPdfDrivePath?.trim());
          const status = resolveCandidatoStatus(candidato, hasContract);
          if (status !== candidato.status && candidato.id) {
            await entrevistaCandidatosService.update(candidato.id, { status });
            return { ...candidato, status };
          }
          return { ...candidato, status };
        })
      );
      setCandidatos(enriched);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar candidatos.');
    } finally {
      setLoadingCandidatos(false);
    }
  }, []);

  const openDetailModal = async (entrevista: Entrevista) => {
    setSelectedEntrevista(entrevista);
    if (entrevista.id) {
      await refreshCandidatos(entrevista.id);
    }
  };

  const closeDetailModal = () => {
    setSelectedEntrevista(null);
    setCandidatos([]);
    setNovoCandidatoNome('');
    setNovoCandidatoTelefone('');
  };

  const handleCopyMessage = async () => {
    if (!whatsappMessage || typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      toast.success('Mensagem copiada.');
    } catch {
      toast.error('Não foi possível copiar.');
      toast(whatsappMessage, { duration: 10000 });
    }
  };

  const handleAddCandidato = async () => {
    if (!selectedEntrevista?.id || !novoCandidatoNome.trim() || !novoCandidatoTelefone.trim()) {
      toast.error('Informe nome e telefone do candidato.');
      return;
    }
    try {
      setLoadingAction(true);
      const id = await entrevistaCandidatosService.add({
        entrevistaId: selectedEntrevista.id,
        clienteId: selectedEntrevista.clienteId,
        nome: novoCandidatoNome.trim(),
        telefone: novoCandidatoTelefone.replace(/\D/g, ''),
        status: 'interessado',
      });
      setCandidatos((prev) => [
        ...prev,
        {
          id,
          entrevistaId: selectedEntrevista.id!,
          clienteId: selectedEntrevista.clienteId,
          nome: novoCandidatoNome.trim(),
          telefone: novoCandidatoTelefone.replace(/\D/g, ''),
          status: 'interessado',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      setNovoCandidatoNome('');
      setNovoCandidatoTelefone('');
      toast.success('Candidato adicionado.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar candidato.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSelectCandidato = async (candidato: EntrevistaCandidato) => {
    if (!selectedEntrevista?.id || !candidato.id) return;
    try {
      setLoadingAction(true);
      await Promise.all(
        candidatos.map(async (item) => {
          if (!item.id) return;
          const nextStatus =
            item.id === candidato.id ? 'selecionado' : 'interessado';
          if (item.status !== nextStatus) {
            await entrevistaCandidatosService.update(item.id, { status: nextStatus });
          }
        })
      );
      await refreshCandidatos(selectedEntrevista.id);
      toast.success('Candidato selecionado.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao selecionar candidato.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleGenerateContractLink = async (candidato: EntrevistaCandidato) => {
    if (!selectedEntrevista?.id || !candidato.id) return;
    if (candidato.status !== 'selecionado' && candidato.status !== 'contrato_pendente') {
      toast.error('Selecione o candidato antes de gerar o link.');
      return;
    }
    try {
      setLoadingAction(true);
      const horarios = parseHorarioTrabalho(selectedEntrevista.horarioTrabalho);
      let estagiarioId = candidato.estagiarioId;
      if (!estagiarioId) {
        estagiarioId = await estagiariosService.add({
          nome: candidato.nome.trim(),
          telefone1: candidato.telefone.replace(/\D/g, ''),
          email: '',
          uf: 'DF',
          cidade: selectedEntrevista.cidade,
          bairro: selectedEntrevista.bairro,
          endereco: selectedEntrevista.endereco,
          grauInstrucao: 'medio',
          curso: selectedEntrevista.tituloVaga.trim(),
          status: 'ativo',
          estagioValorBolsa: selectedEntrevista.valorBolsa.trim(),
          estagioHorarioEntrada: horarios.entrada,
          estagioHorarioSaida: horarios.saida,
        });
        await vinculacoesService.vincularEstagiario(
          selectedEntrevista.clienteId,
          estagiarioId
        );
        await entrevistaCandidatosService.update(candidato.id, {
          estagiarioId,
          status: 'contrato_pendente',
        });
      }
      const url = `${window.location.origin}/formulario-contrato-estagio?clienteId=${encodeURIComponent(selectedEntrevista.clienteId)}&estagiarioId=${encodeURIComponent(estagiarioId)}`;
      await navigator.clipboard.writeText(url);
      await refreshCandidatos(selectedEntrevista.id);
      toast.success('Link do contrato copiado.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar link de contrato.');
    } finally {
      setLoadingAction(false);
    }
  };

  const goToPreviousWeek = () => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const goToNextWeek = () => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStartMonday(new Date()));
  };

  return (
    <ProtectedRoute>
      <AdminRoute>
        <Head>
          <title>Entrevistas | DF Estágios</title>
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
          <PainelHeader />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400">
                  Entrevistas
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Semana de {weekLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goToPreviousWeek}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={goToCurrentWeek}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={goToNextWeek}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  Próxima
                </button>
                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="bg-[#004085] hover:bg-[#0056B3] text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Nova entrevista
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400" />
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  Carregando entrevistas...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {weekDays.map((day, index) => {
                  const iso = toIsoDate(day);
                  const dayEntrevistas = entrevistasByDay.get(iso) ?? [];
                  const isToday = iso === toIsoDate(new Date());
                  return (
                    <div
                      key={iso}
                      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-h-[420px] flex flex-col"
                    >
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {WEEKDAY_SHORT[index]}
                          </p>
                          <p
                            className={`text-lg font-bold ${
                              isToday
                                ? 'text-red-500'
                                : 'text-[#004085] dark:text-blue-400'
                            }`}
                          >
                            {day.getDate()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCreateModal(iso)}
                          className="text-xs text-[#004085] dark:text-blue-400 hover:underline"
                        >
                          + Nova
                        </button>
                      </div>
                      <div className="p-3 space-y-2 flex-1">
                        {dayEntrevistas.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                            Sem entrevistas
                          </p>
                        ) : (
                          dayEntrevistas.map((entrevista) => (
                            <button
                              key={entrevista.id}
                              type="button"
                              onClick={() => void openDetailModal(entrevista)}
                              className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-slate-700/60 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-2 transition-colors"
                            >
                              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 uppercase truncate">
                                {entrevista.empresaNome}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {entrevista.quantidadeVagas} vaga(s) ·{' '}
                                {entrevista.tipoVaga === 'nova' ? 'Nova' : 'Reposição'}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>

        <AnimatedModal open={showFormModal} onClose={closeFormModal}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400 mb-4">
              {editingEntrevista ? 'Editar entrevista' : 'Nova entrevista'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Cliente *</label>
                <select
                  value={formData.clienteId}
                  onChange={(e) => handleClienteChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nomeFantasia || cliente.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Quantidade de vagas *</label>
                <input
                  type="number"
                  min={1}
                  value={formData.quantidadeVagas}
                  onChange={(e) =>
                    setFormData({ ...formData, quantidadeVagas: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Tipo de vaga *</label>
                <select
                  value={formData.tipoVaga}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipoVaga: e.target.value as EntrevistaTipoVaga,
                    })
                  }
                  className={inputClass}
                >
                  <option value="nova">Nova</option>
                  <option value="reposicao">Reposição</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Data da entrevista *</label>
                <input
                  type="date"
                  value={formData.dataEntrevista}
                  onChange={(e) =>
                    setFormData({ ...formData, dataEntrevista: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Horário da entrevista *</label>
                <input
                  type="text"
                  placeholder="09h ou 14h"
                  value={formData.horarioEntrevista}
                  onChange={(e) =>
                    setFormData({ ...formData, horarioEntrevista: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Título da vaga *</label>
                <input
                  type="text"
                  value={formData.tituloVaga}
                  onChange={(e) =>
                    setFormData({ ...formData, tituloVaga: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Horário de trabalho</label>
                <input
                  type="text"
                  placeholder="08:00 às 14:00 - Segunda à Sexta"
                  value={formData.horarioTrabalho}
                  onChange={(e) =>
                    setFormData({ ...formData, horarioTrabalho: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Valor da bolsa</label>
                <input
                  type="text"
                  value={formData.valorBolsa}
                  onChange={(e) =>
                    setFormData({ ...formData, valorBolsa: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as EntrevistaStatus,
                    })
                  }
                  className={inputClass}
                >
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Endereço</label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) =>
                    setFormData({ ...formData, endereco: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Bairro</label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) =>
                    setFormData({ ...formData, bairro: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Cidade</label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) =>
                    setFormData({ ...formData, cidade: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>CEP</label>
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) =>
                    setFormData({ ...formData, cep: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Link Google Maps</label>
                <input
                  type="url"
                  value={formData.googleMapsLink}
                  onChange={(e) =>
                    setFormData({ ...formData, googleMapsLink: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Ponto de referência</label>
                <input
                  type="text"
                  value={formData.pontoReferencia}
                  onChange={(e) =>
                    setFormData({ ...formData, pontoReferencia: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Atividades</label>
                <textarea
                  rows={3}
                  value={formData.atividades}
                  onChange={(e) =>
                    setFormData({ ...formData, atividades: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Requisitos</label>
                <textarea
                  rows={4}
                  placeholder="Um requisito por linha"
                  value={formData.requisitos}
                  onChange={(e) =>
                    setFormData({ ...formData, requisitos: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            {selectedCliente && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Empresa selecionada: {selectedCliente.nomeFantasia || selectedCliente.razaoSocial}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeFormModal}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEntrevista()}
                disabled={loadingAction}
                className="px-4 py-2 rounded-lg bg-[#004085] hover:bg-[#0056B3] text-white disabled:opacity-60"
              >
                Salvar
              </button>
            </div>
          </div>
        </AnimatedModal>

        <AnimatedModal open={Boolean(selectedEntrevista)} onClose={closeDetailModal}>
          {selectedEntrevista && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400 uppercase">
                    {selectedEntrevista.empresaNome}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {selectedEntrevista.quantidadeVagas} vaga(s) ·{' '}
                    {selectedEntrevista.tipoVaga === 'nova' ? 'Nova' : 'Reposição'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedEntrevista)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteEntrevista(selectedEntrevista)}
                    className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-sm"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">Endereço</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {[selectedEntrevista.endereco, selectedEntrevista.bairro, selectedEntrevista.cidade]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 dark:text-gray-200">Ponto de referência</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {selectedEntrevista.pontoReferencia?.trim() || '-'}
                  </p>
                </div>
                {selectedEntrevista.googleMapsLink?.trim() && (
                  <div className="sm:col-span-2">
                    <a
                      href={selectedEntrevista.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#004085] dark:text-blue-400 hover:underline break-all"
                    >
                      Abrir no Google Maps
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold text-[#004085] dark:text-blue-400">
                    Mensagem para candidatos
                  </h3>
                  <button
                    type="button"
                    onClick={() => void handleCopyMessage()}
                    className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    Copiar
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 font-sans">
                  {whatsappMessage}
                </pre>
              </div>

              <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-bold text-[#004085] dark:text-blue-400 mb-3">
                  Candidatos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={novoCandidatoNome}
                    onChange={(e) => setNovoCandidatoNome(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Telefone"
                    value={novoCandidatoTelefone}
                    onChange={(e) =>
                      setNovoCandidatoTelefone(maskPhone(e.target.value))
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddCandidato()}
                    disabled={loadingAction}
                    className="px-4 py-2 rounded-lg bg-[#004085] hover:bg-[#0056B3] text-white disabled:opacity-60"
                  >
                    Adicionar
                  </button>
                </div>

                {loadingCandidatos ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
                ) : candidatos.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhum candidato cadastrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {candidatos.map((candidato) => (
                      <div
                        key={candidato.id}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {candidato.nome}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {maskPhone(candidato.telefone)}
                          </p>
                          <p className="text-xs mt-1 text-[#004085] dark:text-blue-400">
                            {ENTREVISTA_CANDIDATO_STATUS_LABELS[candidato.status]}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSelectCandidato(candidato)}
                            disabled={loadingAction || candidato.status === 'contrato_preenchido'}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
                          >
                            Selecionar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleGenerateContractLink(candidato)}
                            disabled={
                              loadingAction ||
                              (candidato.status !== 'selecionado' &&
                                candidato.status !== 'contrato_pendente' &&
                                candidato.status !== 'contrato_preenchido')
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#004085] hover:bg-[#0056B3] text-white text-sm disabled:opacity-50"
                          >
                            {candidato.status === 'contrato_preenchido'
                              ? 'Contrato preenchido'
                              : 'Gerar link contrato'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimatedModal>
      </AdminRoute>
    </ProtectedRoute>
  );
}
