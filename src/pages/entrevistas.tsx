import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import PainelHeader from '../components/PainelHeader';
import { AnimatedModal } from '../components/AnimatedModal';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import {
  clientesService,
  clienteContratoLinksService,
  cancelContratoLinkTracking,
  entrevistaCandidatosService,
  entrevistasService,
  estagiariosService,
} from '../services/firebase';
import {
  buildEntrevistaConfirmacaoMessage,
  buildEntrevistaWhatsappMessage,
  buildRelatorioDiario,
  getDataCalendario,
  getWeekStartMonday,
  getWeekdayDatesMonToFri,
  toIsoDate,
} from '../lib/entrevistaMessage';
import type {
  Cliente,
  ClienteContratoLink,
  ClienteFilial,
  Entrevista,
  EntrevistaCandidato,
  EntrevistaCandidatoStatus,
  EntrevistaStatus,
  EntrevistaTipoEntrevista,
  EntrevistaTipoVaga,
  Estagiario,
} from '../types/firebase';
import {
  ENTREVISTA_CANDIDATO_STATUS_LABELS,
} from '../types/firebase';

const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const;

type ContratoFiltro = 'todos' | 'pendente' | 'assinado';

interface ContratoLinkItem {
  id: string;
  empresaNome: string;
  candidatoNome: string;
  telefone: string;
  status: EntrevistaCandidatoStatus;
  link: string;
  estagiarioId?: string;
  clienteId?: string;
  sourceType: 'entrevista' | 'cliente';
  sourceId: string;
}

