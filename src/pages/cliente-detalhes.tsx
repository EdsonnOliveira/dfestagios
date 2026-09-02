import { useState, useEffect, useCallback, useRef, useMemo, type FocusEvent } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import PainelHeader from '../components/PainelHeader';
import { AnimatedModal } from '../components/AnimatedModal';
import ProtectedRoute from '../components/ProtectedRoute';
import { clientesService, estagiariosService, vinculacoesService, clienteContratoLinksService, cancelContratoLinkTracking } from '../services/firebase';
import { mensalidadesService, Mensalidade } from '../services/mensalidadesService';
import { fetchCnpjLookup } from '../services/brasilApiCnpj';
import {
  driveStorageService,
  displayNameFromStorageName
} from '../services/driveStorageService';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { Cliente, ClienteFilial, Estagiario, EstagiarioWithCompanyEntry, FormaCaptacao, FORMA_CAPTACAO_OPTIONS, getFormaCaptacaoLabel } from '../types/firebase';
import { useAuth } from '../hooks/useAuth';
import { isPanelAdminEmail } from '../constants/admin';
import { fisqalService } from '../services/fisqalService';
import { fiscalSettingsService } from '../services/fiscalSettingsService';
import { nfseService } from '../services/nfseService';
import { NfseEmission } from '../types/fisqal';
import {
  buildEmitNfsePayload,
  getDefaultCompetencia,
  nfseStatusClass,
  nfseStatusLabel,
  parseValorServico,
} from '../lib/nfseEmit';
import { getNfseServicoOptions } from '../constants/nfseServicos';
import { VERSAO_TERMOS } from '../constants/termosContratacao';
import {
  calculateRescisao,
  formatDatePtBr,
  formatBolsaDisplay,
} from '../services/rescisaoCalcService';
import {
  downloadRescisaoDocx,
  generateRescisaoDocxBlob,
} from '../services/rescisaoDocxService';

const emptyFilialForm = {
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  telefone: '',
  email: '',
  endereco: '',
  cidade: '',
  bairro: '',
  cep: '',
  uf: '',
  responsavel: '',
  responsavelCargo: '',
};