const emptyForm = {
  clienteId: '',
  filialId: '',
  quantidadeVagas: '1',
  tipoVaga: 'nova' as EntrevistaTipoVaga,
  endereco: '',
  bairro: '',
  cidade: '',
  cep: '',
  googleMapsLink: '',
  pontoReferencia: '',
  responsavelEntrevista: '',
  tipoEntrevista: 'presencial' as EntrevistaTipoEntrevista,
  dataCalendario: '',
  dataEntrevista: '',
  horarioEntrevista: '',
  tituloVaga: '',
  horarioTrabalho: '',
  valorBolsa: '',
  beneficios: '',
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

function buildWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

function getClienteDisplayName(cliente: Cliente): string {
  return cliente.nomeFantasia?.trim() || cliente.razaoSocial;
}

function getFilialDisplayName(filial: ClienteFilial): string {
  return filial.nomeFantasia?.trim() || filial.razaoSocial;
}

function resolveEmpresaNome(cliente: Cliente, filialId: string): string {
  if (filialId) {
    const filial = cliente.filiais?.find((item) => item.id === filialId);
    if (filial) return getFilialDisplayName(filial);
  }
  return getClienteDisplayName(cliente);
}

function getClienteEnderecoFields(
  cliente: Cliente,
  filialId: string
): Pick<typeof emptyForm, 'endereco' | 'bairro' | 'cidade' | 'cep'> {
  if (filialId) {
    const filial = cliente.filiais?.find((item) => item.id === filialId);
    if (filial) {
      return {
        endereco: filial.endereco ?? '',
        bairro: filial.bairro,
        cidade: filial.cidade,
        cep: filial.cep,
      };
    }
  }
  return {
    endereco: cliente.endereco ?? '',
    bairro: cliente.bairro,
    cidade: cliente.cidade,
    cep: cliente.cep,
  };
}

function matchesSearchTerm(value: string, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return false;
  const cnpjDigits = term.replace(/\D/g, '');
  const fieldValue = value.trim().toLowerCase();
  if (fieldValue.includes(normalized)) return true;
  if (cnpjDigits.length >= 4 && value.replace(/\D/g, '').includes(cnpjDigits)) {
    return true;
  }
  return false;
}

function matchesClienteMatrizSearch(cliente: Cliente, term: string): boolean {
  const fields = [
    getClienteDisplayName(cliente),
    cliente.razaoSocial,
    cliente.nomeFantasia,
    cliente.cnpj,
    cliente.cidade,
    cliente.bairro,
  ];
  return fields.some((field) => matchesSearchTerm(field, term));
}

function matchesFilialSearch(filial: ClienteFilial, term: string): boolean {
  const fields = [
    getFilialDisplayName(filial),
    filial.razaoSocial,
    filial.nomeFantasia,
    filial.cnpj,
    filial.cidade,
    filial.bairro,
  ];
  return fields.some((field) => matchesSearchTerm(field, term));
}

type ClienteSearchOption =
  | { type: 'matriz'; cliente: Cliente }
  | { type: 'filial'; cliente: Cliente; filial: ClienteFilial };

function buildClienteSearchOptions(clientes: Cliente[], term: string): ClienteSearchOption[] {
  const normalized = term.trim();
  if (!normalized) return [];
  const options: ClienteSearchOption[] = [];
  const sorted = [...clientes].sort((a, b) =>
    getClienteDisplayName(a).localeCompare(getClienteDisplayName(b), 'pt-BR')
  );
  sorted.forEach((cliente) => {
    if (matchesClienteMatrizSearch(cliente, normalized)) {
      options.push({ type: 'matriz', cliente });
    }
    (cliente.filiais ?? []).forEach((filial) => {
      if (matchesFilialSearch(filial, normalized)) {
        options.push({ type: 'filial', cliente, filial });
      }
    });
  });
  return options;
}

function resolveCandidatoStatus(
  candidato: EntrevistaCandidato,
  hasContract: boolean
): EntrevistaCandidatoStatus {
  if (
    hasContract &&
    (candidato.status === 'contrato_pendente' ||
      candidato.status === 'contrato_preenchido')
  ) {
    return 'contrato_preenchido';
  }
  if (
    candidato.estagiarioId &&
    (candidato.status === 'contrato_pendente' ||
      candidato.status === 'contrato_preenchido')
  ) {
    return 'contrato_pendente';
  }
  return candidato.status;
}

function estagiarioHasContratoPreenchido(estagiario: Estagiario | null): boolean {
  if (!estagiario) return false;
  return Boolean(
    estagiario.contratoPdfDrivePath?.trim() ||
      (estagiario.cpf?.trim() && estagiario.estagioDataInicio?.trim())
  );
}

function buildVinculadoKey(clienteId: string, estagiarioId: string) {
  return `${clienteId}:${estagiarioId}`;
}

function dedupeContratoLinks(items: ContratoLinkItem[]): ContratoLinkItem[] {
  const byKey = new Map<string, ContratoLinkItem>();
  items.forEach((item) => {
    if (!item.estagiarioId || !item.clienteId) {
      byKey.set(item.id, item);
      return;
    }
    const key = buildVinculadoKey(item.clienteId, item.estagiarioId);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      return;
    }
    const preferCurrent =
      item.status === 'contrato_preenchido' &&
      existing.status !== 'contrato_preenchido';
    if (preferCurrent) {
      byKey.set(key, item);
      return;
    }
    if (
      item.sourceType === 'entrevista' &&
      existing.sourceType === 'cliente' &&
      item.status === existing.status
    ) {
      byKey.set(key, item);
    }
  });
  return Array.from(byKey.values());
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
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);
  const clienteSearchRef = useRef<HTMLDivElement>(null);
  const [selectedEntrevista, setSelectedEntrevista] = useState<Entrevista | null>(
    null
  );
  const [candidatos, setCandidatos] = useState<EntrevistaCandidato[]>([]);
  const [loadingCandidatos, setLoadingCandidatos] = useState(false);
  const [novoCandidatoNome, setNovoCandidatoNome] = useState('');
  const [novoCandidatoTelefone, setNovoCandidatoTelefone] = useState('');
  const [editingCandidato, setEditingCandidato] = useState<EntrevistaCandidato | null>(
    null
  );
  const [editCandidatoNome, setEditCandidatoNome] = useState('');
  const [editCandidatoTelefone, setEditCandidatoTelefone] = useState('');
  const [allCandidatos, setAllCandidatos] = useState<EntrevistaCandidato[]>([]);
  const [showContratosModal, setShowContratosModal] = useState(false);
  const [showHojeModal, setShowHojeModal] = useState(false);
  const [showTodasModal, setShowTodasModal] = useState(false);
  const [todasSearch, setTodasSearch] = useState('');
  const [contratoFiltro, setContratoFiltro] = useState<ContratoFiltro>('todos');
  const [contratoLinks, setContratoLinks] = useState<ContratoLinkItem[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(false);
  const [draggingEntrevistaId, setDraggingEntrevistaId] = useState<string | null>(null);
  const [dropTargetIso, setDropTargetIso] = useState<string | null>(null);
  const skipClickAfterDragRef = useRef(false);
  const candidatosRequestRef = useRef(0);

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
      const candidatosLists = await Promise.all(
        entrevistasData.map((entrevista) =>
          entrevista.id
            ? entrevistaCandidatosService.getByEntrevistaId(entrevista.id)
            : Promise.resolve([])
        )
      );
      setAllCandidatos(candidatosLists.flat());
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clienteSearchRef.current &&
        !clienteSearchRef.current.contains(event.target as Node)
      ) {
        setClienteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const entrevistasByDay = useMemo(() => {
    const weekIsoSet = new Set(weekDays.map((day) => toIsoDate(day)));
    const map = new Map<string, Entrevista[]>();
    weekDays.forEach((day) => map.set(toIsoDate(day), []));
    entrevistas.forEach((entrevista) => {
      const calIso = getDataCalendario(entrevista);
      if (!weekIsoSet.has(calIso)) return;
      const list = map.get(calIso) ?? [];
      list.push(entrevista);
      map.set(calIso, list);
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

  const clienteSearchOptions = useMemo(
    () => buildClienteSearchOptions(clientes, clienteSearch),
    [clientes, clienteSearch]
  );

  const selectedFilial = useMemo(() => {
    if (!selectedCliente || !formData.filialId) return null;
    return selectedCliente.filiais?.find((filial) => filial.id === formData.filialId) ?? null;
  }, [selectedCliente, formData.filialId]);

  const whatsappMessage = useMemo(
    () => (selectedEntrevista ? buildEntrevistaWhatsappMessage(selectedEntrevista) : ''),
    [selectedEntrevista]
  );

  const confirmacaoMessage = useMemo(
    () =>
      selectedEntrevista ? buildEntrevistaConfirmacaoMessage(selectedEntrevista) : '',
    [selectedEntrevista]
  );

  const candidatosByEntrevistaId = useMemo(() => {
    const map = new Map<string, EntrevistaCandidato[]>();
    allCandidatos.forEach((candidato) => {
      const list = map.get(candidato.entrevistaId) ?? [];
      list.push(candidato);
      map.set(candidato.entrevistaId, list);
    });
    return map;
  }, [allCandidatos]);

  const filteredTodasEntrevistas = useMemo(() => {
    const term = todasSearch.trim().toLowerCase();
    const sorted = [...entrevistas].sort((a, b) => {
      const aDate = getDataCalendario(a);
      const bDate = getDataCalendario(b);
      return bDate.localeCompare(aDate, 'pt-BR');
    });
    if (!term) return sorted;
    return sorted.filter((item) => item.empresaNome.toLowerCase().includes(term));
  }, [entrevistas, todasSearch]);

  const entrevistasHoje = useMemo(() => {
    const todayIso = toIsoDate(new Date());
    return entrevistas
      .filter(
        (item) =>
          item.dataEntrevista === todayIso &&
          item.tipoEntrevista !== 'captacao' &&
          item.status !== 'cancelada'
      )
      .sort((a, b) =>
        a.horarioEntrevista.localeCompare(b.horarioEntrevista, 'pt-BR', {
          numeric: true,
        })
      );
  }, [entrevistas]);

  const hojeLabel = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
    []
  );

  const filteredContratoLinks = useMemo(() => {
    if (contratoFiltro === 'todos') return contratoLinks;
    if (contratoFiltro === 'pendente') {
      return contratoLinks.filter((item) => item.status === 'contrato_pendente');
    }
    return contratoLinks.filter((item) => item.status === 'contrato_preenchido');
  }, [contratoLinks, contratoFiltro]);

  const applyClienteSelection = (clienteId: string, filialId: string, searchLabel: string) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente) return;
    const enderecoFields = getClienteEnderecoFields(cliente, filialId);
    setFormData((prev) => ({
      ...prev,
      clienteId,
      filialId,
      ...enderecoFields,
    }));
    setClienteSearch(searchLabel);
    setClienteDropdownOpen(false);
  };

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente) return;
    applyClienteSelection(clienteId, '', getClienteDisplayName(cliente));
  };

  const handleClienteFilialChange = (clienteId: string, filialId: string) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente) return;
    const filial = cliente.filiais?.find((item) => item.id === filialId);
    if (!filial) return;
    applyClienteSelection(
      clienteId,
      filialId,
      `${getFilialDisplayName(filial)} — ${getClienteDisplayName(cliente)}`
    );
  };

  const handleFilialChange = (filialId: string) => {
    const cliente = clientes.find((item) => item.id === formData.clienteId);
    if (!cliente) return;
    const enderecoFields = getClienteEnderecoFields(cliente, filialId);
    setFormData((prev) => ({
      ...prev,
      filialId,
      ...enderecoFields,
    }));
    if (filialId) {
      const filial = cliente.filiais?.find((item) => item.id === filialId);
      if (filial) {
        setClienteSearch(`${getFilialDisplayName(filial)} — ${getClienteDisplayName(cliente)}`);
      }
    } else {
      setClienteSearch(getClienteDisplayName(cliente));
    }
  };

  const openCreateModal = (isoDate?: string) => {
    const defaultDate = isoDate ?? toIsoDate(new Date());
    setEditingEntrevista(null);
    setClienteSearch('');
    setClienteDropdownOpen(false);
    setFormData({
      ...emptyForm,
      dataCalendario: defaultDate,
      dataEntrevista: defaultDate,
    });
    setShowFormModal(true);
  };

  const openEditModal = (entrevista: Entrevista) => {
    const cliente = clientes.find((item) => item.id === entrevista.clienteId);
    const filial = entrevista.filialId
      ? cliente?.filiais?.find((item) => item.id === entrevista.filialId)
      : null;
    setEditingEntrevista(entrevista);
    setClienteSearch(
      filial && cliente
        ? `${getFilialDisplayName(filial)} — ${getClienteDisplayName(cliente)}`
        : cliente
          ? getClienteDisplayName(cliente)
          : entrevista.empresaNome
    );
    setClienteDropdownOpen(false);
    setFormData({
      clienteId: entrevista.clienteId,
      filialId: entrevista.filialId ?? '',
      quantidadeVagas: String(entrevista.quantidadeVagas),
      tipoVaga: entrevista.tipoVaga,
      endereco: entrevista.endereco,
      bairro: entrevista.bairro,
      cidade: entrevista.cidade,
      cep: entrevista.cep,
      googleMapsLink: entrevista.googleMapsLink ?? '',
      pontoReferencia: entrevista.pontoReferencia ?? '',
      responsavelEntrevista: entrevista.responsavelEntrevista ?? '',
      tipoEntrevista: entrevista.tipoEntrevista ?? 'presencial',
      dataCalendario: getDataCalendario(entrevista),
      dataEntrevista: entrevista.dataEntrevista,
      horarioEntrevista: entrevista.horarioEntrevista,
      tituloVaga: entrevista.tituloVaga,
      horarioTrabalho: entrevista.horarioTrabalho,
      valorBolsa: entrevista.valorBolsa,
      beneficios: entrevista.beneficios ?? '',
      atividades: entrevista.atividades,
      requisitos: entrevista.requisitos,
      status: entrevista.status,
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingEntrevista(null);
    setClienteSearch('');
    setClienteDropdownOpen(false);
    setFormData(emptyForm);
  };

  const handleSaveEntrevista = async () => {
    if (!formData.clienteId || !formData.tituloVaga.trim()) {
      toast.error('Preencha cliente e título da vaga.');
      return;
    }
    if (!formData.dataCalendario.trim()) {
      toast.error('Preencha a data no calendário.');
      return;
    }
    if (formData.tipoEntrevista !== 'captacao') {
      if (!formData.dataEntrevista || !formData.horarioEntrevista.trim()) {
        toast.error('Preencha data e horário da entrevista.');
        return;
      }
    }
    const cliente = clientes.find((item) => item.id === formData.clienteId);
    if (!cliente) {
      toast.error('Cliente não encontrado.');
      return;
    }
    const payload = {
      clienteId: formData.clienteId,
      filialId: formData.filialId,
      empresaNome: resolveEmpresaNome(cliente, formData.filialId),
      quantidadeVagas: Math.max(1, parseInt(formData.quantidadeVagas, 10) || 1),
      tipoVaga: formData.tipoVaga,
      endereco: formData.endereco.trim(),
      bairro: formData.bairro.trim(),
      cidade: formData.cidade.trim(),
      cep: formData.cep.trim(),
      googleMapsLink: formData.googleMapsLink.trim(),
      pontoReferencia: formData.pontoReferencia.trim(),
      responsavelEntrevista: formData.responsavelEntrevista.trim(),
      tipoEntrevista: formData.tipoEntrevista,
      dataCalendario:
        formData.dataCalendario.trim() ||
        formData.dataEntrevista.trim() ||
        toIsoDate(new Date()),
      dataEntrevista:
        formData.dataEntrevista.trim() || toIsoDate(new Date()),
      horarioEntrevista:
        formData.tipoEntrevista === 'captacao'
          ? formData.horarioEntrevista.trim() || 'Á combinar'
          : formData.horarioEntrevista.trim(),
      tituloVaga: formData.tituloVaga.trim(),
      horarioTrabalho: formData.horarioTrabalho.trim(),
      valorBolsa: formData.valorBolsa.trim(),
      beneficios: formData.beneficios.trim(),
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

  const handleDuplicateEntrevista = async (entrevista: Entrevista) => {
    if (!entrevista.id) return;
    try {
      setLoadingAction(true);
      const payload = {
        clienteId: entrevista.clienteId,
        filialId: entrevista.filialId ?? '',
        empresaNome: entrevista.empresaNome,
        quantidadeVagas: entrevista.quantidadeVagas,
        tipoVaga: entrevista.tipoVaga,
        endereco: entrevista.endereco,
        bairro: entrevista.bairro,
        cidade: entrevista.cidade,
        cep: entrevista.cep,
        googleMapsLink: entrevista.googleMapsLink ?? '',
        pontoReferencia: entrevista.pontoReferencia ?? '',
        responsavelEntrevista: entrevista.responsavelEntrevista ?? '',
        tipoEntrevista: entrevista.tipoEntrevista ?? 'presencial',
        dataCalendario: getDataCalendario(entrevista),
        dataEntrevista: entrevista.dataEntrevista,
        horarioEntrevista: entrevista.horarioEntrevista,
        tituloVaga: entrevista.tituloVaga,
        horarioTrabalho: entrevista.horarioTrabalho,
        valorBolsa: entrevista.valorBolsa,
        beneficios: entrevista.beneficios ?? '',
        atividades: entrevista.atividades,
        requisitos: entrevista.requisitos,
        status: 'agendada' as EntrevistaStatus,
        duplicatedFromId: entrevista.id,
      };
      const id = await entrevistasService.add(payload);
      const candidatosOrigem = await entrevistaCandidatosService.getByEntrevistaId(
        entrevista.id
      );
      const novosCandidatos = await Promise.all(
        candidatosOrigem.map(async (candidato) => {
          const novoId = await entrevistaCandidatosService.add({
            entrevistaId: id,
            clienteId: candidato.clienteId,
            nome: candidato.nome,
            telefone: candidato.telefone,
            status: 'interessado',
          });
          return {
            id: novoId,
            entrevistaId: id,
            clienteId: candidato.clienteId,
            nome: candidato.nome,
            telefone: candidato.telefone,
            status: 'interessado' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        })
      );
      setEntrevistas((prev) => [
        ...prev,
        { id, ...payload, createdAt: new Date(), updatedAt: new Date() },
      ]);
      if (novosCandidatos.length > 0) {
        setAllCandidatos((prev) => [...prev, ...novosCandidatos]);
      }
      toast.success('Entrevista duplicada.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao duplicar entrevista.');
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
      setAllCandidatos((prev) =>
        prev.filter((item) => item.entrevistaId !== entrevista.id)
      );
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
    const requestId = ++candidatosRequestRef.current;
    setLoadingCandidatos(true);
    try {
      const list = await entrevistaCandidatosService.getByEntrevistaId(entrevistaId);
      const enriched = await Promise.all(
        list.map(async (candidato) => {
          if (!candidato.estagiarioId) return candidato;
          const estagiario = await estagiariosService.getById(candidato.estagiarioId);
          const hasContract = estagiarioHasContratoPreenchido(estagiario);
          const status = resolveCandidatoStatus(candidato, hasContract);
          if (status !== candidato.status && candidato.id) {
            await entrevistaCandidatosService.update(candidato.id, { status });
            return { ...candidato, status };
          }
          return { ...candidato, status };
        })
      );
      if (requestId !== candidatosRequestRef.current) return;
      setCandidatos(enriched);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar candidatos.');
    } finally {
      if (requestId === candidatosRequestRef.current) {
        setLoadingCandidatos(false);
      }
    }
  }, []);

  const openDetailModal = async (entrevista: Entrevista) => {
    setSelectedEntrevista(entrevista);
    setCandidatos([]);
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

  const handleCopyConfirmacao = async () => {
    if (!confirmacaoMessage || typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(confirmacaoMessage);
      toast.success('Mensagem de confirmação copiada.');
    } catch {
      toast.error('Não foi possível copiar.');
      toast(confirmacaoMessage, { duration: 10000 });
    }
  };

  const handleCopyRelatorioDia = async (iso: string) => {
    const relatorio = buildRelatorioDiario(iso, entrevistas, candidatosByEntrevistaId);
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(relatorio);
      toast.success('Relatório copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
      toast(relatorio, { duration: 10000 });
    }
  };

  const loadContratoLinks = useCallback(async () => {
    setLoadingContratos(true);
    try {
      const linked = allCandidatos.filter(
        (candidato) =>
          candidato.status === 'contrato_pendente' ||
          candidato.status === 'contrato_preenchido'
      );
      const [entrevistaItems, clienteLinksData] = await Promise.all([
        Promise.all(
          linked.map(async (candidato) => {
            const entrevista = entrevistas.find((item) => item.id === candidato.entrevistaId);
            if (!entrevista?.id || !candidato.id || !candidato.estagiarioId) return null;
            const estagiario = await estagiariosService.getById(candidato.estagiarioId);
            const status = resolveCandidatoStatus(
              candidato,
              estagiarioHasContratoPreenchido(estagiario)
            );
            const filialQuery = entrevista.filialId
              ? `&filialId=${encodeURIComponent(entrevista.filialId)}`
              : '';
            const link = `${window.location.origin}/formulario-contrato-estagio?clienteId=${encodeURIComponent(entrevista.clienteId)}&estagiarioId=${encodeURIComponent(candidato.estagiarioId)}${filialQuery}`;
            return {
              id: `entrevista-${candidato.id}`,
              empresaNome: entrevista.empresaNome,
              candidatoNome: estagiario?.nome?.trim() || candidato.nome,
              telefone:
                estagiario?.telefone1?.trim() ||
                candidato.telefone?.trim() ||
                '',
              status,
              link,
              estagiarioId: candidato.estagiarioId,
              clienteId: entrevista.clienteId,
              sourceType: 'entrevista',
              sourceId: candidato.id,
            } satisfies ContratoLinkItem;
          })
        ),
        clienteContratoLinksService.getAll().catch((error) => {
          console.error(error);
          return [] as ClienteContratoLink[];
        }),
      ]);
      const validEntrevistaItems = entrevistaItems.filter(
        (item): item is NonNullable<typeof item> => item !== null
      );
      const trackedEstagiarioKeys = new Set(
        validEntrevistaItems.map((item) =>
          buildVinculadoKey(item.clienteId!, item.estagiarioId!)
        )
      );
      const clienteItems = await Promise.all(
        clienteLinksData.map(async (clienteLink) => {
          if (!clienteLink.id) return null;
          const linkKey = buildVinculadoKey(
            clienteLink.clienteId,
            clienteLink.estagiarioId
          );
          if (trackedEstagiarioKeys.has(linkKey)) {
            return null;
          }
          const cliente =
            clientes.find((item) => item.id === clienteLink.clienteId) ??
            (await clientesService.getById(clienteLink.clienteId));
          if (!cliente) return null;
          const estagiario = await estagiariosService.getById(clienteLink.estagiarioId);
          if (!estagiario) return null;
          const hasContract = estagiarioHasContratoPreenchido(estagiario);
          const status: EntrevistaCandidatoStatus = hasContract
            ? 'contrato_preenchido'
            : 'contrato_pendente';
          const filialQuery = clienteLink.filialId
            ? `&filialId=${encodeURIComponent(clienteLink.filialId)}`
            : '';
          const link = `${window.location.origin}/formulario-contrato-estagio?clienteId=${encodeURIComponent(clienteLink.clienteId)}&estagiarioId=${encodeURIComponent(clienteLink.estagiarioId)}${filialQuery}`;
          return {
            id: `cliente-${clienteLink.id}`,
            empresaNome: cliente.nomeFantasia || cliente.razaoSocial,
            candidatoNome: estagiario.nome?.trim() || clienteLink.nome,
            telefone:
              estagiario.telefone1?.trim() ||
              clienteLink.telefone?.trim() ||
              '',
            status,
            link,
            estagiarioId: clienteLink.estagiarioId,
            clienteId: clienteLink.clienteId,
            sourceType: 'cliente',
            sourceId: clienteLink.id,
          } satisfies ContratoLinkItem;
        })
      );
      const merged = [...validEntrevistaItems, ...clienteItems].filter(
        (item): item is NonNullable<typeof item> => item !== null
      );
      setContratoLinks(dedupeContratoLinks(merged));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar links de contrato.');
    } finally {
      setLoadingContratos(false);
    }
  }, [allCandidatos, entrevistas, clientes]);

  const openContratosModal = () => {
    setShowContratosModal(true);
    void loadContratoLinks();
  };

  const handleCopyContratoLink = async (link: string) => {
    if (!link || typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const handleCancelContratoLink = async (item: ContratoLinkItem) => {
    if (!item.estagiarioId || !item.clienteId) return;
    if (item.status === 'contrato_preenchido') {
      const confirmed = window.confirm(
        'Este contrato já foi preenchido. Deseja remover da lista de acompanhamento?'
      );
      if (!confirmed) return;
    }
    try {
      setLoadingContratos(true);
      await cancelContratoLinkTracking(item.clienteId, item.estagiarioId);
      setContratoLinks((prev) =>
        prev.filter(
          (link) =>
            !(
              link.estagiarioId === item.estagiarioId &&
              link.clienteId === item.clienteId
            )
        )
      );
      setAllCandidatos((prev) =>
        prev.map((candidato) =>
          candidato.estagiarioId === item.estagiarioId &&
          (candidato.status === 'contrato_pendente' ||
            candidato.status === 'contrato_preenchido')
            ? { ...candidato, status: 'selecionado' }
            : candidato
        )
      );
      toast.success('Link de contrato cancelado.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao cancelar link de contrato.');
    } finally {
      setLoadingContratos(false);
    }
  };

  const handleMoveEntrevista = async (entrevistaId: string, targetIso: string) => {
    const entrevista = entrevistas.find((item) => item.id === entrevistaId);
    if (!entrevista?.id || getDataCalendario(entrevista) === targetIso) {
      setDraggingEntrevistaId(null);
      setDropTargetIso(null);
      return;
    }
    try {
      setLoadingAction(true);
      await entrevistasService.update(entrevista.id, { dataCalendario: targetIso });
      setEntrevistas((prev) =>
        prev.map((item) =>
          item.id === entrevista.id ? { ...item, dataCalendario: targetIso } : item
        )
      );
      if (selectedEntrevista?.id === entrevista.id) {
        setSelectedEntrevista({ ...selectedEntrevista, dataCalendario: targetIso });
      }
      toast.success('Entrevista movida no calendário.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao mover entrevista.');
    } finally {
      setLoadingAction(false);
      setDraggingEntrevistaId(null);
      setDropTargetIso(null);
    }
  };

  const handleEntrevistaCardClick = (entrevista: Entrevista) => {
    if (skipClickAfterDragRef.current) {
      skipClickAfterDragRef.current = false;
      return;
    }
    void openDetailModal(entrevista);
  };

  const handleOpenTodasEntrevista = async (entrevista: Entrevista) => {
    setShowTodasModal(false);
    setTodasSearch('');
    await openDetailModal(entrevista);
  };

  const handleOpenHojeEntrevista = async (entrevista: Entrevista) => {
    setShowHojeModal(false);
    await openDetailModal(entrevista);
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
      setAllCandidatos((prev) => [
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

  const handleDeleteCandidato = async (candidato: EntrevistaCandidato) => {
    if (!candidato.id || !selectedEntrevista?.id) return;
    if (!confirm(`Excluir candidato ${candidato.nome}?`)) return;
    try {
      setLoadingAction(true);
      await entrevistaCandidatosService.delete(candidato.id);
      setCandidatos((prev) => prev.filter((item) => item.id !== candidato.id));
      setAllCandidatos((prev) => prev.filter((item) => item.id !== candidato.id));
      if (editingCandidato?.id === candidato.id) {
        setEditingCandidato(null);
        setEditCandidatoNome('');
        setEditCandidatoTelefone('');
      }
      toast.success('Candidato excluído.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir candidato.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStartEditCandidato = (candidato: EntrevistaCandidato) => {
    setEditingCandidato(candidato);
    setEditCandidatoNome(candidato.nome);
    setEditCandidatoTelefone(maskPhone(candidato.telefone));
  };

  const handleCancelEditCandidato = () => {
    setEditingCandidato(null);
    setEditCandidatoNome('');
    setEditCandidatoTelefone('');
  };

  const handleSaveEditCandidato = async () => {
    if (!editingCandidato?.id || !editCandidatoNome.trim() || !editCandidatoTelefone.trim()) {
      toast.error('Informe nome e telefone do candidato.');
      return;
    }
    try {
      setLoadingAction(true);
      const payload = {
        nome: editCandidatoNome.trim(),
        telefone: editCandidatoTelefone.replace(/\D/g, ''),
      };
      await entrevistaCandidatosService.update(editingCandidato.id, payload);
      const updateItem = (item: EntrevistaCandidato) =>
        item.id === editingCandidato.id ? { ...item, ...payload } : item;
      setCandidatos((prev) => prev.map(updateItem));
      setAllCandidatos((prev) => prev.map(updateItem));
      handleCancelEditCandidato();
      toast.success('Candidato atualizado.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar candidato.');
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
      let estagiarioId = candidato.estagiarioId;
      if (!estagiarioId) {
        estagiarioId = await estagiariosService.add({
          nome: candidato.nome.trim(),
          telefone1: candidato.telefone.replace(/\D/g, ''),
          email: '',
          uf: 'DF',
          cidade: '',
          bairro: '',
          endereco: '',
          grauInstrucao: 'medio',
          status: 'ativo',
          ...(selectedEntrevista.filialId
            ? { empresaFilialId: selectedEntrevista.filialId }
            : {}),
        });
        await entrevistaCandidatosService.update(candidato.id, {
          estagiarioId,
          status: 'contrato_pendente',
        });
        setAllCandidatos((prev) =>
          prev.map((item) =>
            item.id === candidato.id
              ? { ...item, estagiarioId, status: 'contrato_pendente' }
              : item
          )
        );
      }
      const filialQuery = selectedEntrevista.filialId
        ? `&filialId=${encodeURIComponent(selectedEntrevista.filialId)}`
        : '';
      const url = `${window.location.origin}/formulario-contrato-estagio?clienteId=${encodeURIComponent(selectedEntrevista.clienteId)}&estagiarioId=${encodeURIComponent(estagiarioId)}${filialQuery}`;
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Segure e arraste a entrevista para outro dia da semana
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
                  onClick={() => setShowHojeModal(true)}
                  className="px-3 py-2 rounded-lg border border-[#004085] text-[#004085] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 inline-flex items-center gap-2"
                >
                  Entrevistas de hoje
                  {entrevistasHoje.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#004085] text-white text-xs font-semibold">
                      {entrevistasHoje.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={openContratosModal}
                  className="px-3 py-2 rounded-lg border border-[#004085] text-[#004085] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  Links de contrato
                </button>
                <button
                  type="button"
                  onClick={() => setShowTodasModal(true)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  Todas as entrevistas
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
                      className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg border min-h-[420px] flex flex-col transition-colors ${
                        dropTargetIso === iso
                          ? 'border-[#004085] dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDropTargetIso(iso);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDropTargetIso(iso);
                      }}
                      onDragLeave={(e) => {
                        const related = e.relatedTarget as Node | null;
                        if (related && e.currentTarget.contains(related)) return;
                        if (dropTargetIso === iso) setDropTargetIso(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        skipClickAfterDragRef.current = true;
                        const id =
                          draggingEntrevistaId ||
                          e.dataTransfer.getData('text/plain') ||
                          e.dataTransfer.getData('text/entrevista-id');
                        if (id) void handleMoveEntrevista(id, iso);
                        else {
                          setDraggingEntrevistaId(null);
                          setDropTargetIso(null);
                        }
                      }}
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
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => void handleCopyRelatorioDia(iso)}
                            className="text-xs text-green-700 dark:text-green-400 hover:underline"
                          >
                            Copiar relatório
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreateModal(iso)}
                            className="text-xs text-[#004085] dark:text-blue-400 hover:underline"
                          >
                            + Nova
                          </button>
                        </div>
                      </div>
                      <div
                        className="p-3 space-y-2 flex-1 min-h-[80px]"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDropTargetIso(iso);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          skipClickAfterDragRef.current = true;
                          const id =
                            draggingEntrevistaId ||
                            e.dataTransfer.getData('text/plain') ||
                            e.dataTransfer.getData('text/entrevista-id');
                          if (id) void handleMoveEntrevista(id, iso);
                        }}
                      >
                        {dayEntrevistas.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 pointer-events-none">
                            Sem entrevistas
                          </p>
                        ) : (
                          dayEntrevistas.map((entrevista) => (
                            <div
                              key={entrevista.id}
                              draggable
                              onDragStart={(e) => {
                                if (!entrevista.id) return;
                                skipClickAfterDragRef.current = false;
                                setDraggingEntrevistaId(entrevista.id);
                                e.dataTransfer.setData('text/plain', entrevista.id);
                                e.dataTransfer.setData('text/entrevista-id', entrevista.id);
                                e.dataTransfer.effectAllowed = 'move';
                                if (e.dataTransfer.setDragImage && e.currentTarget instanceof HTMLElement) {
                                  e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                                }
                              }}
                              onDragEnd={() => {
                                setDraggingEntrevistaId(null);
                                setDropTargetIso(null);
                                skipClickAfterDragRef.current = true;
                                window.setTimeout(() => {
                                  skipClickAfterDragRef.current = false;
                                }, 200);
                              }}
                              onClick={() => handleEntrevistaCardClick(entrevista)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleEntrevistaCardClick(entrevista);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className={`w-full text-left rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-slate-700/60 hover:bg-gray-100 dark:hover:bg-slate-700 px-3 py-2 transition-colors cursor-grab active:cursor-grabbing select-none touch-none ${
                                draggingEntrevistaId === entrevista.id
                                  ? 'opacity-40 ring-2 ring-[#004085] dark:ring-blue-400'
                                  : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 uppercase truncate">
                                    {entrevista.empresaNome}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {entrevista.quantidadeVagas} vaga(s) ·{' '}
                                    {entrevista.tipoVaga === 'nova' ? 'Nova' : 'Reposição'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  title="Duplicar entrevista"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    skipClickAfterDragRef.current = true;
                                    void handleDuplicateEntrevista(entrevista);
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  disabled={loadingAction}
                                  className="shrink-0 p-1 rounded text-gray-500 dark:text-gray-400 hover:text-[#004085] dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  >
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                </button>
                              </div>
                            </div>
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
              <div className="sm:col-span-2" ref={clienteSearchRef}>
                <label className={labelClass}>Cliente *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite para buscar empresa..."
                    value={clienteSearch}
                    onChange={(e) => {
                      setClienteSearch(e.target.value);
                      setClienteDropdownOpen(true);
                      if (!e.target.value.trim()) {
                        setFormData((prev) => ({
                          ...prev,
                          clienteId: '',
                          filialId: '',
                        }));
                      }
                    }}
                    onFocus={() => setClienteDropdownOpen(true)}
                    className={inputClass}
                  />
                  {clienteDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 shadow-lg">
                      {!clienteSearch.trim() ? (
                        <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          Digite o nome, CNPJ ou cidade da empresa ou filial.
                        </p>
                      ) : clienteSearchOptions.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          Nenhuma empresa encontrada.
                        </p>
                      ) : (
                        clienteSearchOptions.map((option) => {
                          if (option.type === 'matriz') {
                            const { cliente } = option;
                            const filiaisCount = cliente.filiais?.length ?? 0;
                            const isSelected =
                              formData.clienteId === cliente.id && !formData.filialId;
                            return (
                              <button
                                key={`matriz-${cliente.id}`}
                                type="button"
                                onClick={() => {
                                  if (cliente.id) handleClienteChange(cliente.id);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-[#004085] dark:text-blue-400'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                <span className="font-medium uppercase">
                                  {getClienteDisplayName(cliente)}
                                </span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Matriz · {cliente.cnpj}
                                  {filiaisCount > 0
                                    ? ` · ${filiaisCount} filial${filiaisCount === 1 ? '' : 'is'}`
                                    : ''}
                                </span>
                              </button>
                            );
                          }
                          const { cliente, filial } = option;
                          const isSelected =
                            formData.clienteId === cliente.id &&
                            formData.filialId === filial.id;
                          return (
                            <button
                              key={`filial-${cliente.id}-${filial.id}`}
                              type="button"
                              onClick={() => {
                                if (cliente.id) handleClienteFilialChange(cliente.id, filial.id);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-[#004085] dark:text-blue-400'
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              <span className="font-medium uppercase">
                                {getFilialDisplayName(filial)}
                              </span>
                              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Filial · {filial.cnpj} · {getClienteDisplayName(cliente)}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedCliente && (selectedCliente.filiais?.length ?? 0) > 0 && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Unidade da vaga *</label>
                  <select
                    value={formData.filialId}
                    onChange={(e) => handleFilialChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">
                      Matriz — {getClienteDisplayName(selectedCliente)} ({selectedCliente.cnpj})
                    </option>
                    {(selectedCliente.filiais ?? []).map((filial) => (
                      <option key={filial.id} value={filial.id}>
                        Filial — {getFilialDisplayName(filial)} ({filial.cnpj})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                <label className={labelClass}>Tipo de entrevista *</label>
                <select
                  value={formData.tipoEntrevista}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipoEntrevista: e.target.value as EntrevistaTipoEntrevista,
                    })
                  }
                  className={inputClass}
                >
                  <option value="presencial">Presencial</option>
                  <option value="online">Online</option>
                  <option value="captacao">Captação</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Data no calendário *</label>
                <input
                  type="date"
                  value={formData.dataCalendario}
                  onChange={(e) =>
                    setFormData({ ...formData, dataCalendario: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Data da entrevista {formData.tipoEntrevista !== 'captacao' ? '*' : ''}
                </label>
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
                <label className={labelClass}>
                  Horário da entrevista {formData.tipoEntrevista !== 'captacao' ? '*' : ''}
                </label>
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
                  placeholder="Ex: 700,00"
                  value={formData.valorBolsa}
                  onChange={(e) =>
                    setFormData({ ...formData, valorBolsa: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Benefícios</label>
                <input
                  type="text"
                  placeholder="Ex: Transporte + Alimentação no local"
                  value={formData.beneficios}
                  onChange={(e) =>
                    setFormData({ ...formData, beneficios: e.target.value })
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
                <label className={labelClass}>Responsável pela entrevista</label>
                <input
                  type="text"
                  placeholder="Nome de quem o estagiário deve procurar"
                  value={formData.responsavelEntrevista}
                  onChange={(e) =>
                    setFormData({ ...formData, responsavelEntrevista: e.target.value })
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
                Empresa selecionada: {resolveEmpresaNome(selectedCliente, formData.filialId)}
                {selectedFilial
                  ? ` (Filial — ${selectedFilial.cnpj})`
                  : formData.clienteId
                    ? ` (Matriz — ${selectedCliente.cnpj})`
                    : ''}
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
                    onClick={() => void handleDuplicateEntrevista(selectedEntrevista)}
                    disabled={loadingAction}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
                  >
                    Duplicar
                  </button>
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
                  <p className="font-semibold text-gray-700 dark:text-gray-200">Responsável</p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {selectedEntrevista.responsavelEntrevista?.trim() || '-'}
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
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 font-sans leading-relaxed">
                  {whatsappMessage}
                </pre>
              </div>

              <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold text-[#004085] dark:text-blue-400">
                    Mensagem de entrevista confirmada
                  </h3>
                  <button
                    type="button"
                    onClick={() => void handleCopyConfirmacao()}
                    className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm"
                  >
                    Copiar
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 font-sans leading-relaxed">
                  {confirmacaoMessage}
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
                        {editingCandidato?.id === candidato.id ? (
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2">
                            <input
                              type="text"
                              value={editCandidatoNome}
                              onChange={(e) => setEditCandidatoNome(e.target.value)}
                              className={inputClass}
                            />
                            <input
                              type="text"
                              value={editCandidatoTelefone}
                              onChange={(e) =>
                                setEditCandidatoTelefone(maskPhone(e.target.value))
                              }
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveEditCandidato()}
                              disabled={loadingAction}
                              className="px-3 py-1.5 rounded-lg bg-[#004085] hover:bg-[#0056B3] text-white text-sm disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditCandidato}
                              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {candidato.nome}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {buildWhatsAppUrl(candidato.telefone) ? (
                                  <a
                                    href={buildWhatsAppUrl(candidato.telefone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-green-700 dark:text-green-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {maskPhone(candidato.telefone)}
                                  </a>
                                ) : (
                                  maskPhone(candidato.telefone)
                                )}
                              </p>
                              <p className="text-xs mt-1 text-[#004085] dark:text-blue-400">
                                {ENTREVISTA_CANDIDATO_STATUS_LABELS[candidato.status]}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditCandidato(candidato)}
                                disabled={loadingAction}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteCandidato(candidato)}
                                disabled={loadingAction}
                                className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm disabled:opacity-50"
                              >
                                Excluir
                              </button>
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
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimatedModal>

        <AnimatedModal
          open={showContratosModal}
          onClose={() => {
            setShowContratosModal(false);
            setContratoFiltro('todos');
          }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400 mb-4">
              Links de contrato
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {(
                [
                  ['todos', 'Todos'],
                  ['pendente', 'Pendente assinatura'],
                  ['assinado', 'Assinado'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setContratoFiltro(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    contratoFiltro === value
                      ? 'bg-[#004085] text-white border-[#004085]'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {loadingContratos ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
            ) : filteredContratoLinks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum link de contrato encontrado.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredContratoLinks.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {item.empresaNome}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {item.candidatoNome}
                      </p>
                      {item.telefone && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {buildWhatsAppUrl(item.telefone) ? (
                            <a
                              href={buildWhatsAppUrl(item.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-700 dark:text-green-400 hover:underline"
                            >
                              {maskPhone(item.telefone)}
                            </a>
                          ) : (
                            maskPhone(item.telefone)
                          )}
                        </p>
                      )}
                      <p className="text-xs mt-1 text-[#004085] dark:text-blue-400">
                        {ENTREVISTA_CANDIDATO_STATUS_LABELS[item.status]}
                      </p>
                    </div>
                    {item.link && (
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleCopyContratoLink(item.link)}
                          className="px-3 py-1.5 rounded-lg bg-[#004085] hover:bg-[#0056B3] text-white text-sm"
                        >
                          Copiar link
                        </button>
                        {(item.status === 'contrato_pendente' ||
                          item.status === 'contrato_preenchido') && (
                          <button
                            type="button"
                            onClick={() => void handleCancelContratoLink(item)}
                            disabled={loadingContratos}
                            className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </AnimatedModal>

        <AnimatedModal open={showHojeModal} onClose={() => setShowHojeModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400 mb-1">
              Entrevistas de hoje
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 capitalize">
              {hojeLabel}
            </p>
            {entrevistasHoje.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma entrevista agendada para hoje.
              </p>
            ) : (
              <div className="space-y-2">
                {entrevistasHoje.map((entrevista) => {
                  const candidatosCount =
                    candidatosByEntrevistaId.get(entrevista.id ?? '')?.length ?? 0;
                  const calendarioIso = getDataCalendario(entrevista);
                  const calendarioDiferente = calendarioIso !== entrevista.dataEntrevista;
                  return (
                    <button
                      key={entrevista.id}
                      type="button"
                      onClick={() => void handleOpenHojeEntrevista(entrevista)}
                      className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 uppercase">
                          {entrevista.empresaNome}
                        </p>
                        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[#004085]/10 text-[#004085] dark:text-blue-400">
                          {candidatosCount} candidato{candidatosCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {entrevista.horarioEntrevista.trim() || 'Horário não informado'} ·{' '}
                        {entrevista.tipoEntrevista === 'online' ? 'Online' : 'Presencial'} ·{' '}
                        {entrevista.tituloVaga}
                      </p>
                      {calendarioDiferente && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          No calendário desde{' '}
                          {new Date(calendarioIso + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </AnimatedModal>

        <AnimatedModal
          open={showTodasModal}
          onClose={() => {
            setShowTodasModal(false);
            setTodasSearch('');
          }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400 mb-4">
              Todas as entrevistas
            </h2>
            <input
              type="text"
              placeholder="Buscar por nome da empresa..."
              value={todasSearch}
              onChange={(e) => setTodasSearch(e.target.value)}
              className={`${inputClass} mb-4`}
            />
            {filteredTodasEntrevistas.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma entrevista encontrada.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTodasEntrevistas.map((entrevista) => (
                  <button
                    key={entrevista.id}
                    type="button"
                    onClick={() => void handleOpenTodasEntrevista(entrevista)}
                    className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <p className="font-semibold text-gray-900 dark:text-gray-100 uppercase">
                      {entrevista.empresaNome}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Calendário:{' '}
                      {new Date(getDataCalendario(entrevista) + 'T12:00:00').toLocaleDateString(
                        'pt-BR'
                      )}{' '}
                      · Entrevista:{' '}
                      {new Date(entrevista.dataEntrevista + 'T12:00:00').toLocaleDateString(
                        'pt-BR'
                      )}{' '}
                      · {entrevista.tituloVaga}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </AnimatedModal>
      </AdminRoute>
    </ProtectedRoute>
  );
}