function contractPreviewIframeSrc(drivePath: string, signedUrl: string): string {
  if (drivePath.toLowerCase().endsWith('.docx')) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      signedUrl
    )}`;
  }
  return signedUrl;
}

function formatCpfDisplay(value: string | undefined): string {
  if (!value?.trim()) return '-';
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function maskPhoneInput(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length === 0) return '';
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function formatPhoneDisplay(value: string | undefined): string {
  if (!value?.trim()) return '-';
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length === 0) return '-';
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function resolveEstagiarioFilial(
  cliente: Cliente | null,
  estagiario: Estagiario
): ClienteFilial | null {
  const filialId = estagiario.empresaFilialId?.trim();
  if (!filialId || !cliente) return null;
  return cliente.filiais?.find((item) => item.id === filialId) ?? null;
}

export default function ClienteDetalhes() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const isAdmin = isPanelAdminEmail(user?.email);
  const supabaseReady = useMemo(() => Boolean(getSupabaseBrowserClient()), []);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [estagiarios, setEstagiarios] = useState<EstagiarioWithCompanyEntry[]>([]);
  const [todosEstagiarios, setTodosEstagiarios] = useState<Estagiario[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEstagiarios, setLoadingEstagiarios] = useState(true);
  const [loadingMensalidades, setLoadingMensalidades] = useState(true);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [showCadastrarModal, setShowCadastrarModal] = useState(false);
  const [estagiariosDisponiveis, setEstagiariosDisponiveis] = useState<Estagiario[]>([]);
  const [estagiariosFiltrados, setEstagiariosFiltrados] = useState<Estagiario[]>([]);
  const [filtroEstagiario, setFiltroEstagiario] = useState('');
  const [loadingVincular, setLoadingVincular] = useState(false);
  const [loadingCadastrar, setLoadingCadastrar] = useState(false);
  const [loadingMensalidade, setLoadingMensalidade] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'info' | 'estagiarios' | 'financeiro' | 'notaFiscal' | 'rescisao'
  >('info');
  const [rescisaoEstagiarioId, setRescisaoEstagiarioId] = useState('');
  const [rescisaoDataSaida, setRescisaoDataSaida] = useState('');
  const [rescisaoUltimoPagamento, setRescisaoUltimoPagamento] = useState('');
  const [rescisaoDescontos, setRescisaoDescontos] = useState('');
  const [generatingRescisao, setGeneratingRescisao] = useState(false);
  const [nfseEmissions, setNfseEmissions] = useState<NfseEmission[]>([]);
  const [loadingNfse, setLoadingNfse] = useState(true);
  const [showEmitNfseModal, setShowEmitNfseModal] = useState(false);
  const [showCancelNfseModal, setShowCancelNfseModal] = useState(false);
  const [nfseToCancel, setNfseToCancel] = useState<NfseEmission | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [emittingNfse, setEmittingNfse] = useState(false);
  const [nfseActionId, setNfseActionId] = useState<string | null>(null);
  const [formNfse, setFormNfse] = useState({
    dataCompetencia: getDefaultCompetencia(),
    valorServico: '',
    codigoServico: '',
    discriminacao: '',
  });
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [menuLayout, setMenuLayout] = useState<{ width: number; height: number }>({
    width: 192,
    height: 120
  });
  const [loadingContractEstagiarioId, setLoadingContractEstagiarioId] = useState<string | null>(null);
  const [contractPreviewOpen, setContractPreviewOpen] = useState(false);
  const [contractPreviewUrl, setContractPreviewUrl] = useState<string | null>(null);
  const [contractPreviewPath, setContractPreviewPath] = useState<string | null>(null);
  const [contractDownloading, setContractDownloading] = useState(false);
  const [showMultaModal, setShowMultaModal] = useState(false);
  const [multaPercentual, setMultaPercentual] = useState<string>('');
  const [mensalidadeParaMulta, setMensalidadeParaMulta] = useState<Mensalidade | null>(null);
  const [showVencimentoModal, setShowVencimentoModal] = useState(false);
  const [showValorModal, setShowValorModal] = useState(false);
  const [showExcluirModal, setShowExcluirModal] = useState(false);
  const [mensalidadeParaEditar, setMensalidadeParaEditar] = useState<Mensalidade | null>(null);
  const [mensalidadeParaExcluir, setMensalidadeParaExcluir] = useState<Mensalidade | null>(null);
  const [showGerarParcelasModal, setShowGerarParcelasModal] = useState(false);
  const [mensalidadeParaGerarParcelas, setMensalidadeParaGerarParcelas] = useState<Mensalidade | null>(null);
  const [novoVencimento, setNovoVencimento] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [showFormaPagamentoModal, setShowFormaPagamentoModal] = useState(false);
  const [mensalidadeParaEditarFormaPagamento, setMensalidadeParaEditarFormaPagamento] = useState<Mensalidade | null>(null);
  const [novaFormaPagamento, setNovaFormaPagamento] = useState<'pix' | 'boleto'>('pix');
  const [selectedParcelasIds, setSelectedParcelasIds] = useState<Set<string>>(new Set());
  const [editingBulkIds, setEditingBulkIds] = useState<string[] | null>(null);
  const [excluirBulkIds, setExcluirBulkIds] = useState<string[] | null>(null);

  // Estados para modal de edição de cliente
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingCnpjLookup, setLoadingCnpjLookup] = useState(false);
  const formCnpjRef = useRef('');
  const [filiais, setFiliais] = useState<ClienteFilial[]>([]);
  const [showFilialForm, setShowFilialForm] = useState(false);
  const [showFilialModal, setShowFilialModal] = useState(false);
  const [editingFilialId, setEditingFilialId] = useState<string | null>(null);
  const [filialForm, setFilialForm] = useState(emptyFilialForm);
  const [loadingFilialCnpj, setLoadingFilialCnpj] = useState(false);
  const [loadingFilialAction, setLoadingFilialAction] = useState(false);
  const lastFilialCnpjFetched = useRef('');
  const filialCnpjLookupSeq = useRef(0);
  const [showCopyFormularioModal, setShowCopyFormularioModal] = useState(false);
  const [copyFormularioFilialId, setCopyFormularioFilialId] = useState('');
  const [copyFormularioNome, setCopyFormularioNome] = useState('');
  const [copyFormularioTelefone, setCopyFormularioTelefone] = useState('');
  const [loadingCopyFormularioLink, setLoadingCopyFormularioLink] = useState(false);
  const [downloadingTermosAceite, setDownloadingTermosAceite] = useState(false);
  const [formData, setFormData] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    telefone: '',
    email: '',
    endereco: '',
    uf: '',
    cidade: '',
    bairro: '',
    cep: '',
    responsavel: '',
    responsavelCargo: '',
    status: 'ativo' as 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo',
    formaCaptacao: '' as FormaCaptacao | '',
    formaCaptacaoDetalhe: '',
  });
  
  const [formDataEstagiario, setFormDataEstagiario] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    dataNascimento: '',
    estagioDataInicio: '',
    estagioValorBolsa: ''
  });

  const [formDataPlano, setFormDataPlano] = useState({
    descricaoServico: '',
    dataPrimeiroVencimento: '',
    periodoPagamento: 'mensal',
    numeroParcelas: '12-parcelas',
    valorParcela: '',
    formaPagamento: 'pix' as 'pix' | 'boleto'
  });

  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate();
    }
    return null;
  };

  const formatarDataNascimento = (dataString: string | undefined): string => {
    if (!dataString) return '-';
    
    // Se a data está no formato YYYY-MM-DD, criar uma data local
    const partes = dataString.split('-');
    if (partes.length === 3) {
      const ano = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Mês é 0-indexed
      const dia = parseInt(partes[2], 10);
      const data = new Date(ano, mes, dia);
      return data.toLocaleDateString('pt-BR');
    }
    
    // Fallback para outros formatos
    return new Date(dataString).toLocaleDateString('pt-BR');
  };

  const normalizeDriveMatch = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const internRowMenuId = (estagiarioId: string) => `est-${estagiarioId}`;

  useEffect(() => {
    formCnpjRef.current = formData.cnpj;
  }, [formData.cnpj]);

  const handleCnpjLookupBlur = useCallback(async (e: FocusEvent<HTMLInputElement>) => {
    const digits = e.currentTarget.value.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setLoadingCnpjLookup(true);
    try {
      const mapped = await fetchCnpjLookup(digits);
      if (!mapped) return;
      setFormData((prev) => ({
        ...prev,
        ...mapped,
        cnpj: prev.cnpj,
      }));
    } catch (err) {
      console.error('Erro ao consultar CNPJ:', err);
    } finally {
      setLoadingCnpjLookup(false);
    }
  }, []);

  const formatCnpjMask = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 14);
    let formattedValue = numericValue;
    if (numericValue.length > 2) {
      formattedValue = numericValue.substring(0, 2) + '.' + numericValue.substring(2);
    }
    if (numericValue.length > 5) {
      formattedValue = formattedValue.substring(0, 6) + '.' + formattedValue.substring(6);
    }
    if (numericValue.length > 8) {
      formattedValue = formattedValue.substring(0, 10) + '/' + formattedValue.substring(10);
    }
    if (numericValue.length > 12) {
      formattedValue = formattedValue.substring(0, 15) + '-' + numericValue.substring(12, 14);
    }
    return formattedValue;
  };

  const formatCepMask = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length > 5) {
      return numericValue.substring(0, 5) + '-' + numericValue.substring(5, 8);
    }
    return numericValue;
  };

  const formatTelefoneMask = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    let formattedValue = numericValue;
    if (numericValue.length > 0) {
      formattedValue = '(' + numericValue.substring(0, 2);
    }
    if (numericValue.length > 2) {
      formattedValue += ') ' + numericValue.substring(2, 7);
    }
    if (numericValue.length > 7) {
      formattedValue = formattedValue.substring(0, 10) + '-' + numericValue.substring(7, 11);
    }
    return formattedValue;
  };

  const lookupFilialCnpj = useCallback(async (cnpjValue: string) => {
    const digits = cnpjValue.replace(/\D/g, '');
    if (digits.length !== 14) return;
    if (lastFilialCnpjFetched.current === digits) return;
    lastFilialCnpjFetched.current = digits;
    const seq = ++filialCnpjLookupSeq.current;
    setLoadingFilialCnpj(true);
    try {
      const mapped = await fetchCnpjLookup(digits);
      if (seq !== filialCnpjLookupSeq.current) return;
      if (!mapped) {
        lastFilialCnpjFetched.current = '';
        toast.error('CNPJ não encontrado. Verifique o número.');
        return;
      }
      setFilialForm((prev) => ({
        ...prev,
        ...mapped,
        cnpj: prev.cnpj,
        responsavelCargo: prev.responsavelCargo,
      }));
    } catch (err) {
      if (seq !== filialCnpjLookupSeq.current) return;
      lastFilialCnpjFetched.current = '';
      console.error('Erro ao consultar CNPJ da filial:', err);
      toast.error('Não foi possível consultar o CNPJ. Tente novamente.');
    } finally {
      if (seq === filialCnpjLookupSeq.current) {
        setLoadingFilialCnpj(false);
      }
    }
  }, []);

  const handleFilialCnpjChange = useCallback(
    (value: string) => {
      const formattedValue = formatCnpjMask(value);
      const digits = formattedValue.replace(/\D/g, '');
      if (digits.length < 14) {
        filialCnpjLookupSeq.current += 1;
        lastFilialCnpjFetched.current = '';
        setLoadingFilialCnpj(false);
      }
      setFilialForm((prev) => ({ ...prev, cnpj: formattedValue }));
      if (digits.length === 14) {
        void lookupFilialCnpj(formattedValue);
      }
    },
    [lookupFilialCnpj]
  );

  const handleFilialCnpjBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      void lookupFilialCnpj(e.currentTarget.value);
    },
    [lookupFilialCnpj]
  );

  const resetFilialForm = () => {
    filialCnpjLookupSeq.current += 1;
    lastFilialCnpjFetched.current = '';
    setLoadingFilialCnpj(false);
    setFilialForm(emptyFilialForm);
    setEditingFilialId(null);
    setShowFilialForm(false);
  };

  const handleAddFilial = () => {
    filialCnpjLookupSeq.current += 1;
    lastFilialCnpjFetched.current = '';
    setLoadingFilialCnpj(false);
    setFilialForm(emptyFilialForm);
    setEditingFilialId(null);
    setShowFilialForm(true);
  };

  const handleEditFilial = (filial: ClienteFilial) => {
    filialCnpjLookupSeq.current += 1;
    lastFilialCnpjFetched.current = filial.cnpj.replace(/\D/g, '');
    setLoadingFilialCnpj(false);
    setFilialForm({
      cnpj: filial.cnpj,
      razaoSocial: filial.razaoSocial,
      nomeFantasia: filial.nomeFantasia,
      telefone: filial.telefone,
      email: filial.email,
      endereco: filial.endereco ?? '',
      cidade: filial.cidade,
      bairro: filial.bairro,
      cep: filial.cep,
      uf: filial.uf ?? '',
      responsavel: filial.responsavel,
      responsavelCargo: filial.responsavelCargo ?? '',
    });
    setEditingFilialId(filial.id);
    setShowFilialForm(true);
  };

  const handleRemoveFilial = (filialId: string) => {
    setFiliais((prev) => prev.filter((f) => f.id !== filialId));
    if (editingFilialId === filialId) resetFilialForm();
  };

  const handleSaveFilial = () => {
    if (
      !filialForm.cnpj ||
      !filialForm.razaoSocial ||
      !filialForm.nomeFantasia ||
      !filialForm.telefone ||
      !filialForm.endereco ||
      !filialForm.cidade ||
      !filialForm.bairro ||
      !filialForm.cep ||
      !filialForm.responsavel
    ) {
      return;
    }
    const payload: ClienteFilial = {
      id: editingFilialId ?? crypto.randomUUID(),
      cnpj: filialForm.cnpj,
      razaoSocial: filialForm.razaoSocial,
      nomeFantasia: filialForm.nomeFantasia,
      telefone: filialForm.telefone,
      email: filialForm.email,
      endereco: filialForm.endereco,
      cidade: filialForm.cidade,
      bairro: filialForm.bairro,
      cep: filialForm.cep,
      responsavel: filialForm.responsavel,
      ...(filialForm.uf.trim() ? { uf: filialForm.uf.trim() } : {}),
      ...(filialForm.responsavelCargo.trim()
        ? { responsavelCargo: filialForm.responsavelCargo.trim() }
        : {}),
    };
    if (editingFilialId) {
      setFiliais((prev) => prev.map((f) => (f.id === editingFilialId ? payload : f)));
    } else {
      setFiliais((prev) => [...prev, payload]);
    }
    resetFilialForm();
  };

  const buildFilialPayload = (): ClienteFilial | null => {
    if (
      !filialForm.cnpj ||
      !filialForm.razaoSocial ||
      !filialForm.nomeFantasia ||
      !filialForm.telefone ||
      !filialForm.endereco ||
      !filialForm.cidade ||
      !filialForm.bairro ||
      !filialForm.cep ||
      !filialForm.responsavel
    ) {
      return null;
    }
    return {
      id: editingFilialId ?? crypto.randomUUID(),
      cnpj: filialForm.cnpj,
      razaoSocial: filialForm.razaoSocial,
      nomeFantasia: filialForm.nomeFantasia,
      telefone: filialForm.telefone,
      email: filialForm.email,
      endereco: filialForm.endereco,
      cidade: filialForm.cidade,
      bairro: filialForm.bairro,
      cep: filialForm.cep,
      responsavel: filialForm.responsavel,
      ...(filialForm.uf.trim() ? { uf: filialForm.uf.trim() } : {}),
      ...(filialForm.responsavelCargo.trim()
        ? { responsavelCargo: filialForm.responsavelCargo.trim() }
        : {}),
    };
  };

  const handleOpenFilialModal = () => {
    filialCnpjLookupSeq.current += 1;
    lastFilialCnpjFetched.current = '';
    setLoadingFilialCnpj(false);
    setFilialForm(emptyFilialForm);
    setEditingFilialId(null);
    setShowFilialModal(true);
  };

  const handleEditFilialFromInfo = (filial: ClienteFilial) => {
    filialCnpjLookupSeq.current += 1;
    lastFilialCnpjFetched.current = filial.cnpj.replace(/\D/g, '');
    setLoadingFilialCnpj(false);
    setFilialForm({
      cnpj: filial.cnpj,
      razaoSocial: filial.razaoSocial,
      nomeFantasia: filial.nomeFantasia,
      telefone: filial.telefone,
      email: filial.email,
      endereco: filial.endereco ?? '',
      cidade: filial.cidade,
      bairro: filial.bairro,
      cep: filial.cep,
      uf: filial.uf ?? '',
      responsavel: filial.responsavel,
      responsavelCargo: filial.responsavelCargo ?? '',
    });
    setEditingFilialId(filial.id);
    setShowFilialModal(true);
  };

  const handleCloseFilialModal = () => {
    filialCnpjLookupSeq.current += 1;
    lastFilialCnpjFetched.current = '';
    setLoadingFilialCnpj(false);
    setShowFilialModal(false);
    setFilialForm(emptyFilialForm);
    setEditingFilialId(null);
  };

  const handlePersistFilialFromInfo = async () => {
    if (!cliente?.id) return;
    const payload = buildFilialPayload();
    if (!payload) return;
    const current = cliente.filiais ?? [];
    const next = editingFilialId
      ? current.map((f) => (f.id === editingFilialId ? payload : f))
      : [...current, payload];
    try {
      setLoadingFilialAction(true);
      await clientesService.update(cliente.id, { filiais: next });
      setCliente((prev) => (prev ? { ...prev, filiais: next } : null));
      const wasEditing = Boolean(editingFilialId);
      handleCloseFilialModal();
      toast.success(wasEditing ? 'Filial atualizada.' : 'Filial adicionada.');
    } catch (error) {
      console.error('Erro ao salvar filial:', error);
      toast.error('Erro ao salvar filial. Tente novamente.');
    } finally {
      setLoadingFilialAction(false);
    }
  };

  const handleRemoveFilialFromInfo = async (filialId: string) => {
    if (!cliente?.id) return;
    const next = (cliente.filiais ?? []).filter((f) => f.id !== filialId);
    try {
      setLoadingFilialAction(true);
      await clientesService.update(cliente.id, { filiais: next });
      setCliente((prev) => (prev ? { ...prev, filiais: next } : null));
      toast.success('Filial removida.');
    } catch (error) {
      console.error('Erro ao remover filial:', error);
      toast.error('Erro ao remover filial. Tente novamente.');
    } finally {
      setLoadingFilialAction(false);
    }
  };

  useEffect(() => {
    if (filtroEstagiario) {
      const filtrados = estagiariosDisponiveis.filter(estagiario =>
        estagiario.nome.toLowerCase().includes(filtroEstagiario.toLowerCase()) ||
        estagiario.email.toLowerCase().includes(filtroEstagiario.toLowerCase()) ||
        estagiario.telefone1?.toLowerCase().includes(filtroEstagiario.toLowerCase())
      );
      setEstagiariosFiltrados(filtrados);
    } else {
      setEstagiariosFiltrados(estagiariosDisponiveis);
    }
  }, [filtroEstagiario, estagiariosDisponiveis]);

  // Fechar menu quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuAberto) {
        const target = event.target as Element;
        // Verificar se o clique foi fora do menu
        if (!target.closest('.menu-dropdown') && !target.closest('.menu-button')) {
          fecharMenu();
        }
      }
    };

    if (menuAberto) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuAberto]);

  const loadCliente = useCallback(async () => {
    try {
      setLoading(true);
      const clientes = await clientesService.getAll();
      const clienteEncontrado = clientes.find(c => c.id === id);
      
      if (clienteEncontrado) {
        setCliente(clienteEncontrado);
      } else {
        router.push('/clientes');
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      router.push('/clientes');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const loadEstagiarios = useCallback(async () => {
    try {
      setLoadingEstagiarios(true);
      const estagiariosData = await estagiariosService.getAll();
      setTodosEstagiarios(estagiariosData);
      
      // Buscar apenas os estagiários vinculados a este cliente
      if (id) {
        const estagiariosVinculados = await vinculacoesService.getEstagiariosVinculados(id as string);
        setEstagiarios(estagiariosVinculados);
      }
    } catch (error) {
      console.error('Erro ao carregar estagiários:', error);
    } finally {
      setLoadingEstagiarios(false);
    }
  }, [id]);

  const loadMensalidades = useCallback(async () => {
    try {
      setLoadingMensalidades(true);
      
      if (id) {
        // Buscar apenas mensalidades específicas do banco para este cliente
        const mensalidadesData = await mensalidadesService.getByCliente(id as string);
        setMensalidades(mensalidadesData);
      }
    } catch (error) {
      console.error('Erro ao carregar mensalidades:', error);
    } finally {
      setLoadingMensalidades(false);
    }
  }, [id]);

  const loadNfseEmissions = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingNfse(true);
      const list = await nfseService.getByCliente(id as string);
      setNfseEmissions(list);
    } catch (error) {
      console.error('Erro ao carregar NFS-e:', error);
    } finally {
      setLoadingNfse(false);
    }
  }, [id]);

  const refreshNfseStatus = useCallback(
    async (emission: NfseEmission) => {
      if (!emission.id || !supabaseReady) return;
      try {
        const timeline = await fisqalService.getNfseStatus(emission.dpsId);
        await nfseService.updateStatus(
          emission.id,
          timeline.status,
          timeline.chaveAcesso
        );
        setNfseEmissions((prev) =>
          prev.map((item) =>
            item.id === emission.id
              ? {
                  ...item,
                  status: timeline.status,
                  chaveAcesso: timeline.chaveAcesso ?? item.chaveAcesso,
                }
              : item
          )
        );
        if (timeline.status === 'authorized') {
          toast.success('NFS-e autorizada');
        } else if (timeline.status === 'rejected') {
          toast.error('NFS-e rejeitada');
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erro ao consultar status';
        toast.error(message);
      }
    },
    [supabaseReady]
  );

  const openEmitNfseModal = useCallback(async () => {
    if (!cliente) return;
    try {
      const settings = await fiscalSettingsService.get();
      setFormNfse({
        dataCompetencia: getDefaultCompetencia(),
        valorServico: String(parseValorServico(cliente.valor) || ''),
        codigoServico: settings.defaultCodigoServico,
        discriminacao: cliente.servico?.trim() || 'Serviços prestados',
      });
      setShowEmitNfseModal(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao preparar emissão';
      toast.error(message);
    }
  }, [cliente]);

  const handleEmitNfse = async () => {
    if (!cliente?.id || !supabaseReady) return;
    try {
      setEmittingNfse(true);
      const settings = await fiscalSettingsService.get();
      if (!fiscalSettingsService.isComplete(settings)) {
        toast.error('Configure os dados fiscais em Configurações');
        return;
      }
      const certificates = await fisqalService.listCertificates();
      const hasActiveCert = certificates.some((c) => c.status === 'active');
      if (!hasActiveCert) {
        toast.error('Cadastre um certificado digital ativo em Configurações');
        return;
      }
      const cobertura = await fisqalService.getMunicipioCobertura(
        settings.codigoMunicipioEmissor,
        settings.fiscalAmbiente
      );
      if (!cobertura.podeEmitir) {
        toast.error('Município emissor sem cobertura para emissão NFS-e');
        return;
      }
      const valorServico = Number.parseFloat(formNfse.valorServico);
      if (!Number.isFinite(valorServico) || valorServico <= 0) {
        toast.error('Informe um valor de serviço válido');
        return;
      }
      if (!formNfse.discriminacao.trim()) {
        toast.error('Informe a discriminação do serviço');
        return;
      }
      const reserved = await fiscalSettingsService.reserveNextDps();
      const payload = buildEmitNfsePayload(settings, cliente, {
        dataCompetencia: formNfse.dataCompetencia,
        valorServico,
        codigoServico: formNfse.codigoServico.trim(),
        discriminacao: formNfse.discriminacao.trim(),
        numeroDps: reserved.numeroDps,
        serieDps: reserved.serieDps,
        idDps: reserved.idDps,
        companyId: '',
      });
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${reserved.numeroDps}`;
      const result = await fisqalService.emitNfse(payload, idempotencyKey);
      await nfseService.create({
        clienteId: cliente.id,
        dpsId: result.dpsId,
        status: result.status,
        numeroDps: reserved.numeroDps,
        serieDps: reserved.serieDps,
        dataCompetencia: formNfse.dataCompetencia,
        valorServico,
        discriminacao: formNfse.discriminacao.trim(),
      });
      toast.success('NFS-e enfileirada para emissão');
      setShowEmitNfseModal(false);
      await loadNfseEmissions();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao emitir NFS-e';
      toast.error(message);
    } finally {
      setEmittingNfse(false);
    }
  };

  const handleDownloadNfsePdf = async (emission: NfseEmission) => {
    try {
      setNfseActionId(emission.dpsId);
      const url = await fisqalService.getNfsePdfUrl(emission.dpsId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao baixar PDF';
      toast.error(message);
    } finally {
      setNfseActionId(null);
    }
  };

  const handleDownloadNfseXml = async (emission: NfseEmission) => {
    try {
      setNfseActionId(emission.dpsId);
      const url = await fisqalService.getNfseXmlUrl(emission.dpsId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao baixar XML';
      toast.error(message);
    } finally {
      setNfseActionId(null);
    }
  };

  const openCancelNfseModal = (emission: NfseEmission) => {
    setNfseToCancel(emission);
    setCancelMotivo('');
    setShowCancelNfseModal(true);
  };

  const handleCancelNfse = async () => {
    if (!nfseToCancel?.id || !cancelMotivo.trim()) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }
    try {
      setNfseActionId(nfseToCancel.dpsId);
      await fisqalService.cancelNfse(nfseToCancel.dpsId, {
        motivoCancelamento: cancelMotivo.trim(),
      });
      await nfseService.updateStatus(nfseToCancel.id, 'cancel_pending');
      toast.success('Cancelamento enfileirado');
      setShowCancelNfseModal(false);
      setNfseToCancel(null);
      await loadNfseEmissions();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao cancelar NFS-e';
      toast.error(message);
    } finally {
      setNfseActionId(null);
    }
  };

  // Funções para máscara de edição de cliente
  const handleCnpjChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 14);
    let formattedValue = numericValue;
    
    if (numericValue.length > 2) {
      formattedValue = numericValue.substring(0, 2) + '.' + numericValue.substring(2);
    }
    if (numericValue.length > 5) {
      formattedValue = formattedValue.substring(0, 6) + '.' + formattedValue.substring(6);
    }
    if (numericValue.length > 8) {
      formattedValue = formattedValue.substring(0, 10) + '/' + formattedValue.substring(10);
    }
    if (numericValue.length > 12) {
      formattedValue = formattedValue.substring(0, 15) + '-' + numericValue.substring(12, 14);
    }

    formCnpjRef.current = formattedValue;
    setFormData({...formData, cnpj: formattedValue});
  };

  const handleCepChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    let formattedValue = numericValue;
    
    if (numericValue.length > 5) {
      formattedValue = numericValue.substring(0, 5) + '-' + numericValue.substring(5, 8);
    }
    
    setFormData({...formData, cep: formattedValue});
  };

  const handleTelefoneClienteChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    let formattedValue = numericValue;
    
    if (numericValue.length > 0) {
      formattedValue = '(' + numericValue.substring(0, 2);
    }
    if (numericValue.length > 2) {
      formattedValue += ') ' + numericValue.substring(2, 7);
    }
    if (numericValue.length > 7) {
      formattedValue = formattedValue.substring(0, 10) + '-' + numericValue.substring(7, 11);
    }
    
    setFormData({...formData, telefone: formattedValue});
  };

  const handleEdit = () => {
    if (!cliente) return;
    setEditingCliente(cliente);
    setFormData({
      cnpj: cliente.cnpj,
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      telefone: cliente.telefone,
      email: cliente.email,
      endereco: cliente.endereco ?? '',
      uf: cliente.uf ?? '',
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      cep: cliente.cep,
      responsavel: cliente.responsavel,
      responsavelCargo: cliente.responsavelCargo ?? '',
      status: cliente.status,
      formaCaptacao: cliente.formaCaptacao ?? '',
      formaCaptacaoDetalhe: cliente.formaCaptacaoDetalhe ?? '',
    });
    setFiliais(cliente.filiais ? [...cliente.filiais] : []);
    resetFilialForm();
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!editingCliente) return;
    
    try {
      setLoadingAction(true);
      const needsDetalhe =
        formData.formaCaptacao === 'indicacao' || formData.formaCaptacao === 'outro';
      const { formaCaptacao, formaCaptacaoDetalhe, ...restForm } = formData;
      const detalheTrimmed = formaCaptacaoDetalhe.trim();
      const updateData = {
        ...restForm,
        formaCaptacao: formaCaptacao || null,
        formaCaptacaoDetalhe: needsDetalhe ? detalheTrimmed : '',
        filiais,
      };
      await clientesService.update(editingCliente.id!, updateData);
      
      setCliente(prev =>
        prev
          ? {
              ...prev,
              ...updateData,
              formaCaptacao: formaCaptacao || null,
              formaCaptacaoDetalhe: needsDetalhe ? detalheTrimmed : '',
            }
          : null
      );
      
      setShowEditModal(false);
      setEditingCliente(null);
      setFiliais([]);
      resetFilialForm();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      alert('Erro ao salvar cliente. Tente novamente.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingCliente(null);
    setFiliais([]);
    resetFilialForm();
    setFormData({
      cnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
      telefone: '',
      email: '',
      endereco: '',
      uf: '',
      cidade: '',
      bairro: '',
      cep: '',
      responsavel: '',
      responsavelCargo: '',
      status: 'ativo',
      formaCaptacao: '',
      formaCaptacaoDetalhe: '',
    });
  };

  useEffect(() => {
    if (id) {
      loadCliente();
      loadEstagiarios();
    }
  }, [id, loadCliente, loadEstagiarios]);

  useEffect(() => {
    if (cliente) {
      loadMensalidades();
      void loadNfseEmissions();
    }
  }, [cliente, loadMensalidades, loadNfseEmissions]);

  useEffect(() => {
    if (!isAdmin || !supabaseReady) return;
    const pending = nfseEmissions.filter(
      (item) => item.status === 'pending' || item.status === 'cancel_pending'
    );
    if (pending.length === 0) return;
    const interval = window.setInterval(() => {
      pending.forEach((item) => {
        void refreshNfseStatus(item);
      });
    }, 8000);
    return () => window.clearInterval(interval);
  }, [isAdmin, nfseEmissions, refreshNfseStatus, supabaseReady]);

  // Função removida - não utilizada
  /*
  const gerarMensalidadesMensais = (cliente: Cliente, mensalidadesExistentes: Mensalidade[]) => {
    if (!cliente.dataVencimento) {
      return mensalidadesExistentes;
    }

    // Extrair o dia da data de vencimento cadastrada (pode ser 'DD' ou 'YYYY-MM-DD')
    const diaVencimento = (() => {
      const dv = cliente.dataVencimento as string;
      if (!dv) return 1;
      if (dv.includes('-')) {
        const parts = dv.split('-');
        const d = parseInt(parts[2], 10);
        return isNaN(d) ? 1 : d;
      }
      const d = parseInt(dv, 10);
      return isNaN(d) ? 1 : d;
    })();
    
    // Data de criação do cliente (usar createdAt se disponível, senão usar data atual)
    const dataCriacaoParsed = toDate(cliente.createdAt) || new Date();
    const dataCriacao = new Date(
      dataCriacaoParsed.getFullYear(),
      dataCriacaoParsed.getMonth(),
      dataCriacaoParsed.getDate()
    );
    const dataAtual = new Date();
    
    // Converter valor do cliente para number
    const valorMensalidade = parseFloat(cliente.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    
    const mensalidades: Mensalidade[] = [];
    
    // Gerar mensalidades desde a criação até o mês atual (não incluir futuras)
    const dataAtualMensalidade = new Date(dataCriacao.getFullYear(), dataCriacao.getMonth(), 1);
    // Ajustar o dia para o mês inicial sem ultrapassar o último dia
    const ultimoDiaInicial = new Date(dataAtualMensalidade.getFullYear(), dataAtualMensalidade.getMonth() + 1, 0).getDate();
    dataAtualMensalidade.setDate(Math.max(1, Math.min(diaVencimento, ultimoDiaInicial)));
    
    // Se a data de vencimento do mês de criação já passou, começar do próximo mês
    if (dataAtualMensalidade < dataCriacao) {
      dataAtualMensalidade.setMonth(dataAtualMensalidade.getMonth() + 1);
    }
    
    // Gerar até o mês atual (incluindo) - não mostrar futuras
    const dataLimite = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 0); // Último dia do mês atual
    
    let contador = 0;
    while (dataAtualMensalidade <= dataLimite && contador < 24) { // Limite de segurança
      // Verificar se já existe mensalidade específica para este mês/ano
      const mensalidadeExistente = mensalidadesExistentes.find(m => 
        m.dataVencimento.getMonth() === dataAtualMensalidade.getMonth() &&
        m.dataVencimento.getFullYear() === dataAtualMensalidade.getFullYear()
      );
      
      if (mensalidadeExistente) {
        // Usar mensalidade existente do banco
        mensalidades.push(mensalidadeExistente);
      } else {
        // Gerar mensalidade baseada no cadastro do cliente
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataVencimentoComparacao = new Date(dataAtualMensalidade);
        dataVencimentoComparacao.setHours(0, 0, 0, 0);
        
        let status: 'pago' | 'vencido' | 'aberto' = 'aberto';
        if (dataVencimentoComparacao < hoje) {
          status = 'vencido';
        }
        
        const mensalidadeGerada: Mensalidade = {
          id: `gerada_${dataAtualMensalidade.getFullYear()}_${dataAtualMensalidade.getMonth() + 1}`,
          clienteId: cliente.id!,
          clienteNome: cliente.razaoSocial,
          dataVencimento: new Date(dataAtualMensalidade),
          valor: valorMensalidade,
          status: status,
          observacoes: 'Gerada automaticamente',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        mensalidades.push(mensalidadeGerada);
      }
      
      // Próximo mês
      dataAtualMensalidade.setMonth(dataAtualMensalidade.getMonth() + 1);
      contador++;
    }
    
    // Ordenar por data de vencimento
    return mensalidades.sort((a, b) => {
      const dateA = a.dataVencimento instanceof Date ? a.dataVencimento : 
                   (typeof a.dataVencimento === 'string' ? new Date(a.dataVencimento) : (a.dataVencimento as any).toDate());
      const dateB = b.dataVencimento instanceof Date ? b.dataVencimento : 
                   (typeof b.dataVencimento === 'string' ? new Date(b.dataVencimento) : (b.dataVencimento as any).toDate());
      return dateA.getTime() - dateB.getTime();
    });
  };
  */

  const handleVincular = () => {
    // Filtrar estagiários que não estão vinculados a este cliente
    const disponiveis = todosEstagiarios.filter(estagiario => 
      estagiario.status === 'ativo' && 
      !estagiarios.some(vinculado => vinculado.id === estagiario.id)
    );
    setEstagiariosDisponiveis(disponiveis);
    setEstagiariosFiltrados(disponiveis);
    setFiltroEstagiario('');
    setShowVincularModal(true);
  };

  const handleCadastrar = () => {
    setFormDataEstagiario({
      nome: '',
      cpf: '',
      telefone: '',
      email: '',
      dataNascimento: '',
      estagioDataInicio: '',
      estagioValorBolsa: ''
    });
    setShowCadastrarModal(true);
  };


  const handleAdicionarPlano = () => {
    // Sempre inicia com formulário vazio para adicionar novo plano
    setFormDataPlano({
      descricaoServico: '',
      dataPrimeiroVencimento: '',
      periodoPagamento: 'mensal',
      numeroParcelas: '12-parcelas',
      valorParcela: '',
      formaPagamento: 'pix'
    });
    setShowPlanoModal(true);
  };

  const handleValorParcelaChange = (value: string) => {
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');
    
    // Se estiver vazio, define como vazio
    if (!numericValue) {
      setFormDataPlano({...formDataPlano, valorParcela: ''});
      return;
    }
    
    // Converte para número e divide por 100
    const numberValue = parseInt(numericValue) / 100;
    
    // Formata como moeda
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numberValue);
    
    setFormDataPlano({...formDataPlano, valorParcela: formattedValue});
  };

  const encontrarProximaDataDisponivel = (dataInicio: Date, mensalidades: Mensalidade[], intervaloMeses: number, numeroParcelas: number): Date | null => {
    // Criar um array com todas as datas ocupadas
    const datasOcupadas = mensalidades
      .filter(m => m.status !== 'pago')
      .map(m => {
        const data = m.dataVencimento instanceof Date ? m.dataVencimento : new Date(m.dataVencimento);
        return {
          mes: data.getMonth(),
          ano: data.getFullYear()
        };
      });

    // Tentar encontrar uma data de início que não cause conflitos
    for (let tentativa = 0; tentativa < 24; tentativa++) { // Tentar até 2 anos à frente
      const dataTeste = new Date(dataInicio);
      dataTeste.setMonth(dataTeste.getMonth() + tentativa);
      
      let conflitoEncontrado = false;
      
      // Verificar se todas as parcelas do plano cabem sem conflito
      for (let i = 0; i < numeroParcelas; i++) {
        const dataParcela = new Date(dataTeste);
        dataParcela.setMonth(dataParcela.getMonth() + (i * intervaloMeses));
        
        const mesParcela = dataParcela.getMonth();
        const anoParcela = dataParcela.getFullYear();
        
        // Verificar se esta data está ocupada
        const estaOcupada = datasOcupadas.some(ocupada => 
          ocupada.mes === mesParcela && ocupada.ano === anoParcela
        );
        
        if (estaOcupada) {
          conflitoEncontrado = true;
          break;
        }
      }
      
      if (!conflitoEncontrado) {
        return dataTeste;
      }
    }
    
    return null; // Não foi possível encontrar uma data disponível
  };

  const handleSalvarPlano = async () => {
    if (!formDataPlano.descricaoServico || !formDataPlano.dataPrimeiroVencimento || !formDataPlano.valorParcela) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoadingMensalidade(true);
      
      if (!cliente || !id) {
        alert('Erro: Cliente não encontrado.');
        return;
      }

      // Verificar se já existe mensalidade em aberto para o mesmo mês/ano
      const dataPrimeiroVencimento = new Date(formDataPlano.dataPrimeiroVencimento);

      // Extrair número de parcelas
      const numeroParcelas = (() => {
        switch (formDataPlano.numeroParcelas) {
          case 'a-vista': return 1;
          case '3-parcelas': return 3;
          case '6-parcelas': return 6;
          case '9-parcelas': return 9;
          case '12-parcelas': return 12;
          case '18-parcelas': return 18;
          case '24-parcelas': return 24;
          case '36-parcelas': return 36;
          case '48-parcelas': return 48;
          case '60-parcelas': return 60;
          case '72-parcelas': return 72;
          case '84-parcelas': return 84;
          case '96-parcelas': return 96;
          case '108-parcelas': return 108;
          case '120-parcelas': return 120;
          default: return 1;
        }
      })();

      // Determinar intervalo entre parcelas baseado no período de pagamento
      const intervaloMeses = (() => {
        switch (formDataPlano.periodoPagamento) {
          case 'mensal': return 1;
          case 'bimestral': return 2;
          case 'trimestral': return 3;
          case 'semestral': return 6;
          case 'anual': return 12;
          default: return 1;
        }
      })();

      // Verificar conflitos para cada parcela do novo plano
      for (let i = 0; i < numeroParcelas; i++) {
        const dataVencimentoParcela = new Date(dataPrimeiroVencimento);
        dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i * intervaloMeses));
        
        const mesParcela = dataVencimentoParcela.getMonth();
        const anoParcela = dataVencimentoParcela.getFullYear();

        // Verificar se já existe mensalidade em aberto para este mês/ano
        const mensalidadeConflitante = mensalidades.find(mensalidade => {
          const dataMensalidade = mensalidade.dataVencimento instanceof Date 
            ? mensalidade.dataVencimento 
            : new Date(mensalidade.dataVencimento);
          
          return dataMensalidade.getMonth() === mesParcela && 
                 dataMensalidade.getFullYear() === anoParcela &&
                 mensalidade.status !== 'pago';
        });

        if (mensalidadeConflitante) {
          const mesNome = dataVencimentoParcela.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          
          // Encontrar a próxima data disponível
          const proximaDataDisponivel = encontrarProximaDataDisponivel(dataPrimeiroVencimento, mensalidades, intervaloMeses, numeroParcelas);
          
          if (proximaDataDisponivel) {
            const proximaDataFormatada = proximaDataDisponivel.toLocaleDateString('pt-BR');
            alert(`Já existe uma mensalidade em aberto para ${mesNome}. Sugestão: altere a data de início para ${proximaDataFormatada} para evitar conflitos.`);
          } else {
            alert(`Já existe uma mensalidade em aberto para ${mesNome}. Não é possível criar um novo plano com conflito de datas.`);
          }
          
          setLoadingMensalidade(false);
          return;
        }
      }

      // Converter data para formato do banco (apenas o dia)
      const dataVencimento = new Date(formDataPlano.dataPrimeiroVencimento).getDate() + 1
      
      // Converter valor para number
      const valorNumerico = parseFloat(formDataPlano.valorParcela.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

      // Não atualizar dados do cliente - apenas criar mensalidades

      // Gerar e salvar todas as mensalidades
      const dataPrimeiroVencimentoParaCriacao = new Date(formDataPlano.dataPrimeiroVencimento);
      
      for (let i = 0; i < numeroParcelas; i++) {
        // Calcular data de vencimento para esta parcela
        const dataVencimentoParcela = new Date(dataPrimeiroVencimentoParaCriacao);
        dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + (i * intervaloMeses));
        
        // Ajustar o dia para o mês correto (evitar problemas com meses que têm menos dias)
        const diaVencimento = parseInt(dataVencimento.toString());
        const ultimoDiaMes = new Date(dataVencimentoParcela.getFullYear(), dataVencimentoParcela.getMonth() + 1, 0).getDate();
        dataVencimentoParcela.setDate(Math.min(diaVencimento, ultimoDiaMes));

        // Determinar status da mensalidade
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataVencimentoComparacao = new Date(dataVencimentoParcela);
        dataVencimentoComparacao.setHours(0, 0, 0, 0);
        
        let status: 'pago' | 'vencido' | 'aberto' = 'aberto';
        if (dataVencimentoComparacao < hoje) {
          status = 'vencido';
        }

        // Criar mensalidade
        const mensalidade = {
          clienteId: id as string,
          clienteNome: cliente.razaoSocial,
          dataVencimento: dataVencimentoParcela,
          valor: valorNumerico,
          status: status,
          observacoes: formDataPlano.descricaoServico,
          numeroParcela: i + 1,
          totalParcelas: numeroParcelas,
          formaPagamento: formDataPlano.formaPagamento,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Salvar mensalidade no banco
        await mensalidadesService.create(mensalidade);
      }
      
      // Recarregar dados do cliente e mensalidades
      await loadCliente();
      await loadMensalidades();
      
      setShowPlanoModal(false);
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      alert('Erro ao salvar plano de pagamento. Tente novamente.');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const handleTelefoneChange = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a máscara (61) 99999-9999
    let formatted = numbers;
    if (numbers.length > 0) {
      if (numbers.length <= 2) {
        formatted = `(${numbers}`;
      } else if (numbers.length <= 7) {
        formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      } else {
        formatted = `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
      }
    }
    
    setFormDataEstagiario({...formDataEstagiario, telefone: formatted});
  };

  const handleCpfChange = (value: string) => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a máscara 000.000.000-00
    let formatted = numbers;
    if (numbers.length > 0) {
      if (numbers.length <= 3) {
        formatted = numbers;
      } else if (numbers.length <= 6) {
        formatted = `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      } else if (numbers.length <= 9) {
        formatted = `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
      } else {
        formatted = `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
      }
    }
    
    setFormDataEstagiario({...formDataEstagiario, cpf: formatted});
  };

  const handleEstagioValorBolsaChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) {
      setFormDataEstagiario({ ...formDataEstagiario, estagioValorBolsa: '' });
      return;
    }
    const numberValue = parseInt(numericValue, 10) / 100;
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numberValue);
    setFormDataEstagiario({ ...formDataEstagiario, estagioValorBolsa: formattedValue });
  };

  const handleCadastrarEstagiario = async () => {
    if (!formDataEstagiario.nome.trim() || !formDataEstagiario.cpf.trim() || !formDataEstagiario.telefone.trim() || !formDataEstagiario.email.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoadingCadastrar(true);
      
      // Criar estagiário
      const dataInicioStr = formDataEstagiario.estagioDataInicio.trim();
      const dataVinculacaoEstimada = dataInicioStr
        ? (() => {
            const [y, m, d] = dataInicioStr.split('-').map((x) => parseInt(x, 10));
            if (!y || !m || !d) return undefined;
            return new Date(y, m - 1, d);
          })()
        : undefined;

      const bolsaStr = formDataEstagiario.estagioValorBolsa.trim();

      const novoEstagiario = {
        nome: formDataEstagiario.nome,
        cpf: formDataEstagiario.cpf,
        telefone1: formDataEstagiario.telefone,
        email: formDataEstagiario.email,
        dataNascimento: formDataEstagiario.dataNascimento || undefined,
        estagioDataInicio: dataInicioStr || undefined,
        estagioValorBolsa: bolsaStr || undefined,
        uf: 'DF',
        cidade: 'Brasília',
        bairro: '',
        endereco: '',
        grauInstrucao: 'Ensino Médio',
        status: 'ativo' as const
      };

      const estagiarioId = await estagiariosService.add(novoEstagiario);
      
      if (id) {
        await vinculacoesService.vincularEstagiario(
          id as string,
          estagiarioId,
          dataVinculacaoEstimada
        );
        
        const estagiarioCompleto: EstagiarioWithCompanyEntry = {
          ...novoEstagiario,
          id: estagiarioId,
          createdAt: new Date(),
          updatedAt: new Date(),
          companyEntryDate: dataVinculacaoEstimada ?? new Date()
        };
        setEstagiarios(prev => [...prev, estagiarioCompleto]);
        setTodosEstagiarios(prev => [...prev, estagiarioCompleto]);
      }
      
      setShowCadastrarModal(false);
      alert('Estagiário cadastrado e vinculado com sucesso!');
    } catch (error) {
      console.error('Erro ao cadastrar estagiário:', error);
      alert('Erro ao cadastrar estagiário. Tente novamente.');
    } finally {
      setLoadingCadastrar(false);
    }
  };

  const handleVincularEstagiario = async (estagiarioId: string) => {
    try {
      setLoadingVincular(true);
      if (id) {
        // Vincular no banco de dados
        await vinculacoesService.vincularEstagiario(id as string, estagiarioId);
        
        // Atualizar a lista local
        const estagiarioParaVincular = todosEstagiarios.find(e => e.id === estagiarioId);
        if (estagiarioParaVincular) {
          setEstagiarios(prev => [
            ...prev,
            { ...estagiarioParaVincular, companyEntryDate: new Date() }
          ]);
          setEstagiariosDisponiveis(prev => prev.filter(e => e.id !== estagiarioId));
          setEstagiariosFiltrados(prev => prev.filter(e => e.id !== estagiarioId));
        }
      }
    } catch (error) {
      console.error('Erro ao vincular estagiário:', error);
    } finally {
      setLoadingVincular(false);
    }
  };

  const handleDesvincularEstagiario = async (estagiarioId: string) => {
    try {
      setLoadingVincular(true);
      if (id) {
        await vinculacoesService.desvincularEstagiario(id as string, estagiarioId);
        await cancelContratoLinkTracking(id as string, estagiarioId);
        setEstagiarios(prev => prev.filter(e => e.id !== estagiarioId));
        const estagiarioDesvinculado = todosEstagiarios.find(e => e.id === estagiarioId);
        if (estagiarioDesvinculado) {
          setEstagiariosDisponiveis(prev => [...prev, estagiarioDesvinculado]);
          setEstagiariosFiltrados(prev => [...prev, estagiarioDesvinculado]);
        }
      }
    } catch (error) {
      console.error('Erro ao desvincular estagiário:', error);
    } finally {
      setLoadingVincular(false);
    }
  };


  // Função removida - não utilizada
  // const formatarData = (data: string) => {
  //   if (!data) return '-';
  //   return new Date(data).toLocaleDateString('pt-BR');
  // };

  const formatCurrency = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const estagiariosAtivosRescisao = useMemo(
    () => estagiarios.filter((e) => e.status === 'ativo'),
    [estagiarios]
  );

  const rescisaoEstagiarioSelecionado = useMemo(
    () =>
      estagiariosAtivosRescisao.find((e) => e.id === rescisaoEstagiarioId) ??
      null,
    [estagiariosAtivosRescisao, rescisaoEstagiarioId]
  );

  const rescisaoPreview = useMemo(() => {
    if (!rescisaoEstagiarioSelecionado || !rescisaoDataSaida) return null;
    const bolsa = rescisaoEstagiarioSelecionado.estagioValorBolsa ?? '';
    const dataInicio = rescisaoEstagiarioSelecionado.estagioDataInicio ?? '';
    if (!bolsa.trim() || !dataInicio.trim()) return null;
    return calculateRescisao({
      bolsa,
      dataInicio,
      dataSaida: rescisaoDataSaida,
      dataUltimoPagamento: rescisaoUltimoPagamento,
      descontos: rescisaoDescontos,
    });
  }, [
    rescisaoEstagiarioSelecionado,
    rescisaoDataSaida,
    rescisaoUltimoPagamento,
    rescisaoDescontos,
  ]);

  const handleSelectRescisaoEstagiario = useCallback((estagiarioId: string) => {
    setRescisaoEstagiarioId(estagiarioId);
    setRescisaoDataSaida('');
    setRescisaoUltimoPagamento('');
    setRescisaoDescontos('');
  }, []);

  const handleGerarRescisao = useCallback(async () => {
    if (!cliente || !rescisaoEstagiarioSelecionado) {
      toast.error('Selecione um estagiário ativo.');
      return;
    }
    const bolsa = rescisaoEstagiarioSelecionado.estagioValorBolsa?.trim() ?? '';
    const dataInicio =
      rescisaoEstagiarioSelecionado.estagioDataInicio?.trim() ?? '';
    if (!bolsa || !dataInicio) {
      toast.error(
        'Complete o contrato do estagiário (bolsa e data de início) antes de gerar a rescisão.'
      );
      return;
    }
    if (!rescisaoDataSaida.trim()) {
      toast.error('Informe a data de saída.');
      return;
    }
    const preview = calculateRescisao({
      bolsa,
      dataInicio,
      dataSaida: rescisaoDataSaida,
      dataUltimoPagamento: rescisaoUltimoPagamento,
      descontos: rescisaoDescontos,
    });
    if (!preview) {
      toast.error(
        'Datas inválidas. A data de saída deve ser igual ou posterior à data de início e ao último pagamento.'
      );
      return;
    }
    try {
      setGeneratingRescisao(true);
      const blob = await generateRescisaoDocxBlob({
        empresaRazaoSocial: cliente.razaoSocial,
        empresaCnpj: cliente.cnpj,
        empresaCidade: cliente.cidade,
        estagiarioNome: rescisaoEstagiarioSelecionado.nome,
        estagiarioCpf: formatCpfDisplay(
          rescisaoEstagiarioSelecionado.cpf
        ).replace(/^-$/, ''),
        bolsa,
        dataInicio,
        dataSaida: rescisaoDataSaida,
        dataUltimoPagamento: rescisaoUltimoPagamento,
        descontos: rescisaoDescontos,
      });
      downloadRescisaoDocx(blob, rescisaoEstagiarioSelecionado.nome);
      toast.success('Rescisão gerada com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar a rescisão.'
      );
    } finally {
      setGeneratingRescisao(false);
    }
  }, [
    cliente,
    rescisaoEstagiarioSelecionado,
    rescisaoDataSaida,
    rescisaoUltimoPagamento,
    rescisaoDescontos,
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'vencido':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'aberto':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pago':
        return 'Pago';
      case 'vencido':
        return 'Vencido';
      case 'aberto':
        return 'Aberto';
      default:
        return 'Indefinido';
    }
  };

  // Função removida - não utilizada
  /*
  const getDiasVencimentoText = (dataVencimento: Date | string) => {
    // Converter string para Date se necessário
    let dataVencimentoDate: Date;
    if (typeof dataVencimento === 'string') {
      // Se é string, assumir que é apenas o dia e criar uma data para o mês atual
      const dia = parseInt(dataVencimento, 10);
      if (isNaN(dia)) {
        return 'Data inválida';
      }
      const hoje = new Date();
      dataVencimentoDate = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    } else {
      dataVencimentoDate = dataVencimento;
    }
    
    const hoje = new Date();
    const dias = Math.ceil((dataVencimentoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dias < 0) {
      return `${Math.abs(dias)} dias em atraso`;
    } else if (dias === 0) {
      return 'Vence hoje';
    } else if (dias === 1) {
      return 'Vence amanhã';
    } else {
      return `Vence em ${dias} dias`;
    }
  };
  */


  const marcarComoPago = async (mensalidade: Mensalidade) => {
    const abertas = mensalidades.filter(m => m.status !== 'pago');
    const ehUltimaParcelaAberta = abertas.length === 1 && abertas[0].id === mensalidade.id;
    try {
      setLoadingMensalidade(true);
      const formaPagamentoPlano = mensalidade.formaPagamento || 'pix';
      await mensalidadesService.marcarComoPago(mensalidade.id, new Date(), formaPagamentoPlano as 'pix' | 'boleto');
      await loadMensalidades();
      if (ehUltimaParcelaAberta) {
        setMensalidadeParaGerarParcelas(mensalidade);
        setShowGerarParcelasModal(true);
      }
    } catch (error) {
      console.error('Erro ao marcar mensalidade como paga:', error);
      alert('Erro ao marcar mensalidade como paga');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const fecharModalGerarParcelas = () => {
    setShowGerarParcelasModal(false);
    setMensalidadeParaGerarParcelas(null);
  };

  const gerarDozeParcelas = async () => {
    const base = mensalidadeParaGerarParcelas;
    if (!base || !id || !cliente) return;
    try {
      setLoadingMensalidade(true);
      const dataBase = base.dataVencimento instanceof Date ? base.dataVencimento : new Date(base.dataVencimento);
      const diaVencimento = dataBase.getDate();
      for (let i = 0; i < 12; i++) {
        const dataVencimentoParcela = new Date(dataBase.getFullYear(), dataBase.getMonth() + 1 + i, 1);
        const ultimoDiaMes = new Date(dataVencimentoParcela.getFullYear(), dataVencimentoParcela.getMonth() + 1, 0).getDate();
        dataVencimentoParcela.setDate(Math.min(diaVencimento, ultimoDiaMes));
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataComp = new Date(dataVencimentoParcela);
        dataComp.setHours(0, 0, 0, 0);
        const status: 'pago' | 'vencido' | 'aberto' = dataComp < hoje ? 'vencido' : 'aberto';
        await mensalidadesService.create({
          clienteId: id as string,
          clienteNome: cliente.razaoSocial,
          dataVencimento: dataVencimentoParcela,
          valor: base.valor,
          status,
          observacoes: base.observacoes ?? '',
          numeroParcela: i + 1,
          totalParcelas: 12,
          formaPagamento: base.formaPagamento ?? 'pix'
        });
      }
      fecharModalGerarParcelas();
      await loadMensalidades();
    } catch (error) {
      console.error('Erro ao gerar parcelas:', error);
      alert('Erro ao gerar parcelas. Tente novamente.');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const marcarComoNaoPago = async (mensalidadeId: string) => {
    try {
      await mensalidadesService.marcarComoNaoPago(mensalidadeId);
      await loadMensalidades();
    } catch (error) {
      console.error('Erro ao marcar mensalidade como não pago:', error);
      alert('Erro ao marcar mensalidade como não pago');
    }
  };

  const toggleMenu = (
    id: string,
    event: React.MouseEvent,
    layout?: { width: number; height: number }
  ) => {
    if (menuAberto === id) {
      setMenuAberto(null);
    } else {
      const menuWidth = layout?.width ?? 192;
      const menuHeight = layout?.height ?? 120;
      const x = event.clientX;
      const y = event.clientY;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + menuWidth / 2 > viewportWidth) {
        adjustedX = viewportWidth - menuWidth / 2 - 10;
      } else if (x - menuWidth / 2 < 0) {
        adjustedX = menuWidth / 2 + 10;
      }

      if (y + menuHeight > viewportHeight) {
        adjustedY = y - menuHeight - 10;
      }

      setMenuLayout({ width: menuWidth, height: menuHeight });
      setMenuPosition({
        x: adjustedX,
        y: adjustedY
      });
      setMenuAberto(id);
    }
  };

  const fecharMenu = () => {
    setMenuAberto(null);
  };

  const handleOpenCopyFormularioModal = () => {
    setCopyFormularioFilialId('');
    setCopyFormularioNome('');
    setCopyFormularioTelefone('');
    setShowCopyFormularioModal(true);
  };

  const handleCloseCopyFormularioModal = () => {
    setShowCopyFormularioModal(false);
    setCopyFormularioFilialId('');
    setCopyFormularioNome('');
    setCopyFormularioTelefone('');
  };

  const handleCopyFormularioCadastroLink = async () => {
    const clienteIdParam =
      typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
    if (!clienteIdParam || typeof window === 'undefined') return;
    if (!copyFormularioNome.trim() || !copyFormularioTelefone.trim()) {
      toast.error('Informe o nome e o telefone do estagiário.');
      return;
    }
    try {
      setLoadingCopyFormularioLink(true);
      const estagiarioId = await estagiariosService.add({
        nome: copyFormularioNome.trim(),
        telefone1: copyFormularioTelefone.replace(/\D/g, ''),
        email: '',
        uf: 'DF',
        cidade: '',
        bairro: '',
        endereco: '',
        grauInstrucao: 'medio',
        status: 'ativo',
        ...(copyFormularioFilialId ? { empresaFilialId: copyFormularioFilialId } : {}),
      });
      await clienteContratoLinksService.add({
        clienteId: clienteIdParam,
        estagiarioId,
        nome: copyFormularioNome.trim(),
        telefone: copyFormularioTelefone.replace(/\D/g, ''),
        ...(copyFormularioFilialId ? { filialId: copyFormularioFilialId } : {}),
        status: 'contrato_pendente',
      });
      const params = new URLSearchParams({
        clienteId: clienteIdParam,
        estagiarioId,
      });
      if (copyFormularioFilialId) {
        params.set('filialId', copyFormularioFilialId);
      }
      const url = `${window.location.origin}/formulario-contrato-estagio?${params.toString()}`;
      await navigator.clipboard.writeText(url);
      toast.success(
        'Link copiado. Acompanhe em Entrevistas → Links de contrato.'
      );
      handleCloseCopyFormularioModal();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar link do formulário.');
    } finally {
      setLoadingCopyFormularioLink(false);
    }
  };

  const handleCopyAceiteTermosLink = async () => {
    const clienteIdParam =
      typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
    if (!clienteIdParam || typeof window === 'undefined') return;
    const url = `${window.location.origin}/aceite-termos?clienteId=${encodeURIComponent(clienteIdParam)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link de aceite copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar automaticamente.');
      toast(url, { duration: 10000 });
    }
  };

  const handleDownloadTermosAceite = async () => {
    const path = cliente?.termosAceite?.pdfDrivePath?.trim();
    if (!path) {
      toast.error('Comprovante ainda não disponível.');
      return;
    }
    if (!getSupabaseBrowserClient()) {
      toast.error('Configure o Drive (Supabase) para baixar o comprovante.');
      return;
    }
    setDownloadingTermosAceite(true);
    try {
      const url = await driveStorageService.getSignedDownloadUrl(path);
      const res = await fetch(url);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `Aceite_Termos_${(cliente?.nomeFantasia || cliente?.razaoSocial || 'Cliente').replace(/[^\w.\-()+ ]/g, '_')}.pdf`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível baixar o comprovante.');
    } finally {
      setDownloadingTermosAceite(false);
    }
  };

  const handleViewInternContract = async (estagiario: EstagiarioWithCompanyEntry) => {
    if (!estagiario.id) return;
    if (!getSupabaseBrowserClient()) {
      alert('Configure o Drive (Supabase) para visualizar contratos.');
      fecharMenu();
      return;
    }
    try {
      setLoadingContractEstagiarioId(estagiario.id);
      let targetPath = estagiario.contratoPdfDrivePath ?? '';
      if (!targetPath) {
        const files = await driveStorageService.listAll();
        const contracts = files.filter((f) => f.category === 'contrato');
        const parts = normalizeDriveMatch(estagiario.nome)
          .split(/\s+/)
          .filter((p) => p.length >= 3);
        const match =
          contracts.find((f) => {
            const dn = normalizeDriveMatch(f.displayName);
            return parts.length > 0 && parts.every((p) => dn.includes(p));
          }) ?? null;
        if (!match) {
          alert(
            'Nenhum arquivo de contrato encontrado para este estagiário. Peça o preenchimento do formulário ou envie o contrato pelo Drive.'
          );
          fecharMenu();
          return;
        }
        targetPath = match.fullPath;
      }
      const url = await driveStorageService.getSignedDownloadUrl(targetPath);
      setContractPreviewPath(targetPath);
      setContractPreviewUrl(url);
      setContractPreviewOpen(true);
      fecharMenu();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Não foi possível abrir o contrato.');
    } finally {
      setLoadingContractEstagiarioId(null);
    }
  };

  const closeContractPreview = () => {
    setContractPreviewOpen(false);
    setContractPreviewUrl(null);
    setContractPreviewPath(null);
  };

  const handleDownloadContract = useCallback(async () => {
    if (!contractPreviewUrl || typeof window === 'undefined') return;
    const seg = contractPreviewPath?.split('/').pop() ?? '';
    const displayName = seg ? displayNameFromStorageName(seg) : 'contrato.docx';
    const lower = displayName.toLowerCase();
    const pdfFallbackName = `${displayName.replace(/\.(docx|doc)$/i, '') || 'contrato'}.pdf`;
    setContractDownloading(true);
    try {
      const res = await fetch(contractPreviewUrl);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const isPdf = blob.type === 'application/pdf' || lower.endsWith('.pdf');
      const downloadName = isPdf
        ? lower.endsWith('.pdf')
          ? displayName
          : pdfFallbackName
        : displayName;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = downloadName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(contractPreviewUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setContractDownloading(false);
    }
  }, [contractPreviewUrl, contractPreviewPath]);

  const handleOpenContractEditForm = (estagiario: EstagiarioWithCompanyEntry) => {
    fecharMenu();
    const cid =
      typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
    if (!cid || !estagiario.id) return;
    void router.push(
      `/formulario-contrato-estagio?clienteId=${encodeURIComponent(cid)}&estagiarioId=${encodeURIComponent(estagiario.id)}`
    );
  };

  const abrirModalMulta = (mensalidade: Mensalidade) => {
    setMensalidadeParaMulta(mensalidade);
    setMultaPercentual(mensalidade.multaPercentual ? mensalidade.multaPercentual.toString() : '');
    setShowMultaModal(true);
  };

  const abrirModalVencimento = (mensalidade: Mensalidade) => {
    setMensalidadeParaEditar(mensalidade);
    // Extrair dia atual do vencimento
    const data = mensalidade.dataVencimento instanceof Date 
      ? mensalidade.dataVencimento 
      : new Date(mensalidade.dataVencimento);
    setNovoVencimento(data.getDate().toString());
    setShowVencimentoModal(true);
    fecharMenu();
  };

  const abrirModalValor = (mensalidade: Mensalidade) => {
    setMensalidadeParaEditar(mensalidade);
    setNovoValor(formatCurrency(mensalidade.valor));
    setShowValorModal(true);
    fecharMenu();
  };

  const fecharModalVencimento = () => {
    setShowVencimentoModal(false);
    setMensalidadeParaEditar(null);
    setNovoVencimento('');
    setEditingBulkIds(null);
  };

  const fecharModalValor = () => {
    setShowValorModal(false);
    setMensalidadeParaEditar(null);
    setNovoValor('');
    setEditingBulkIds(null);
  };

  const abrirModalExcluir = (mensalidade: Mensalidade) => {
    setMensalidadeParaExcluir(mensalidade);
    setShowExcluirModal(true);
    fecharMenu();
  };

  const fecharModalExcluir = () => {
    setShowExcluirModal(false);
    setMensalidadeParaExcluir(null);
    setExcluirBulkIds(null);
  };

  const abrirBarraExcluir = useCallback(() => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    setMensalidadeParaExcluir(null);
    setExcluirBulkIds(ids);
    setShowExcluirModal(true);
  }, [selectedParcelasIds]);

  const abrirModalFormaPagamento = (mensalidade: Mensalidade) => {
    setMensalidadeParaEditarFormaPagamento(mensalidade);
    const formaAtual = mensalidade.formaPagamento || 'pix';
    setNovaFormaPagamento(formaAtual as 'pix' | 'boleto');
    setShowFormaPagamentoModal(true);
    fecharMenu();
  };

  const fecharModalFormaPagamento = () => {
    setShowFormaPagamentoModal(false);
    setMensalidadeParaEditarFormaPagamento(null);
    setNovaFormaPagamento('pix');
    setEditingBulkIds(null);
  };

  const toggleParcelaSelection = useCallback((id: string) => {
    setSelectedParcelasIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllMensalidades = useCallback(() => {
    if (selectedParcelasIds.size === mensalidades.length) {
      setSelectedParcelasIds(new Set());
    } else {
      setSelectedParcelasIds(new Set(mensalidades.map(m => m.id)));
    }
  }, [mensalidades, selectedParcelasIds.size]);

  const abrirBarraVencimento = useCallback(() => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    const first = mensalidades.find(m => m.id === ids[0]);
    setMensalidadeParaEditar(null);
    setEditingBulkIds(ids);
    if (first) {
      const data = first.dataVencimento instanceof Date ? first.dataVencimento : new Date(first.dataVencimento);
      setNovoVencimento(data.getDate().toString());
    } else {
      setNovoVencimento('');
    }
    setShowVencimentoModal(true);
  }, [selectedParcelasIds, mensalidades]);

  const abrirBarraValor = useCallback(() => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    const first = mensalidades.find(m => m.id === ids[0]);
    setMensalidadeParaEditar(null);
    setEditingBulkIds(ids);
    setNovoValor(first ? formatCurrency(first.valor) : '');
    setShowValorModal(true);
  }, [selectedParcelasIds, mensalidades]);

  const abrirBarraFormaPagamento = useCallback(() => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    const first = mensalidades.find(m => m.id === ids[0]);
    setMensalidadeParaEditarFormaPagamento(null);
    setEditingBulkIds(ids);
    setNovaFormaPagamento((first?.formaPagamento as 'pix' | 'boleto') || 'pix');
    setShowFormaPagamentoModal(true);
  }, [selectedParcelasIds, mensalidades]);

  const marcarSelecionadasComoPago = useCallback(async () => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    const selecionadas = mensalidades.filter(m => ids.includes(m.id));
    try {
      setLoadingMensalidade(true);
      for (const m of selecionadas) {
        await mensalidadesService.marcarComoPago(m.id, new Date(), (m.formaPagamento || 'pix') as 'pix' | 'boleto');
      }
      await loadMensalidades();
      setSelectedParcelasIds(new Set());
    } catch (error) {
      console.error('Erro ao marcar mensalidades como pagas:', error);
      alert('Erro ao marcar mensalidades como pagas');
    } finally {
      setLoadingMensalidade(false);
    }
  }, [selectedParcelasIds, mensalidades, loadMensalidades]);

  const marcarSelecionadasComoNaoPago = useCallback(async () => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    try {
      setLoadingMensalidade(true);
      for (const id of ids) {
        await mensalidadesService.marcarComoNaoPago(id);
      }
      await loadMensalidades();
      setSelectedParcelasIds(new Set());
    } catch (error) {
      console.error('Erro ao marcar mensalidades como não pagas:', error);
      alert('Erro ao marcar mensalidades como não pagas');
    } finally {
      setLoadingMensalidade(false);
    }
  }, [selectedParcelasIds, loadMensalidades]);

  const handleSalvarFormaPagamento = async () => {
    const ids = editingBulkIds && editingBulkIds.length > 0 ? editingBulkIds : (mensalidadeParaEditarFormaPagamento ? [mensalidadeParaEditarFormaPagamento.id] : null);
    if (!ids || ids.length === 0) return;
    try {
      setLoadingMensalidade(true);
      for (const id of ids) {
        await mensalidadesService.update(id, { formaPagamento: novaFormaPagamento });
      }
      await loadMensalidades();
      if (editingBulkIds?.length) setSelectedParcelasIds(new Set());
      fecharModalFormaPagamento();
      alert(ids.length > 1 ? 'Formas de pagamento alteradas com sucesso!' : 'Forma de pagamento alterada com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar forma de pagamento:', error);
      alert('Erro ao alterar forma de pagamento');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const excluirMensalidade = async () => {
    const ids = excluirBulkIds && excluirBulkIds.length > 0 ? excluirBulkIds : (mensalidadeParaExcluir ? [mensalidadeParaExcluir.id] : null);
    if (!ids || ids.length === 0) return;

    try {
      setLoadingMensalidade(true);
      if (excluirBulkIds && excluirBulkIds.length > 0) {
        for (const id of ids) {
          await mensalidadesService.delete(id);
        }
        setSelectedParcelasIds(new Set());
      } else {
        await mensalidadesService.delete(ids[0]);
      }
      await loadMensalidades();
      fecharModalExcluir();
      alert(ids.length > 1 ? 'Parcelas excluídas com sucesso!' : 'Parcela excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir mensalidade:', error);
      alert('Erro ao excluir mensalidade');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const handleSalvarVencimento = async () => {
    if (!novoVencimento) return;
    const dia = parseInt(novoVencimento);
    if (dia < 1 || dia > 31) {
      alert('Por favor, informe um dia válido (1 a 31).');
      return;
    }
    const ids = editingBulkIds && editingBulkIds.length > 0 ? editingBulkIds : (mensalidadeParaEditar ? [mensalidadeParaEditar.id] : null);
    if (!ids || ids.length === 0) return;
    try {
      setLoadingMensalidade(true);
      if (editingBulkIds && editingBulkIds.length > 0) {
        for (const id of ids) {
          const m = mensalidades.find(mens => mens.id === id);
          if (m) {
            const novaDataVencimento = new Date(m.dataVencimento instanceof Date ? m.dataVencimento : new Date(m.dataVencimento));
            novaDataVencimento.setDate(dia);
            await mensalidadesService.update(id, { dataVencimento: novaDataVencimento });
          }
        }
        setSelectedParcelasIds(new Set());
      } else if (mensalidadeParaEditar) {
        const novaDataVencimento = new Date(mensalidadeParaEditar.dataVencimento);
        novaDataVencimento.setDate(dia);
        await mensalidadesService.update(mensalidadeParaEditar.id, { dataVencimento: novaDataVencimento });
      }
      await loadMensalidades();
      fecharModalVencimento();
      alert(ids.length > 1 ? 'Datas de vencimento alteradas com sucesso!' : 'Data de vencimento alterada com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar vencimento:', error);
      alert('Erro ao alterar data de vencimento');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const handleSalvarValor = async () => {
    if (!novoValor) return;
    const valorNumerico = (() => {
      const digits = novoValor.replace(/\D/g, '');
      if (digits === '') return 0;
      return parseInt(digits, 10) / 100;
    })();
    if (valorNumerico <= 0) {
      alert('Por favor, informe um valor válido.');
      return;
    }
    const ids = editingBulkIds && editingBulkIds.length > 0 ? editingBulkIds : (mensalidadeParaEditar ? [mensalidadeParaEditar.id] : null);
    if (!ids || ids.length === 0) return;
    try {
      setLoadingMensalidade(true);
      if (editingBulkIds && editingBulkIds.length > 0) {
        for (const id of ids) {
          await mensalidadesService.update(id, { valor: valorNumerico });
        }
        setSelectedParcelasIds(new Set());
      } else {
        await mensalidadesService.update(ids[0], { valor: valorNumerico });
      }
      await loadMensalidades();
      fecharModalValor();
      alert(ids.length > 1 ? 'Valores alterados com sucesso!' : 'Valor alterado com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar valor:', error);
      alert('Erro ao alterar valor');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const handleValorChange = (value: string) => {
    // Máscara por dígitos: últimos 2 como centavos
    const digits = value.replace(/\D/g, '');
    if (digits === '') {
      setNovoValor('');
      return;
    }
    const centsValue = parseInt(digits, 10) / 100;
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(isNaN(centsValue) ? 0 : centsValue);
    
    setNovoValor(formattedValue);
  };

  const handleValorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      setNovoValor('');
    }
  };

  const aplicarMulta = async () => {
    if (!mensalidadeParaMulta) return;
    const perc = parseFloat(multaPercentual.replace(',', '.'));
    if (isNaN(perc) || perc <= 0) {
      alert('Informe um percentual válido (> 0).');
      return;
    }

    try {
      setLoadingMensalidade(true);
      const novoValor = Math.round((mensalidadeParaMulta.valor * (1 + perc / 100)) * 100) / 100;
      
      await mensalidadesService.update(mensalidadeParaMulta.id, {
        valor: novoValor,
        multaPercentual: perc,
        observacoes: `Multa de ${perc}% aplicada em ${new Date().toLocaleDateString('pt-BR')}`
      });

      await loadMensalidades();
      
      setShowMultaModal(false);
      setMensalidadeParaMulta(null);
      alert('Multa aplicada com sucesso!');
    } catch (error) {
      console.error('Erro ao aplicar multa:', error);
      alert('Erro ao aplicar multa');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  // Calcular resumo financeiro
  const resumoFinanceiro = {
    total: mensalidades.reduce((acc, m) => acc + m.valor, 0),
    recebido: mensalidades
      .filter(m => m.status === 'pago')
      .reduce((acc, m) => acc + m.valor, 0),
    aReceber: mensalidades
      .filter(m => m.status === 'aberto')
      .reduce((acc, m) => acc + m.valor, 0),
    vencido: mensalidades
      .filter(m => m.status === 'vencido')
      .reduce((acc, m) => acc + m.valor, 0)
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
          <PainelHeader />
          <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
            <div className="flex justify-center items-center h-64">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400"></div>
              <p className="ml-3 text-gray-600 dark:text-gray-300">Carregando detalhes do cliente...</p>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (!cliente) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
          <PainelHeader />
          <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cliente não encontrado</h1>
              <button
                onClick={() => router.push('/clientes')}
                className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Voltar para Clientes
              </button>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
        <PainelHeader />

        <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
          {/* Cabeçalho */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2">
                  {cliente.razaoSocial}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
                  {cliente.nomeFantasia}
                </p>
              </div>
              <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push('/clientes')}
                  className="bg-gray-600 dark:bg-slate-700 hover:bg-gray-700 dark:hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleOpenFilialModal}
                  className="bg-slate-600 dark:bg-slate-600 hover:bg-slate-700 dark:hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Adicionar Filial
                </button>
                <button
                  onClick={handleEdit}
                  className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Editar Cliente
                </button>
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg mb-6 transition-colors">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'info'
                      ? 'border-[#004085] dark:border-blue-400 text-[#004085] dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  Informações
                </button>
                <button
                  onClick={() => setActiveTab('estagiarios')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'estagiarios'
                      ? 'border-[#004085] dark:border-blue-400 text-[#004085] dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  Estagiários ({estagiarios.length})
                </button>
                <button
                  onClick={() => setActiveTab('financeiro')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'financeiro'
                      ? 'border-[#004085] dark:border-blue-400 text-[#004085] dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  Financeiro ({mensalidades.length})
                </button>
                <button
                  onClick={() => setActiveTab('rescisao')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'rescisao'
                      ? 'border-[#004085] dark:border-blue-400 text-[#004085] dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  Rescisão
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('notaFiscal')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'notaFiscal'
                        ? 'border-[#004085] dark:border-blue-400 text-[#004085] dark:text-blue-400'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    Nota Fiscal ({nfseEmissions.length})
                  </button>
                )}
              </nav>
            </div>

            <div className="p-6">
              {/* Aba Informações */}
              {activeTab === 'info' && (
                <div>
                  <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400 mb-6">Informações do Cliente</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        CNPJ
                      </label>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{cliente.cnpj}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Razão Social
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.razaoSocial}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nome Fantasia
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.nomeFantasia}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Telefone
                      </label>
                      {cliente.telefone ? (
                        <a
                          href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 hover:underline cursor-pointer transition-colors"
                        >
                          {cliente.telefone}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-900 dark:text-gray-100">-</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.email}</p>
                    </div>

                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Endereço (logradouro)
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {cliente.endereco?.trim() ? cliente.endereco : '-'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <span 
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cliente.status === 'ativo' 
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : cliente.status === 'em-andamento'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : cliente.status === 'bloqueado'
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {cliente.status === 'ativo' ? 'Ativo' : 
                         cliente.status === 'em-andamento' ? 'Em andamento' :
                         cliente.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Forma de Captação
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {getFormaCaptacaoLabel(cliente.formaCaptacao)}
                        {cliente.formaCaptacaoDetalhe?.trim()
                          ? ` — ${cliente.formaCaptacaoDetalhe}`
                          : ''}
                      </p>
                    </div>

                    {cliente.motivoStatus && (
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Motivo do Status
                        </label>
                        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-900 dark:text-gray-100 italic">
                            &ldquo;{cliente.motivoStatus}&rdquo;
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        UF
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {cliente.uf?.trim() ? cliente.uf : '-'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cidade
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.cidade}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bairro
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.bairro}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        CEP
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.cep}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Responsável
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.responsavel}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cargo do representante
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {cliente.responsavelCargo?.trim() ? cliente.responsavelCargo : '-'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Dia de Vencimento
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {(() => {
                          const dv = cliente.dataVencimento;
                          if (!dv) return '-';
                          if (dv.includes('-')) {
                            const parts = dv.split('-');
                            return parts[2]; // Retorna apenas o dia
                          }
                          return dv; // Já é apenas o dia
                        })()}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Valor
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">{cliente.valor || 'R$ 0,00'}</p>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                        Termos de contratação
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopyAceiteTermosLink()}
                          className="bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                          Copiar link de aceite
                        </button>
                        {cliente.termosAceite?.aceito &&
                          cliente.termosAceite.versaoTermos === VERSAO_TERMOS &&
                          cliente.termosAceite.pdfDrivePath && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadTermosAceite()}
                              disabled={downloadingTermosAceite}
                              className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                              {downloadingTermosAceite
                                ? 'Baixando...'
                                : 'Baixar comprovante'}
                            </button>
                          )}
                      </div>
                    </div>
                    {cliente.termosAceite?.aceito &&
                    cliente.termosAceite.versaoTermos === VERSAO_TERMOS ? (
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Aceito em{' '}
                        {(() => {
                          const d = toDate(cliente.termosAceite.aceitoEm);
                          return d
                            ? d.toLocaleString('pt-BR')
                            : 'data registrada';
                        })()}{' '}
                        por {cliente.termosAceite.nomeSignatario}
                        {cliente.termosAceite.cargoSignatario
                          ? ` (${cliente.termosAceite.cargoSignatario})`
                          : ''}
                        .
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Pendente — envie o link para o cliente ler e aceitar os
                        termos.
                      </p>
                    )}
                  </div>

                  <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                        Filiais ({cliente.filiais?.length ?? 0})
                      </h3>
                      <button
                        type="button"
                        onClick={handleOpenFilialModal}
                        disabled={loadingFilialAction}
                        className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors self-start"
                      >
                        Adicionar Filial
                      </button>
                    </div>

                    {(cliente.filiais?.length ?? 0) === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma filial cadastrada.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Nome Fantasia
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                CNPJ
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Cidade
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Responsável
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {(cliente.filiais ?? []).map((filial) => (
                              <tr key={filial.id}>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {filial.nomeFantasia}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {filial.cnpj}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {filial.cidade}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                  {filial.responsavel}
                                </td>
                                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleEditFilialFromInfo(filial)}
                                    disabled={loadingFilialAction}
                                    className="text-[#004085] dark:text-blue-400 hover:underline mr-3 disabled:opacity-50"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleRemoveFilialFromInfo(filial.id)}
                                    disabled={loadingFilialAction}
                                    className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                                  >
                                    Remover
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Aba Estagiários */}
              {activeTab === 'estagiarios' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">
                      Estagiários Vinculados ({estagiarios.length})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void loadEstagiarios()}
                        disabled={loadingEstagiarios}
                        className="bg-slate-600 dark:bg-slate-600 hover:bg-slate-700 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Recarregar
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenCopyFormularioModal}
                        className="bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Copiar link do formulário
                      </button>
                      <button
                        onClick={handleVincular}
                        className="bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Vincular existente
                      </button>
                       <button
                         onClick={handleCadastrar}
                         className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                       >
                         Cadastrar novo
                       </button>
                    </div>
                  </div>

                  {loadingEstagiarios ? (
                    <div className="p-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400"></div>
                      <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando estagiários...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {estagiarios.length > 0 ? (
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-slate-700">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Nome Completo
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Filial
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                CPF
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Data de Nascimento
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Telefone
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Data de entrada
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Valor da bolsa
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {estagiarios.map((estagiario) => {
                              const filial = resolveEstagiarioFilial(cliente, estagiario);
                              return (
                              <tr key={estagiario.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{estagiario.nome}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {filial ? (
                                    <>
                                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {filial.nomeFantasia?.trim() || filial.razaoSocial}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {filial.cnpj}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                      Matriz
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatCpfDisplay(estagiario.cpf)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatarDataNascimento(estagiario.dataNascimento)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatPhoneDisplay(estagiario.telefone1)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatarDataNascimento(estagiario.estagioDataInicio)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatBolsaDisplay(estagiario.estagioValorBolsa)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        toggleMenu(internRowMenuId(estagiario.id!), e, {
                                          width: 224,
                                          height: 176
                                        })
                                      }
                                      className="menu-button p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
                                      aria-label="Ações do estagiário"
                                    >
                                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                      </svg>
                                    </button>
                                    {menuAberto === internRowMenuId(estagiario.id!) && (
                                      <div
                                        className="menu-dropdown fixed bg-white dark:bg-slate-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700"
                                        style={{
                                          left: `${menuPosition.x}px`,
                                          top: `${menuPosition.y}px`,
                                          width: `${menuLayout.width}px`,
                                          transform: 'translate(-50%, 10px)'
                                        }}
                                      >
                                        <div className="py-1">
                                          <button
                                            type="button"
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={loadingContractEstagiarioId === estagiario.id}
                                            onClick={() => void handleViewInternContract(estagiario)}
                                          >
                                            {loadingContractEstagiarioId === estagiario.id ? (
                                              <span className="inline-flex items-center gap-2">
                                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                Ver Contrato
                                              </span>
                                            ) : (
                                              'Ver Contrato'
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                                            onClick={() => handleOpenContractEditForm(estagiario)}
                                          >
                                            Editar contrato
                                          </button>
                                          <button
                                            type="button"
                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={loadingVincular}
                                            onClick={() => {
                                              void handleDesvincularEstagiario(estagiario.id!);
                                              fecharMenu();
                                            }}
                                          >
                                            {loadingVincular ? (
                                              <span className="inline-flex items-center gap-2">
                                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                Desvincular Estagiário
                                              </span>
                                            ) : (
                                              'Desvincular Estagiário'
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500 dark:text-gray-400">Nenhum estagiário vinculado a este cliente.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Aba Financeiro */}
              {activeTab === 'financeiro' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">Financeiro</h2>
                    <button
                      onClick={handleAdicionarPlano}
                      className="bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Adicionar Plano de Pagamento
                    </button>
                  </div>
                  
                  {/* Resumo Financeiro */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-slate-700 rounded-lg shadow p-4 transition-colors">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Valor Total</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(resumoFinanceiro.total)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-700 rounded-lg shadow p-4 transition-colors">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Recebido</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(resumoFinanceiro.recebido)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-700 rounded-lg shadow p-4 transition-colors">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">A Receber</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(resumoFinanceiro.aReceber)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-700 rounded-lg shadow p-4 transition-colors">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Vencido</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(resumoFinanceiro.vencido)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedParcelasIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                        {selectedParcelasIds.size} parcela(s) selecionada(s)
                      </span>
                      <button
                        onClick={marcarSelecionadasComoPago}
                        disabled={loadingMensalidade}
                        className="px-3 py-1.5 text-sm bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        Marcar como Pago
                      </button>
                      <button
                        onClick={marcarSelecionadasComoNaoPago}
                        disabled={loadingMensalidade}
                        className="px-3 py-1.5 text-sm bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        Marcar como Não Pago
                      </button>
                      <button
                        onClick={abrirBarraVencimento}
                        className="px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Alterar vencimento
                      </button>
                      <button
                        onClick={abrirBarraFormaPagamento}
                        className="px-3 py-1.5 text-sm bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Alterar forma de pagamento
                      </button>
                      <button
                        onClick={abrirBarraValor}
                        className="px-3 py-1.5 text-sm bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Alterar valor
                      </button>
                      <button
                        onClick={abrirBarraExcluir}
                        className="px-3 py-1.5 text-sm bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Excluir parcela
                      </button>
                      <button
                        onClick={() => setSelectedParcelasIds(new Set())}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  )}

                  {/* Tabela de Mensalidades */}
                  {loadingMensalidades ? (
                    <div className="p-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400"></div>
                      <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando mensalidades...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {mensalidades.length > 0 ? (
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left">
                                <input
                                  type="checkbox"
                                  checked={mensalidades.length > 0 && selectedParcelasIds.size === mensalidades.length}
                                  onChange={toggleSelectAllMensalidades}
                                  className="h-4 w-4 accent-[#004085] text-[#004085] focus:ring-2 focus:ring-[#004085] border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                                />
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Descrição
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Parcela
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Vencimento
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Valor
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                DT. Pagamento
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Pagamento
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {mensalidades.map((mensalidade) => (
                              <tr key={mensalidade.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                                <td className="px-4 py-4">
                                  <input
                                    type="checkbox"
                                    checked={selectedParcelasIds.has(mensalidade.id)}
                                    onChange={() => toggleParcelaSelection(mensalidade.id)}
                                    className="h-4 w-4 accent-[#004085] text-[#004085] focus:ring-2 focus:ring-[#004085] border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {mensalidade.observacoes || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {mensalidade.numeroParcela && mensalidade.totalParcelas ? 
                                      `${mensalidade.numeroParcela}/${mensalidade.totalParcelas}` : 
                                      '-'
                                    }
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {(() => {
                                      const data = mensalidade.dataVencimento instanceof Date 
                                        ? mensalidade.dataVencimento 
                                        : new Date(mensalidade.dataVencimento);
                                      return data.toLocaleDateString('pt-BR');
                                    })()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    <div className="flex items-center space-x-1">
                                      <span>{formatCurrency(mensalidade.valor)}</span>
                                      {typeof mensalidade.multaPercentual === 'number' && mensalidade.multaPercentual > 0 && (
                                        <span className="text-orange-500">+ ({mensalidade.multaPercentual}%)</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span 
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(mensalidade.status)}`}
                                  >
                                    {getStatusText(mensalidade.status)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {mensalidade.dataPagamento ? 
                                      (mensalidade.dataPagamento instanceof Date 
                                        ? mensalidade.dataPagamento.toLocaleDateString('pt-BR')
                                        : new Date(mensalidade.dataPagamento).toLocaleDateString('pt-BR')
                                      ) : '-'
                                    }
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {mensalidade.formaPagamento ? (
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        mensalidade.formaPagamento === 'pix' 
                                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                          : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                      }`}>
                                        {mensalidade.formaPagamento.toUpperCase()}
                                      </span>
                                    ) : '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="relative">
                                    <button
                                      onClick={(e) => toggleMenu(mensalidade.id, e)}
                                      className="menu-button p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
                                    >
                                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                      </svg>
                                    </button>

                                    {/* Menu Dropdown */}
                                    {menuAberto === mensalidade.id && (
                                      <div 
                                        className="menu-dropdown fixed bg-white dark:bg-slate-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700"
                                        style={{
                                          left: `${menuPosition.x}px`,
                                          top: `${menuPosition.y}px`,
                                          width: `${menuLayout.width}px`,
                                          transform: 'translate(-50%, 10px)'
                                        }}
                                      >
                                        <div className="py-1">
                                          {mensalidade.status === 'pago' ? (
                                            <button 
                                              className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                              onClick={() => {
                                                marcarComoNaoPago(mensalidade.id);
                                                fecharMenu();
                                              }}
                                              disabled={loadingMensalidade}
                                            >
                                              {loadingMensalidade ? (
                                                <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                                              ) : null}
                                              Marcar como Não Pago
                                            </button>
                                          ) : (
                                            <button 
                                              className="block w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                              onClick={() => {
                                                marcarComoPago(mensalidade);
                                                fecharMenu();
                                              }}
                                              disabled={loadingMensalidade}
                                            >
                                              {loadingMensalidade ? (
                                                <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                                              ) : null}
                                              Marcar como Pago
                                            </button>
                                          )}

                                          {mensalidade.status === 'vencido' && (
                                            <button
                                              className="block w-full text-left px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                              onClick={() => {
                                                abrirModalMulta(mensalidade);
                                                fecharMenu();
                                              }}
                                            >
                                              Aplicar Multa
                                            </button>
                                          )}

                                          {mensalidade.status !== 'pago' && (
                                            <>
                                              <button
                                                className="block w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                                onClick={() => abrirModalVencimento(mensalidade)}
                                              >
                                                Alterar Vencimento
                                              </button>

                                              <button
                                                className="block w-full text-left px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                                onClick={() => abrirModalValor(mensalidade)}
                                              >
                                                Alterar Valor
                                              </button>
                                            </>
                                          )}

                                          <button
                                            className="block w-full text-left px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                            onClick={() => abrirModalFormaPagamento(mensalidade)}
                                          >
                                            Editar Parcela
                                          </button>

                                          <button
                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => abrirModalExcluir(mensalidade)}
                                            disabled={loadingMensalidade}
                                          >
                                            {loadingMensalidade ? (
                                              <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                                            ) : null}
                                            Excluir Parcela
                                          </button>

                                          {mensalidade.observacoes && mensalidade.observacoes.includes('Plano de pagamento') && (
                                            <div className="px-4 py-2 text-xs text-blue-500 dark:text-blue-400 border-t border-gray-200 dark:border-gray-600">
                                              (Plano)
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500 dark:text-gray-400">Nenhuma mensalidade encontrada para este cliente.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'rescisao' && (
                <div>
                  <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400 mb-6">
                    Rescisão de estágio
                  </h2>

                  {estagiariosAtivosRescisao.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">
                        Nenhum estagiário ativo vinculado a este cliente.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Estagiário
                        </label>
                        <select
                          value={rescisaoEstagiarioId}
                          onChange={(e) =>
                            handleSelectRescisaoEstagiario(e.target.value)
                          }
                          className="w-full max-w-xl px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400"
                        >
                          <option value="">Selecione um estagiário ativo</option>
                          {estagiariosAtivosRescisao.map((estagiario) => (
                            <option key={estagiario.id} value={estagiario.id}>
                              {estagiario.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      {rescisaoEstagiarioSelecionado && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome completo
                              </label>
                              <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                                {rescisaoEstagiarioSelecionado.nome}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                CPF
                              </label>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {formatCpfDisplay(
                                  rescisaoEstagiarioSelecionado.cpf
                                )}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Valor da bolsa
                              </label>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {rescisaoEstagiarioSelecionado.estagioValorBolsa ||
                                  '—'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Data de início
                              </label>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {rescisaoEstagiarioSelecionado.estagioDataInicio
                                  ? formatDatePtBr(
                                      rescisaoEstagiarioSelecionado.estagioDataInicio
                                    )
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Razão social
                              </label>
                              <p className="text-sm text-gray-900 dark:text-gray-100">
                                {cliente?.razaoSocial}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                CNPJ
                              </label>
                              <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                                {cliente?.cnpj}
                              </p>
                            </div>
                          </div>

                          {(!rescisaoEstagiarioSelecionado.estagioValorBolsa?.trim() ||
                            !rescisaoEstagiarioSelecionado.estagioDataInicio?.trim()) && (
                            <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                              Complete o contrato do estagiário (bolsa e data de
                              início) antes de gerar a rescisão.
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Data de saída
                              </label>
                              <input
                                type="date"
                                value={rescisaoDataSaida}
                                onChange={(e) =>
                                  setRescisaoDataSaida(e.target.value)
                                }
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Data do último pagamento
                              </label>
                              <input
                                type="date"
                                value={rescisaoUltimoPagamento}
                                onChange={(e) =>
                                  setRescisaoUltimoPagamento(e.target.value)
                                }
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400"
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Opcional. Se vazio, calcula da data de início.
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Descontos
                              </label>
                              <input
                                type="text"
                                value={rescisaoDescontos}
                                onChange={(e) =>
                                  setRescisaoDescontos(e.target.value)
                                }
                                placeholder="R$ 0,00"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400"
                              />
                            </div>
                          </div>

                          {rescisaoPreview && (
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-slate-700/50">
                              <h3 className="text-sm font-semibold text-[#004085] dark:text-blue-400 mb-4">
                                Prévia do cálculo
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Dias trabalhados
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {rescisaoPreview.diasTrabalhados}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Valor do dia
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {rescisaoPreview.valorDiaFmt}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Saldo bolsa-auxílio
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {rescisaoPreview.valorDiasTrabalhadosFmt}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Dias de férias
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {rescisaoPreview.diasFerias}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Valor do dia férias
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {rescisaoPreview.valorDiaFeriasFmt}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Proporcional férias
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {rescisaoPreview.proporcionalFeriasFmt}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Descontos
                                  </p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {rescisaoPreview.descontosFmt}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Valor líquido
                                  </p>
                                  <p className="text-sm font-bold text-[#004085] dark:text-blue-400">
                                    {rescisaoPreview.valorLiquidoFmt}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div>
                            <button
                              type="button"
                              onClick={() => void handleGerarRescisao()}
                              disabled={
                                generatingRescisao ||
                                !rescisaoDataSaida ||
                                !rescisaoPreview ||
                                !rescisaoEstagiarioSelecionado.estagioValorBolsa?.trim() ||
                                !rescisaoEstagiarioSelecionado.estagioDataInicio?.trim()
                              }
                              className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                              {generatingRescisao
                                ? 'Gerando...'
                                : 'Gerar rescisão'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notaFiscal' && isAdmin && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">
                      Nota Fiscal
                    </h2>
                    <button
                      type="button"
                      onClick={() => void openEmitNfseModal()}
                      disabled={!supabaseReady}
                      className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Emitir NFS-e
                    </button>
                  </div>
                  {!supabaseReady && (
                    <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
                      Configure o Supabase para habilitar emissão de NFS-e.
                    </p>
                  )}
                  {loadingNfse ? (
                    <div className="flex justify-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400" />
                    </div>
                  ) : nfseEmissions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">
                        Nenhuma NFS-e emitida para este cliente.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-slate-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              Competência
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              Valor
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              Chave
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {nfseEmissions.map((emission) => (
                            <tr key={emission.id ?? emission.dpsId}>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                {emission.dataCompetencia}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                {formatCurrency(emission.valorServico)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${nfseStatusClass(emission.status)}`}
                                >
                                  {nfseStatusLabel(emission.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 max-w-[180px] truncate">
                                {emission.chaveAcesso ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex flex-wrap gap-2">
                                  {(emission.status === 'pending' ||
                                    emission.status === 'cancel_pending') && (
                                    <button
                                      type="button"
                                      onClick={() => void refreshNfseStatus(emission)}
                                      className="text-[#004085] dark:text-blue-400 hover:underline"
                                    >
                                      Atualizar
                                    </button>
                                  )}
                                  {emission.status === 'authorized' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void handleDownloadNfsePdf(emission)}
                                        disabled={nfseActionId === emission.dpsId}
                                        className="text-[#004085] dark:text-blue-400 hover:underline disabled:opacity-50"
                                      >
                                        PDF
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDownloadNfseXml(emission)}
                                        disabled={nfseActionId === emission.dpsId}
                                        className="text-[#004085] dark:text-blue-400 hover:underline disabled:opacity-50"
                                      >
                                        XML
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openCancelNfseModal(emission)}
                                        disabled={nfseActionId === emission.dpsId}
                                        className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>


          {/* Modal para Vincular Estagiários */}
          <AnimatedModal open={showVincularModal} onClose={() => setShowVincularModal(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                    Vincular Estagiários ao Cliente
                  </h3>
                  <button
                    onClick={() => setShowVincularModal(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Selecione os estagiários que deseja vincular ao cliente <strong className="text-gray-900 dark:text-gray-100">{cliente?.razaoSocial}</strong>
                  </p>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Pesquisar estagiários por nome, email ou telefone..."
                      value={filtroEstagiario}
                      onChange={(e) => setFiltroEstagiario(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {estagiariosFiltrados.length > 0 ? (
                  <div>
                    <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                      {filtroEstagiario ? (
                        <span>
                          {estagiariosFiltrados.length} estagiário{estagiariosFiltrados.length !== 1 ? 's' : ''} encontrado{estagiariosFiltrados.length !== 1 ? 's' : ''} com o filtro &quot;{filtroEstagiario}&quot;
                        </span>
                      ) : (
                        <span>
                          {estagiariosFiltrados.length} estagiário{estagiariosFiltrados.length !== 1 ? 's' : ''} disponível{estagiariosFiltrados.length !== 1 ? 'is' : ''} para vincular
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-slate-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Nome
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Telefone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Cidade
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Grau de Instrução
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {estagiariosFiltrados.map((estagiario) => (
                          <tr key={estagiario.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{estagiario.nome}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">
                                {formatPhoneDisplay(estagiario.telefone1)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.cidade}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.grauInstrucao}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button 
                                onClick={() => handleVincularEstagiario(estagiario.id!)}
                                disabled={loadingVincular}
                                className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loadingVincular ? (
                                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                ) : (
                                  'Vincular'
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filtroEstagiario 
                        ? 'Nenhum estagiário encontrado com o filtro aplicado.' 
                        : 'Todos os estagiários ativos já estão vinculados a este cliente.'
                      }
                    </p>
                    {filtroEstagiario && (
                      <button
                        onClick={() => setFiltroEstagiario('')}
                        className="mt-2 text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 font-medium"
                      >
                        Limpar filtro
                      </button>
                    )}
                  </div>
                )}

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowVincularModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
          </AnimatedModal>

          {/* Modal para Cadastrar Novo Estagiário */}
          <AnimatedModal open={showCadastrarModal} onClose={() => setShowCadastrarModal(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                    Cadastrar Novo Estagiário
                  </h3>
                  <button
                    onClick={() => setShowCadastrarModal(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nome *
                    </label>
                    <input
                      type="text"
                      value={formDataEstagiario.nome}
                      onChange={(e) => setFormDataEstagiario({...formDataEstagiario, nome: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      placeholder="Nome completo do estagiário"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      CPF *
                    </label>
                    <input
                      type="text"
                      value={formDataEstagiario.cpf}
                      onChange={(e) => handleCpfChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Telefone *
                    </label>
                    <input
                      type="text"
                      value={formDataEstagiario.telefone}
                      onChange={(e) => handleTelefoneChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      placeholder="(61) 99999-9999"
                      maxLength={15}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formDataEstagiario.email}
                      onChange={(e) => setFormDataEstagiario({...formDataEstagiario, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={formDataEstagiario.dataNascimento}
                      onChange={(e) => setFormDataEstagiario({...formDataEstagiario, dataNascimento: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Data de início
                      </label>
                      <input
                        type="date"
                        value={formDataEstagiario.estagioDataInicio}
                        onChange={(e) =>
                          setFormDataEstagiario({
                            ...formDataEstagiario,
                            estagioDataInicio: e.target.value
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor da bolsa
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formDataEstagiario.estagioValorBolsa}
                        onChange={(e) => handleEstagioValorBolsaChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCadastrarModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCadastrarEstagiario}
                    disabled={loadingCadastrar || !formDataEstagiario.nome.trim() || !formDataEstagiario.cpf.trim() || !formDataEstagiario.telefone.trim() || !formDataEstagiario.email.trim()}
                    className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingCadastrar ? (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      'Cadastrar e Vincular'
                    )}
                  </button>
                </div>
              </div>
          </AnimatedModal>

          {/* Modal para Plano de Pagamento */}
          <AnimatedModal open={showPlanoModal} onClose={() => setShowPlanoModal(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                    Plano de Pagamento
                  </h3>
                  <button
                    onClick={() => setShowPlanoModal(false)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Primeira linha */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Descrição do serviço prestado / Produto: *
                      </label>
                      <input
                        type="text"
                        value={formDataPlano.descricaoServico}
                        onChange={(e) => setFormDataPlano({...formDataPlano, descricaoServico: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                        placeholder="Ex: Consultoria, Desenvolvimento, Suporte"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Data 1º Vencto: *
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={formDataPlano.dataPrimeiroVencimento}
                          onChange={(e) => setFormDataPlano({...formDataPlano, dataPrimeiroVencimento: e.target.value})}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Segunda linha */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Período de pagamento: *
                      </label>
                      <select
                        value={formDataPlano.periodoPagamento}
                        onChange={(e) => setFormDataPlano({...formDataPlano, periodoPagamento: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="mensal">Mensal</option>
                        <option value="bimestral">Bimestral</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nº de parcelas: *
                      </label>
                      <select
                        value={formDataPlano.numeroParcelas}
                        onChange={(e) => setFormDataPlano({...formDataPlano, numeroParcelas: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="a-vista">À vista</option>
                        <option value="3-parcelas">3 parcelas</option>
                        <option value="6-parcelas">6 parcelas</option>
                        <option value="9-parcelas">9 parcelas</option>
                        <option value="12-parcelas">12 parcelas</option>
                        <option value="18-parcelas">18 parcelas</option>
                        <option value="24-parcelas">24 parcelas</option>
                        <option value="36-parcelas">36 parcelas</option>
                        <option value="48-parcelas">48 parcelas</option>
                        <option value="60-parcelas">60 parcelas</option>
                        <option value="12-parcelas">1 ano</option>
                        <option value="24-parcelas">2 anos</option>
                        <option value="36-parcelas">3 anos</option>
                        <option value="48-parcelas">4 anos</option>
                        <option value="60-parcelas">5 anos</option>
                        <option value="72-parcelas">6 anos</option>
                        <option value="84-parcelas">7 anos</option>
                        <option value="96-parcelas">8 anos</option>
                        <option value="108-parcelas">9 anos</option>
                        <option value="120-parcelas">10 anos</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Valor da Parcela: *
                      </label>
                      <input
                        type="text"
                        value={formDataPlano.valorParcela}
                        onChange={(e) => handleValorParcelaChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>

                  {/* Terceira linha - Forma de Pagamento */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Forma de Pagamento: *
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="formaPagamento"
                            value="pix"
                            checked={formDataPlano.formaPagamento === 'pix'}
                            onChange={(e) => setFormDataPlano({...formDataPlano, formaPagamento: e.target.value as 'pix' | 'boleto'})}
                            className="mr-3 text-[#004085] dark:text-blue-400 focus:ring-[#004085] dark:focus:ring-blue-400"
                          />
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                              </svg>
                            </div>
                            <span className="text-gray-900 dark:text-gray-100">PIX</span>
                          </div>
                        </label>
                        
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="formaPagamento"
                            value="boleto"
                            checked={formDataPlano.formaPagamento === 'boleto'}
                            onChange={(e) => setFormDataPlano({...formDataPlano, formaPagamento: e.target.value as 'pix' | 'boleto'})}
                            className="mr-3 text-[#004085] dark:text-blue-400 focus:ring-[#004085] dark:focus:ring-blue-400"
                          />
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2z" clipRule="evenodd"/>
                              </svg>
                            </div>
                            <span className="text-gray-900 dark:text-gray-100">Boleto</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Valor Total a Receber */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      Valor Total a Receber
                    </h4>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {(() => {
                        if (!formDataPlano.valorParcela || !formDataPlano.numeroParcelas) {
                          return 'R$ 0,00';
                        }
                        
                        // Extrair número de parcelas do valor selecionado
                        const numeroParcelas = (() => {
                          switch (formDataPlano.numeroParcelas) {
                            case 'a-vista': return 1;
                            case '3-parcelas': return 3;
                            case '6-parcelas': return 6;
                            case '9-parcelas': return 9;
                            case '12-parcelas': return 12;
                            case '18-parcelas': return 18;
                            case '24-parcelas': return 24;
                            case '36-parcelas': return 36;
                            case '48-parcelas': return 48;
                            case '60-parcelas': return 60;
                            case '72-parcelas': return 72;
                            case '84-parcelas': return 84;
                            case '96-parcelas': return 96;
                            case '108-parcelas': return 108;
                            case '120-parcelas': return 120;
                            default: return 1;
                          }
                        })();
                        
                        // Converter valor da parcela para número
                        const valorParcelaNumerico = parseFloat(formDataPlano.valorParcela.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                        
                        // Calcular valor total
                        const valorTotal = valorParcelaNumerico * numeroParcelas;
                        
                        // Formatar como moeda
                        return new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(valorTotal);
                      })()}
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      {formDataPlano.numeroParcelas === 'a-vista' 
                        ? 'Pagamento à vista' 
                        : `${(() => {
                            switch (formDataPlano.numeroParcelas) {
                              case '3-parcelas': return '3';
                              case '6-parcelas': return '6';
                              case '9-parcelas': return '9';
                              case '12-parcelas': return '12';
                              case '18-parcelas': return '18';
                              case '24-parcelas': return '24';
                              case '36-parcelas': return '36';
                              case '48-parcelas': return '48';
                              case '60-parcelas': return '60';
                              case '72-parcelas': return '72';
                              case '84-parcelas': return '84';
                              case '96-parcelas': return '96';
                              case '108-parcelas': return '108';
                              case '120-parcelas': return '120';
                              default: return '1';
                            }
                          })()} parcelas de ${formDataPlano.valorParcela || 'R$ 0,00'}`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowPlanoModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSalvarPlano}
                    disabled={loadingMensalidade || !formDataPlano.descricaoServico || !formDataPlano.dataPrimeiroVencimento || !formDataPlano.valorParcela}
                    className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingMensalidade ? (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      'Salvar Plano'
                    )}
                  </button>
                </div>
              </div>
          </AnimatedModal>

      {/* Modal de Aplicar Multa */}
      <AnimatedModal
        open={showMultaModal}
        onClose={() => {
          setShowMultaModal(false);
          setMensalidadeParaMulta(null);
        }}
      >
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                {mensalidadeParaMulta?.multaPercentual ? 'Editar Multa' : 'Aplicar Multa'}
              </h3>
              <button
                onClick={() => setShowMultaModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaMulta?.clienteNome}</span>
            </p>

            {mensalidadeParaMulta?.multaPercentual && (
              <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <span className="font-medium">Multa atual:</span> {mensalidadeParaMulta.multaPercentual}%
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <span className="font-medium">Valor atual:</span> {formatCurrency(mensalidadeParaMulta.valor)}
                </p>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {mensalidadeParaMulta?.multaPercentual ? 'Novo Percentual de Multa (%)' : 'Percentual de Multa (%)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={multaPercentual}
              onChange={(e) => setMultaPercentual(e.target.value)}
              placeholder="Ex: 2, 5, 10"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            />

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowMultaModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={aplicarMulta}
                disabled={loadingMensalidade}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMensalidade ? 
                  (mensalidadeParaMulta?.multaPercentual ? 'Atualizando...' : 'Aplicando...') : 
                  (mensalidadeParaMulta?.multaPercentual ? 'Atualizar Multa' : 'Aplicar Multa')
                }
              </button>
            </div>
          </div>
      </AnimatedModal>

      {/* Modal de Alterar Vencimento */}
      <AnimatedModal open={showVencimentoModal} onClose={fecharModalVencimento}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                {editingBulkIds?.length ? `Alterar vencimento (${editingBulkIds.length} parcelas)` : 'Alterar Data de Vencimento'}
              </h3>
              <button
                onClick={fecharModalVencimento}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              {!editingBulkIds?.length && mensalidadeParaEditar && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar.clienteNome}</span>
                </p>
              )}
              {editingBulkIds?.length ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {editingBulkIds.length} parcela(s) selecionada(s)
                </p>
              ) : null}

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Novo Dia de Vencimento *
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={novoVencimento}
                onChange={(e) => setNovoVencimento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: 15"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Digite apenas o dia do mês (1 a 31)
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalVencimento}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarVencimento}
                disabled={loadingMensalidade || !novoVencimento}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMensalidade ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
      </AnimatedModal>

      {/* Modal de Alterar Valor */}
      <AnimatedModal open={showValorModal} onClose={fecharModalValor}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                {editingBulkIds?.length ? `Alterar valor (${editingBulkIds.length} parcelas)` : 'Alterar Valor'}
              </h3>
              <button
                onClick={fecharModalValor}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              {!editingBulkIds?.length && mensalidadeParaEditar && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar.clienteNome}</span>
                </p>
              )}
              {editingBulkIds?.length ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {editingBulkIds.length} parcela(s) selecionada(s)
                </p>
              ) : null}

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Novo Valor *
              </label>
              <input
                type="text"
                value={novoValor}
                onChange={(e) => handleValorChange(e.target.value)}
                onKeyDown={handleValorKeyDown}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                placeholder="Ex: R$ 1.200,00"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalValor}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarValor}
                disabled={loadingMensalidade || !novoValor}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMensalidade ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
      </AnimatedModal>

      {/* Modal de Excluir Parcela */}
      <AnimatedModal open={showExcluirModal} onClose={fecharModalExcluir}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                {excluirBulkIds?.length ? `Excluir ${excluirBulkIds.length} parcela(s)` : 'Excluir Parcela'}
              </h3>
              <button
                onClick={fecharModalExcluir}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
                {excluirBulkIds?.length
                  ? `Tem certeza que deseja excluir ${excluirBulkIds.length} parcela(s)?`
                  : 'Tem certeza que deseja excluir esta parcela?'}
              </p>

              {!excluirBulkIds?.length && mensalidadeParaExcluir && (
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Cliente:</span>
                      <p className="text-gray-900 dark:text-gray-100">{mensalidadeParaExcluir.clienteNome}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Valor:</span>
                      <p className="text-gray-900 dark:text-gray-100 font-semibold">
                        {formatCurrency(mensalidadeParaExcluir.valor)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Vencimento:</span>
                      <p className="text-gray-900 dark:text-gray-100">
                        {(() => {
                          const data = mensalidadeParaExcluir.dataVencimento instanceof Date
                            ? mensalidadeParaExcluir.dataVencimento
                            : new Date(mensalidadeParaExcluir.dataVencimento);
                          return data.toLocaleDateString('pt-BR');
                        })()}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                      <p className="text-gray-900 dark:text-gray-100">{getStatusText(mensalidadeParaExcluir.status)}</p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-red-600 dark:text-red-400 text-center mt-4">
                ⚠️ Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalExcluir}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={excluirMensalidade}
                disabled={loadingMensalidade}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMensalidade ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : excluirBulkIds?.length ? (
                  `Excluir ${excluirBulkIds.length} parcela(s)`
                ) : (
                  'Excluir Parcela'
                )}
              </button>
            </div>
          </div>
      </AnimatedModal>

      {/* Modal de Editar Forma de Pagamento */}
      <AnimatedModal open={showFormaPagamentoModal} onClose={fecharModalFormaPagamento}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                {editingBulkIds?.length ? `Alterar forma de pagamento (${editingBulkIds.length} parcelas)` : 'Editar Parcela'}
              </h3>
              <button
                onClick={fecharModalFormaPagamento}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              {!editingBulkIds?.length && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{cliente?.razaoSocial}</span>
                </p>
              )}
              {editingBulkIds?.length ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {editingBulkIds.length} parcela(s) selecionada(s)
                </p>
              ) : null}

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Forma de Pagamento *
              </label>

              <div className="space-y-3">
                <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    name="formaPagamento"
                    value="pix"
                    checked={novaFormaPagamento === 'pix'}
                    onChange={(e) => setNovaFormaPagamento(e.target.value as 'pix' | 'boleto')}
                    className="w-4 h-4 text-[#004085] dark:text-blue-400 focus:ring-[#004085] dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    PIX
                  </span>
                </label>

                <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    name="formaPagamento"
                    value="boleto"
                    checked={novaFormaPagamento === 'boleto'}
                    onChange={(e) => setNovaFormaPagamento(e.target.value as 'pix' | 'boleto')}
                    className="w-4 h-4 text-[#004085] dark:text-blue-400 focus:ring-[#004085] dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Boleto
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalFormaPagamento}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarFormaPagamento}
                disabled={loadingMensalidade}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMensalidade ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
      </AnimatedModal>

      {/* Modal Gerar mais 12 parcelas */}
      <AnimatedModal open={showGerarParcelasModal} onClose={fecharModalGerarParcelas}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                Gerar mais parcelas
              </h3>
              <button
                onClick={fecharModalGerarParcelas}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
              Todas as parcelas foram quitadas. Deseja gerar mais 12 meses de parcelas?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={fecharModalGerarParcelas}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Não
              </button>
              <button
                onClick={gerarDozeParcelas}
                disabled={loadingMensalidade}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMensalidade ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Sim, gerar 12 meses'
                )}
              </button>
            </div>
          </div>
      </AnimatedModal>

      <AnimatedModal open={showCopyFormularioModal} onClose={handleCloseCopyFormularioModal}>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
              Selecionar filial do formulário
            </h3>
            <button
              type="button"
              onClick={handleCloseCopyFormularioModal}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Escolha a unidade que já virá selecionada no link do formulário.
          </p>
          <div className="mb-4">
            <label
              htmlFor="copyFormularioNome"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Nome do estagiário *
            </label>
            <input
              id="copyFormularioNome"
              type="text"
              value={copyFormularioNome}
              onChange={(e) => setCopyFormularioNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="copyFormularioTelefone"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Telefone do estagiário *
            </label>
            <input
              id="copyFormularioTelefone"
              type="text"
              inputMode="tel"
              value={copyFormularioTelefone}
              onChange={(e) => setCopyFormularioTelefone(maskPhoneInput(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="copyFormularioFilial"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Unidade / CNPJ do contrato *
            </label>
            <select
              id="copyFormularioFilial"
              value={copyFormularioFilialId}
              onChange={(e) => setCopyFormularioFilialId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">
                Matriz — {cliente?.nomeFantasia} ({cliente?.cnpj})
              </option>
              {(cliente?.filiais ?? []).map((filial) => (
                <option key={filial.id} value={filial.id}>
                  Filial — {filial.nomeFantasia} ({filial.cnpj})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCloseCopyFormularioModal}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleCopyFormularioCadastroLink()}
              disabled={loadingCopyFormularioLink}
              className="px-4 py-2 bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingCopyFormularioLink ? 'Gerando...' : 'Copiar link'}
            </button>
          </div>
        </div>
      </AnimatedModal>

      {/* Modal de Filial (aba Informações) */}
      <AnimatedModal open={showFilialModal} onClose={handleCloseFilialModal}>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
              {editingFilialId ? 'Editar Filial' : 'Adicionar Filial'}
            </h3>
            <button
              onClick={handleCloseFilialModal}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CNPJ *
              </label>
              <input
                type="text"
                value={filialForm.cnpj}
                onChange={(e) => handleFilialCnpjChange(e.target.value)}
                onBlur={handleFilialCnpjBlur}
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Razão Social *
              </label>
              <input
                type="text"
                value={filialForm.razaoSocial}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, razaoSocial: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="Razão Social da Filial"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome Fantasia *
              </label>
              <input
                type="text"
                value={filialForm.nomeFantasia}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, nomeFantasia: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="Nome Fantasia da Filial"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Telefone *
              </label>
              <input
                type="text"
                value={filialForm.telefone}
                onChange={(e) =>
                  setFilialForm({
                    ...filialForm,
                    telefone: formatTelefoneMask(e.target.value),
                  })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="(61) 99999-9999"
                maxLength={15}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={filialForm.email}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, email: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="email@filial.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                UF
              </label>
              <input
                type="text"
                value={filialForm.uf}
                onChange={(e) =>
                  setFilialForm({
                    ...filialForm,
                    uf: e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
                  })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="DF"
                maxLength={2}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Endereço *
              </label>
              <input
                type="text"
                value={filialForm.endereco}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, endereco: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="Logradouro, número, complemento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cidade *
              </label>
              <input
                type="text"
                value={filialForm.cidade}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, cidade: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="Brasília"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bairro *
              </label>
              <input
                type="text"
                value={filialForm.bairro}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, bairro: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="Asa Sul"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CEP *
              </label>
              <input
                type="text"
                value={filialForm.cep}
                onChange={(e) =>
                  setFilialForm({
                    ...filialForm,
                    cep: formatCepMask(e.target.value),
                  })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="70000-000"
                maxLength={9}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Responsável *
              </label>
              <input
                type="text"
                value={filialForm.responsavel}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, responsavel: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="Nome do Responsável"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cargo do responsável
              </label>
              <input
                type="text"
                value={filialForm.responsavelCargo}
                onChange={(e) =>
                  setFilialForm({ ...filialForm, responsavelCargo: e.target.value })
                }
                disabled={loadingFilialCnpj || loadingFilialAction}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                placeholder="Ex.: Diretor Administrativo"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={handleCloseFilialModal}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handlePersistFilialFromInfo()}
              disabled={
                loadingFilialCnpj ||
                loadingFilialAction ||
                !filialForm.cnpj ||
                !filialForm.razaoSocial ||
                !filialForm.nomeFantasia ||
                !filialForm.telefone ||
                !filialForm.endereco ||
                !filialForm.cidade ||
                !filialForm.bairro ||
                !filialForm.cep ||
                !filialForm.responsavel
              }
              className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingFilialAction || loadingFilialCnpj ? (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : editingFilialId ? (
                'Atualizar'
              ) : (
                'Adicionar'
              )}
            </button>
          </div>
        </div>
      </AnimatedModal>

      {/* Modal de Editar Cliente */}
      <AnimatedModal open={showEditModal} onClose={handleCloseEditModal}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                Editar Cliente
              </h3>
              <button
                onClick={handleCloseEditModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  value={formData.cnpj}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  onBlur={(ev) => void handleCnpjLookupBlur(ev)}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  value={formData.razaoSocial}
                  onChange={(e) => setFormData({...formData, razaoSocial: e.target.value})}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="Razão Social da Empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  value={formData.nomeFantasia}
                  onChange={(e) => setFormData({...formData, nomeFantasia: e.target.value})}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="Nome Fantasia da Empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefone *
                </label>
                <input
                  type="text"
                  value={formData.telefone}
                  onChange={(e) => handleTelefoneClienteChange(e.target.value)}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="(61) 99999-9999"
                  maxLength={15}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="email@empresa.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endereço (logradouro)
                </label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="Quadra, conjunto, número"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  UF
                </label>
                <input
                  type="text"
                  value={formData.uf}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      uf: e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
                    })
                  }
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="DF"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cidade *
                </label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="Brasília"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bairro *
                </label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) => setFormData({...formData, bairro: e.target.value})}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="Asa Sul"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CEP *
                </label>
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="70000-000"
                  maxLength={9}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Responsável *
                </label>
                <input
                  type="text"
                  value={formData.responsavel}
                  onChange={(e) => setFormData({...formData, responsavel: e.target.value})}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="Nome do Responsável"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cargo do representante
                </label>
                <input
                  type="text"
                  value={formData.responsavelCargo}
                  onChange={(e) => setFormData({ ...formData, responsavelCargo: e.target.value })}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  placeholder="Ex.: Diretor Administrativo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo'})}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                >
                  <option value="ativo">Ativo</option>
                  <option value="em-andamento">Em andamento</option>
                  <option value="bloqueado">Bloqueado</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Forma de Captação
                </label>
                <select
                  value={formData.formaCaptacao}
                  onChange={(e) => {
                    const value = e.target.value as FormaCaptacao | '';
                    setFormData({
                      ...formData,
                      formaCaptacao: value,
                      formaCaptacaoDetalhe:
                        value === 'indicacao' || value === 'outro'
                          ? formData.formaCaptacaoDetalhe
                          : '',
                    });
                  }}
                  disabled={loadingCnpjLookup}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                >
                  <option value="">Selecione</option>
                  {FORMA_CAPTACAO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.formaCaptacao === 'indicacao' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quem *
                  </label>
                  <input
                    type="text"
                    value={formData.formaCaptacaoDetalhe}
                    onChange={(e) =>
                      setFormData({ ...formData, formaCaptacaoDetalhe: e.target.value })
                    }
                    disabled={loadingCnpjLookup}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                    placeholder="Nome de quem indicou"
                  />
                </div>
              )}

              {formData.formaCaptacao === 'outro' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Outro *
                  </label>
                  <input
                    type="text"
                    value={formData.formaCaptacaoDetalhe}
                    onChange={(e) =>
                      setFormData({ ...formData, formaCaptacaoDetalhe: e.target.value })
                    }
                    disabled={loadingCnpjLookup}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                    placeholder="Descreva a forma de captação"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#004085] dark:text-blue-400">
                  Filiais
                </h4>
                {!showFilialForm && (
                  <button
                    type="button"
                    onClick={handleAddFilial}
                    className="text-sm text-[#004085] dark:text-blue-400 hover:underline"
                  >
                    Adicionar filial
                  </button>
                )}
              </div>

              {filiais.length === 0 && !showFilialForm && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma filial cadastrada.
                </p>
              )}

              {filiais.length > 0 && (
                <ul className="space-y-2">
                  {filiais.map((filial) => (
                    <li
                      key={filial.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {filial.nomeFantasia}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">{filial.cnpj}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditFilial(filial)}
                          className="text-[#004085] dark:text-blue-400 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFilial(filial.id)}
                          className="text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {showFilialForm && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 space-y-3 bg-gray-50 dark:bg-slate-900/40">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {editingFilialId ? 'Editar filial' : 'Nova filial'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        CNPJ *
                      </label>
                      <input
                        type="text"
                        value={filialForm.cnpj}
                        onChange={(e) => handleFilialCnpjChange(e.target.value)}
                        onBlur={handleFilialCnpjBlur}
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Razão Social *
                      </label>
                      <input
                        type="text"
                        value={filialForm.razaoSocial}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, razaoSocial: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="Razão Social da Filial"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nome Fantasia *
                      </label>
                      <input
                        type="text"
                        value={filialForm.nomeFantasia}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, nomeFantasia: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="Nome Fantasia da Filial"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Telefone *
                      </label>
                      <input
                        type="text"
                        value={filialForm.telefone}
                        onChange={(e) =>
                          setFilialForm({
                            ...filialForm,
                            telefone: formatTelefoneMask(e.target.value),
                          })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="(61) 99999-9999"
                        maxLength={15}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={filialForm.email}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, email: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="email@filial.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        UF
                      </label>
                      <input
                        type="text"
                        value={filialForm.uf}
                        onChange={(e) =>
                          setFilialForm({
                            ...filialForm,
                            uf: e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase(),
                          })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="DF"
                        maxLength={2}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Endereço *
                      </label>
                      <input
                        type="text"
                        value={filialForm.endereco}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, endereco: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="Logradouro, número, complemento"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cidade *
                      </label>
                      <input
                        type="text"
                        value={filialForm.cidade}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, cidade: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="Brasília"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bairro *
                      </label>
                      <input
                        type="text"
                        value={filialForm.bairro}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, bairro: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="Asa Sul"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        CEP *
                      </label>
                      <input
                        type="text"
                        value={filialForm.cep}
                        onChange={(e) =>
                          setFilialForm({
                            ...filialForm,
                            cep: formatCepMask(e.target.value),
                          })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="70000-000"
                        maxLength={9}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Responsável *
                      </label>
                      <input
                        type="text"
                        value={filialForm.responsavel}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, responsavel: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="Nome do Responsável"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cargo do responsável
                      </label>
                      <input
                        type="text"
                        value={filialForm.responsavelCargo}
                        onChange={(e) =>
                          setFilialForm({ ...filialForm, responsavelCargo: e.target.value })
                        }
                        disabled={loadingFilialCnpj}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                        placeholder="Ex.: Diretor Administrativo"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={resetFilialForm}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFilial}
                      disabled={
                        loadingFilialCnpj ||
                        !filialForm.cnpj ||
                        !filialForm.razaoSocial ||
                        !filialForm.nomeFantasia ||
                        !filialForm.telefone ||
                        !filialForm.endereco ||
                        !filialForm.cidade ||
                        !filialForm.bairro ||
                        !filialForm.cep ||
                        !filialForm.responsavel
                      }
                      className="px-3 py-1.5 text-sm bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingFilialId ? 'Atualizar filial' : 'Salvar filial'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCloseEditModal}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loadingAction || loadingCnpjLookup || !formData.cnpj || !formData.razaoSocial || !formData.nomeFantasia || !formData.telefone || !formData.cidade || !formData.bairro || !formData.cep || !formData.responsavel || ((formData.formaCaptacao === 'indicacao' || formData.formaCaptacao === 'outro') && !formData.formaCaptacaoDetalhe.trim())}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingAction || loadingCnpjLookup ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Atualizar'
                )}
              </button>
            </div>
          </div>
      </AnimatedModal>

        <AnimatedModal open={showEmitNfseModal} onClose={() => setShowEmitNfseModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg mx-4 transition-colors">
            <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400 mb-4">
              Emitir NFS-e
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data de competência
                </label>
                <input
                  type="date"
                  value={formNfse.dataCompetencia}
                  onChange={(e) =>
                    setFormNfse((prev) => ({
                      ...prev,
                      dataCompetencia: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valor do serviço
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formNfse.valorServico}
                  onChange={(e) =>
                    setFormNfse((prev) => ({
                      ...prev,
                      valorServico: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Código do serviço
                </label>
                <select
                  value={formNfse.codigoServico}
                  onChange={(e) =>
                    setFormNfse((prev) => ({
                      ...prev,
                      codigoServico: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  {getNfseServicoOptions(formNfse.codigoServico).map(
                    (option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Discriminação
                </label>
                <textarea
                  value={formNfse.discriminacao}
                  onChange={(e) =>
                    setFormNfse((prev) => ({
                      ...prev,
                      discriminacao: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowEmitNfseModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleEmitNfse()}
                disabled={emittingNfse}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {emittingNfse ? 'Emitindo...' : 'Emitir'}
              </button>
            </div>
          </div>
        </AnimatedModal>

        <AnimatedModal open={showCancelNfseModal} onClose={() => setShowCancelNfseModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg mx-4 transition-colors">
            <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400 mb-4">
              Cancelar NFS-e
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Motivo do cancelamento
              </label>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCancelNfseModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void handleCancelNfse()}
                disabled={nfseActionId === nfseToCancel?.dpsId}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </AnimatedModal>

        <AnimatedModal
          open={contractPreviewOpen && !!contractPreviewUrl}
          onClose={closeContractPreview}
          zIndexClassName="z-[10001]"
          containerClassName="px-4"
        >
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden transition-colors">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <h3 className="text-base sm:text-lg font-bold text-[#004085] dark:text-blue-400 truncate min-w-0">
                  Contrato de estágio
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleDownloadContract()}
                    disabled={contractDownloading}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-[#004085] dark:border-blue-500 text-[#004085] dark:text-blue-400 hover:bg-[#004085]/10 dark:hover:bg-blue-950/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {contractDownloading ? 'Baixando…' : 'Baixar DOCX'}
                  </button>
                  <button
                    type="button"
                    onClick={closeContractPreview}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Fechar"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6 h-[75vh]">
                <iframe
                  src={contractPreviewIframeSrc(
                    contractPreviewPath ?? '',
                    contractPreviewUrl ?? ''
                  )}
                  title="Contrato de estágio"
                  className="w-full h-full min-h-[60vh] rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                />
              </div>
            </div>
        </AnimatedModal>

        </main>
      </div>
    </ProtectedRoute>
  );
}
