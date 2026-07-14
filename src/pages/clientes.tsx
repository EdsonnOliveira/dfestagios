import { useState, useEffect, useCallback, useRef, useMemo, type FocusEvent } from 'react';
import { useRouter } from 'next/router';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PainelHeader from '../components/PainelHeader';
import { AnimatedModal } from '../components/AnimatedModal';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import { clientesService } from '../services/firebase';
import { fetchCnpjLookup } from '../services/brasilApiCnpj';
import { Cliente, ClienteFilial, FormaCaptacao, FORMA_CAPTACAO_OPTIONS } from '../types/firebase';

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

const normalizeLocationKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const formatLocationLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const hasAccent = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '') !== value.normalize('NFD');

const buildUniqueLocations = (values: string[]) => {
  const locationMap = new Map<string, string>();

  values.forEach((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const key = normalizeLocationKey(trimmed);
    const candidate = formatLocationLabel(trimmed);
    const current = locationMap.get(key);

    if (!current) {
      locationMap.set(key, candidate);
      return;
    }

    if (hasAccent(candidate) && !hasAccent(current)) {
      locationMap.set(key, candidate);
    }
  });

  return Array.from(locationMap.values()).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  );
};

const parseClienteDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const WEEKDAY_FULL_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

const CAPTACAO_FILL_COLORS: Record<FormaCaptacao | 'nao-informado', string> = {
  instagram: '#ec4899',
  linkedin: '#0284c7',
  whatsapp: '#22c55e',
  'trafego-pago': '#a855f7',
  site: '#6366f1',
  indicacao: '#f59e0b',
  outro: '#64748b',
  'nao-informado': '#9ca3af',
};

const polarToCartesian = (cx: number, cy: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
};

const describePieSlice = (
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
};

export default function Clientes() {
  const router = useRouter();
  const [filtroRazaoSocial, setFiltroRazaoSocial] = useState('');
  const [filtroNomeFantasia, setFiltroNomeFantasia] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroEstagiario, setFiltroEstagiario] = useState('');
  const [filtroFilial, setFiltroFilial] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingCnpjLookup, setLoadingCnpjLookup] = useState(false);
  const formCnpjRef = useRef('');
  const [motivoStatus, setMotivoStatus] = useState('');
  const [filiais, setFiliais] = useState<ClienteFilial[]>([]);
  const [showFilialForm, setShowFilialForm] = useState(false);
  const [editingFilialId, setEditingFilialId] = useState<string | null>(null);
  const [filialForm, setFilialForm] = useState(emptyFilialForm);
  const [loadingFilialCnpj, setLoadingFilialCnpj] = useState(false);
  const lastFilialCnpjFetched = useRef('');
  const filialCnpjLookupSeq = useRef(0);

  const [formData, setFormData] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    telefone: '',
    email: '',
    endereco: '',
    cidade: '',
    bairro: '',
    cep: '',
    responsavel: '',
    status: 'ativo' as 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo',
    formaCaptacao: '' as FormaCaptacao | '',
    formaCaptacaoDetalhe: '',
  });

  useEffect(() => {
    formCnpjRef.current = formData.cnpj;
  }, [formData.cnpj]);

  useEffect(() => {
    void loadClientes();
  }, []);

  const handleCnpjBlur = useCallback(async (e: FocusEvent<HTMLInputElement>) => {
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
      !filialForm.email ||
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
      uf: filialForm.uf || undefined,
      responsavel: filialForm.responsavel,
      responsavelCargo: filialForm.responsavelCargo || undefined,
    };
    if (editingFilialId) {
      setFiliais((prev) => prev.map((f) => (f.id === editingFilialId ? payload : f)));
    } else {
      setFiliais((prev) => [...prev, payload]);
    }
    resetFilialForm();
  };

  // Função para formatar valor monetário
  // const formatCurrency = (value: string) => {
  //   // Remove tudo que não é dígito
  //   const numericValue = value.replace(/\D/g, '');
  //   
  //   // Se estiver vazio, retorna vazio
  //   if (!numericValue) return '';
  //   
  //   // Converte para número e divide por 100 para ter centavos
  //   const numberValue = parseInt(numericValue) / 100;
  //   
  //   // Formata como moeda brasileira
  //   return new Intl.NumberFormat('pt-BR', {
  //     style: 'currency',
  //     currency: 'BRL'
  //   }).format(numberValue);
  // };

  // const parseCurrency = (value: string) => {
  //   if (!value) return 0;
  //   // Remove símbolos e converte para número
  //   const numericValue = value.replace(/[^\d,]/g, '').replace(',', '.');
  //   return parseFloat(numericValue) || 0;
  // };


  // Função para aplicar máscara de CNPJ
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

  // Função para aplicar máscara de CEP
  const handleCepChange = (value: string) => {
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');
    
    // Aplica a máscara do CEP: XXXXX-XXX
    let formattedValue = numericValue;
    
    if (numericValue.length > 5) {
      formattedValue = numericValue.substring(0, 5) + '-' + numericValue.substring(5, 8);
    }
    
    setFormData({...formData, cep: formattedValue});
  };

  // Função para aplicar máscara de telefone
  const handleTelefoneChange = (value: string) => {
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');
    
    // Aplica a máscara do telefone: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
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

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await clientesService.getAll();
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleAdd = () => {
    setFormData({
      cnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
      telefone: '',
      email: '',
      endereco: '',
      cidade: '',
      bairro: '',
      cep: '',
      responsavel: '',
      status: 'ativo',
      formaCaptacao: '',
      formaCaptacaoDetalhe: '',
    });
    setMotivoStatus('');
    setFiliais([]);
    resetFilialForm();
    setShowAddModal(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      cnpj: cliente.cnpj,
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia,
      telefone: cliente.telefone,
      email: cliente.email,
      endereco: cliente.endereco ?? '',
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      cep: cliente.cep,
      responsavel: cliente.responsavel,
      status: cliente.status,
      formaCaptacao: cliente.formaCaptacao ?? '',
      formaCaptacaoDetalhe: cliente.formaCaptacaoDetalhe ?? '',
    });
    setMotivoStatus(cliente.motivoStatus ?? '');
    setFiliais(cliente.filiais ? [...cliente.filiais] : []);
    resetFilialForm();
    setShowEditModal(true);
  };

  const handleSave = async () => {
    try {
      setLoadingAction(true);
      const motivoTrimmed = motivoStatus.trim();
      const { formaCaptacao, formaCaptacaoDetalhe, ...restForm } = formData;
      const detalheTrimmed = formaCaptacaoDetalhe.trim();
      const needsDetalhe =
        formaCaptacao === 'indicacao' || formaCaptacao === 'outro';
      const captacaoPayload = {
        formaCaptacao: formaCaptacao || null,
        formaCaptacaoDetalhe: needsDetalhe ? detalheTrimmed : '',
      };

      if (editingCliente) {
        const statusChanged = editingCliente.status !== formData.status;
        const updateData = {
          ...restForm,
          ...captacaoPayload,
          filiais,
          ...(motivoTrimmed ? { motivoStatus: motivoTrimmed } : {}),
        };

        if (statusChanged) {
          const { status, ...dataWithoutStatus } = updateData;
          await clientesService.update(editingCliente.id!, dataWithoutStatus);
          await clientesService.updateStatus(
            editingCliente.id!,
            status,
            motivoTrimmed || undefined
          );
        } else {
          await clientesService.update(editingCliente.id!, updateData);
        }

        setClientes((prev) =>
          prev.map((cliente) =>
            cliente.id === editingCliente.id
              ? {
                  ...cliente,
                  ...updateData,
                  formaCaptacao: formaCaptacao || null,
                  formaCaptacaoDetalhe: needsDetalhe ? detalheTrimmed : '',
                }
              : cliente
          )
        );
        setShowEditModal(false);
        setEditingCliente(null);
      } else {
        const clienteData = {
          ...restForm,
          ...captacaoPayload,
          filiais,
          dataVencimento: '',
          valor: '',
          servico: '',
          motivoStatus: motivoTrimmed,
          estagiariosVinculados: [] as string[],
        };
        const id = await clientesService.add(clienteData);
        const newCliente: Cliente = {
          id,
          ...clienteData,
          formaCaptacao: formaCaptacao || null,
          formaCaptacaoDetalhe: needsDetalhe ? detalheTrimmed : '',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setClientes((prev) => [newCliente, ...prev]);
        setShowAddModal(false);
      }

      setMotivoStatus('');
      setFiliais([]);
      resetFilialForm();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCliente) return;

    try {
      setLoadingAction(true);
      await clientesService.delete(deletingCliente.id!);
      setClientes(prev => prev.filter(cliente => cliente.id !== deletingCliente.id));
      setShowDeleteModal(false);
      setDeletingCliente(null);
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCloseModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setEditingCliente(null);
    setDeletingCliente(null);
    setMotivoStatus('');
    setFiliais([]);
    resetFilialForm();
    setFormData({
      cnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
      telefone: '',
      email: '',
      endereco: '',
      cidade: '',
      bairro: '',
      cep: '',
      responsavel: '',
      status: 'ativo',
      formaCaptacao: '',
      formaCaptacaoDetalhe: '',
    });
  };

  const exportarPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // Orientação landscape para melhor visualização da tabela
      
      // Configurações do PDF
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      
      // Cores do tema
      const primaryColor = [0, 64, 133]; // Azul #004085
      const secondaryColor = [245, 245, 245]; // Cinza claro
      
      // Cabeçalho principal
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE CLIENTES', pageWidth / 2, 15, { align: 'center' });
      
      // Informações do relatório
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const dataAtual = new Date();
      const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
      const horaFormatada = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      doc.text(`Gerado em: ${dataFormatada} às ${horaFormatada}`, margin, 35);
      
      // Filtros aplicados
      let filtrosTexto = 'Filtros: Todos os clientes';
      const filtrosAplicados = [];
      
      if (filtroRazaoSocial) filtrosAplicados.push(`Razão Social: "${filtroRazaoSocial}"`);
      if (filtroNomeFantasia) filtrosAplicados.push(`Nome Fantasia: "${filtroNomeFantasia}"`);
      if (filtroResponsavel) filtrosAplicados.push(`Responsável: "${filtroResponsavel}"`);
      if (filtroCidade) filtrosAplicados.push(`Cidade: "${filtroCidade}"`);
      if (filtroBairro) filtrosAplicados.push(`Bairro: "${filtroBairro}"`);
      if (filtroStatus) {
        const statusText = filtroStatus === 'ativo' ? 'Ativo' : 
                          filtroStatus === 'em-andamento' ? 'Em andamento' :
                          filtroStatus === 'bloqueado' ? 'Bloqueado' : 'Inativo';
        filtrosAplicados.push(`Status: "${statusText}"`);
      }
      if (filtroEstagiario) {
        const estagiarioText =
          filtroEstagiario === 'com-estagiario' ? 'Com estagiário' : 'Sem estagiário';
        filtrosAplicados.push(`Estagiários: "${estagiarioText}"`);
      }
      if (filtroFilial) {
        const filialText =
          filtroFilial === 'com-filial' ? 'Com filial' : 'Sem filial';
        filtrosAplicados.push(`Filiais: "${filialText}"`);
      }
      
      if (filtrosAplicados.length > 0) {
        filtrosTexto = `Filtros: ${filtrosAplicados.join(', ')}`;
      }
      
      doc.text(filtrosTexto, pageWidth - margin, 35, { align: 'right' });
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 45, pageWidth - margin, 45);
      
      // Resumo estatístico
      let yPosition = 55;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO EXECUTIVO', margin, yPosition);
      
      yPosition += 10;
      
      // Cards de resumo
      const resumoData = [
        { label: 'Total de Clientes', value: clientesFiltrados.length, color: [59, 130, 246] },
        { label: 'Clientes Ativos', value: clientesFiltrados.filter(c => c.status === 'ativo').length, color: [34, 197, 94] },
        { label: 'Em Andamento', value: clientesFiltrados.filter(c => c.status === 'em-andamento').length, color: [59, 130, 246] },
        { label: 'Bloqueados', value: clientesFiltrados.filter(c => c.status === 'bloqueado').length, color: [251, 191, 36] },
        { label: 'Inativos', value: clientesFiltrados.filter(c => c.status === 'inativo').length, color: [239, 68, 68] }
      ];
      
      const cardWidth = (contentWidth - 20) / 5;
      resumoData.forEach((item, index) => {
        const x = margin + (index * (cardWidth + 5));
        
        // Fundo do card
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.roundedRect(x, yPosition, cardWidth, 20, 3, 3, 'F');
        
        // Texto do card
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value.toString(), x + cardWidth/2, yPosition + 8, { align: 'center' });
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x + cardWidth/2, yPosition + 15, { align: 'center' });
      });
      
      yPosition += 35;
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      
      // Tabela de detalhes
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALHAMENTO DOS CLIENTES', margin, yPosition);
      
      yPosition += 10;
      
      // Preparar dados da tabela
      const tableData = clientesFiltrados.map((cliente, index) => [
        index + 1, // Número sequencial
        cliente.cnpj,
        cliente.razaoSocial,
        cliente.nomeFantasia,
        cliente.telefone,
        cliente.email,
        cliente.cidade,
        cliente.bairro,
        cliente.cep,
        cliente.responsavel,
        (cliente.estagiariosVinculados?.length ?? 0).toString(),
        cliente.status === 'ativo' ? 'Ativo' : 
        cliente.status === 'em-andamento' ? 'Em andamento' :
        cliente.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'
      ]);
      
      // Configurações da tabela
      const tableConfig = {
        startY: yPosition,
        head: [['#', 'CNPJ', 'Razão Social', 'Nome Fantasia', 'Telefone', 'Email', 'Cidade', 'Bairro', 'CEP', 'Responsável', 'Estagiários', 'Status']],
        body: tableData,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'linebreak' as const,
          halign: 'left' as const,
          valign: 'middle' as const
        },
        headStyles: {
          fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]] as [number, number, number],
          textColor: 255,
          fontStyle: 'bold' as const,
          fontSize: 8
        },
        alternateRowStyles: {
          fillColor: [secondaryColor[0], secondaryColor[1], secondaryColor[2]] as [number, number, number],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' as const }, // #
          1: { cellWidth: 25, halign: 'center' as const }, // CNPJ
          2: { cellWidth: 35, halign: 'left' as const }, // Razão Social
          3: { cellWidth: 30, halign: 'left' as const }, // Nome Fantasia
          4: { cellWidth: 20, halign: 'center' as const }, // Telefone
          5: { cellWidth: 30, halign: 'left' as const }, // Email
          6: { cellWidth: 20, halign: 'left' as const }, // Cidade
          7: { cellWidth: 20, halign: 'left' as const }, // Bairro
          8: { cellWidth: 15, halign: 'center' as const }, // CEP
          9: { cellWidth: 25, halign: 'left' as const }, // Responsável
          10: { cellWidth: 15, halign: 'center' as const }, // Estagiários
          11: { cellWidth: 15, halign: 'center' as const } // Status
        },
        margin: { left: margin, right: margin },
        showHead: 'everyPage' as const
      };
      
      // Adicionar tabela
      autoTable(doc, tableConfig);
      
      // Rodapé
      const finalY = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || yPosition;
      
      // Linha separadora do rodapé
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, finalY + 10, pageWidth - margin, finalY + 10);
      
      // Informações do rodapé
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      
      const totalPaginas = doc.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        doc.text('Relatório gerado pelo sistema DF Estágios', margin, pageHeight - 10);
        doc.text(`Total de clientes: ${clientesFiltrados.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      // Salvar PDF
      const nomeArquivo = `Relatorio_Clientes_${dataFormatada.replace(/\//g, '-')}_${horaFormatada.replace(/:/g, '-')}.pdf`;
      doc.save(nomeArquivo);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const getEstagiariosCount = useCallback(
    (cliente: Cliente) => cliente.estagiariosVinculados?.length ?? 0,
    []
  );

  const getFiliaisCount = useCallback(
    (cliente: Cliente) => cliente.filiais?.length ?? 0,
    []
  );

  const getResponsavelFirstName = useCallback((responsavel: string) => {
    const trimmed = responsavel.trim();
    if (!trimmed) return '-';
    return trimmed.split(/\s+/)[0];
  }, []);

  const filtrarClientes = () => {
    return clientes.filter(cliente => {
      const matchRazaoSocial = cliente.razaoSocial.toLowerCase().includes(filtroRazaoSocial.toLowerCase());
      const matchNomeFantasia = cliente.nomeFantasia.toLowerCase().includes(filtroNomeFantasia.toLowerCase());
      const matchResponsavel = cliente.responsavel
        .toLowerCase()
        .includes(filtroResponsavel.toLowerCase());
      const matchCidade =
        filtroCidade === '' ||
        normalizeLocationKey(cliente.cidade) === normalizeLocationKey(filtroCidade);
      const matchBairro = filtroBairro === '' || cliente.bairro === filtroBairro;
      const matchStatus = filtroStatus === '' || cliente.status === filtroStatus;
      const estagiariosCount = getEstagiariosCount(cliente);
      const matchEstagiario =
        filtroEstagiario === '' ||
        (filtroEstagiario === 'com-estagiario' && estagiariosCount > 0) ||
        (filtroEstagiario === 'sem-estagiario' && estagiariosCount === 0);
      const filiaisCount = getFiliaisCount(cliente);
      const matchFilial =
        filtroFilial === '' ||
        (filtroFilial === 'com-filial' && filiaisCount > 0) ||
        (filtroFilial === 'sem-filial' && filiaisCount === 0);

      return (
        matchRazaoSocial &&
        matchNomeFantasia &&
        matchResponsavel &&
        matchCidade &&
        matchBairro &&
        matchStatus &&
        matchEstagiario &&
        matchFilial
      );
    });
  };

  const clientesFiltrados = filtrarClientes();

  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    const monthDayCounts = Array.from({ length: 31 }, () => 0);
    let novosNoMes = 0;
    let totalEstagiarios = 0;
    let comEstagiarios = 0;
    let totalFiliais = 0;
    let comFiliais = 0;
    let ativos = 0;
    let emAndamento = 0;
    let bloqueados = 0;
    let inativos = 0;
    const captacaoCounts: Record<FormaCaptacao | 'nao-informado', number> = {
      instagram: 0,
      linkedin: 0,
      whatsapp: 0,
      'trafego-pago': 0,
      site: 0,
      indicacao: 0,
      outro: 0,
      'nao-informado': 0,
    };

    clientes.forEach((cliente) => {
      if (cliente.status === 'ativo') ativos += 1;
      else if (cliente.status === 'em-andamento') emAndamento += 1;
      else if (cliente.status === 'bloqueado') bloqueados += 1;
      else inativos += 1;

      const estagiariosCount = cliente.estagiariosVinculados?.length ?? 0;
      totalEstagiarios += estagiariosCount;
      if (estagiariosCount > 0) comEstagiarios += 1;

      const filiaisCount = cliente.filiais?.length ?? 0;
      totalFiliais += filiaisCount;
      if (filiaisCount > 0) comFiliais += 1;

      if (cliente.formaCaptacao) {
        captacaoCounts[cliente.formaCaptacao] += 1;
      } else {
        captacaoCounts['nao-informado'] += 1;
      }

      const createdAt = parseClienteDate(cliente.createdAt);
      if (!createdAt) return;

      weekdayCounts[createdAt.getDay()] += 1;
      monthDayCounts[createdAt.getDate() - 1] += 1;
      if (createdAt >= monthStart) novosNoMes += 1;
    });

    const maxWeekdayCount = Math.max(...weekdayCounts, 0);
    const peakWeekdayIndexes = weekdayCounts
      .map((count, index) => ({ count, index }))
      .filter((item) => item.count === maxWeekdayCount && maxWeekdayCount > 0)
      .map((item) => item.index);

    const weekdayData = WEEKDAY_LABELS.map((label, index) => ({
      label,
      fullLabel: WEEKDAY_FULL_LABELS[index],
      count: weekdayCounts[index],
      isPeak: peakWeekdayIndexes.includes(index),
    }));

    const maxMonthDayCount = Math.max(...monthDayCounts, 0);
    const peakMonthDayIndexes = monthDayCounts
      .map((count, index) => ({ count, index }))
      .filter((item) => item.count === maxMonthDayCount && maxMonthDayCount > 0)
      .map((item) => item.index);

    const monthDayData = monthDayCounts.map((count, index) => ({
      day: index + 1,
      count,
      isPeak: peakMonthDayIndexes.includes(index),
    }));

    const captacaoData = [
      ...FORMA_CAPTACAO_OPTIONS.map((option) => ({
        label: option.label,
        count: captacaoCounts[option.value],
        fill: CAPTACAO_FILL_COLORS[option.value],
      })),
      {
        label: 'Não informado',
        count: captacaoCounts['nao-informado'],
        fill: CAPTACAO_FILL_COLORS['nao-informado'],
      },
    ];
    const captacaoTotal = captacaoData.reduce((sum, item) => sum + item.count, 0);
    let captacaoAngle = 0;
    const captacaoPieSlices = captacaoData
      .filter((item) => item.count > 0)
      .map((item) => {
        const sweep = captacaoTotal > 0 ? (item.count / captacaoTotal) * 360 : 0;
        const startAngle = captacaoAngle;
        const endAngle = captacaoAngle + sweep;
        captacaoAngle = endAngle;
        return {
          ...item,
          startAngle,
          endAngle,
          percent: captacaoTotal > 0 ? Math.round((item.count / captacaoTotal) * 100) : 0,
        };
      });
    const peakCaptacao = captacaoData.reduce(
      (best, item) => (item.count > best.count ? item : best),
      captacaoData[0]
    );

    return {
      total: clientes.length,
      ativos,
      emAndamento,
      bloqueados,
      inativos,
      totalEstagiarios,
      comEstagiarios,
      totalFiliais,
      comFiliais,
      novosNoMes,
      weekdayData,
      maxWeekdayCount: Math.max(maxWeekdayCount, 1),
      peakWeekdayLabel:
        peakWeekdayIndexes.length > 0
          ? WEEKDAY_FULL_LABELS[peakWeekdayIndexes[0]]
          : null,
      peakWeekdayCount: maxWeekdayCount,
      monthDayData,
      maxMonthDayCount: Math.max(maxMonthDayCount, 1),
      peakMonthDay:
        peakMonthDayIndexes.length > 0 ? peakMonthDayIndexes[0] + 1 : null,
      peakMonthDayCount: maxMonthDayCount,
      captacaoData,
      captacaoTotal,
      captacaoPieSlices,
      peakCaptacaoLabel: peakCaptacao.count > 0 ? peakCaptacao.label : null,
      peakCaptacaoCount: peakCaptacao.count,
    };
  }, [clientes]);

  const cidadesUnicas = buildUniqueLocations(clientes.map((c) => c.cidade));
  const bairrosUnicos = Array.from(new Set(clientes.map(c => c.bairro).filter(bairro => bairro))).sort();

  const getMetricFontClass = (value: number) =>
    String(Math.abs(Math.trunc(value))).length >= 4 ? 'text-lg' : 'text-2xl';

  return (
    <ProtectedRoute>
      <AdminRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
        <PainelHeader />

        <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2 px-4 sm:px-0">Clientes</h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base px-4 sm:px-0">Gerencie todos os clientes cadastrados</p>
          </div>

          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
                <p className={`font-bold text-[#004085] dark:text-blue-400 mt-1 ${getMetricFontClass(dashboardMetrics.total)}`}>
                  {dashboardMetrics.total}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Clientes</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Ativos</p>
                <p className={`font-bold text-green-600 dark:text-green-400 mt-1 ${getMetricFontClass(dashboardMetrics.ativos)}`}>
                  {dashboardMetrics.ativos}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {dashboardMetrics.total > 0
                    ? `${Math.round((dashboardMetrics.ativos / dashboardMetrics.total) * 100)}% do total`
                    : '0% do total'}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Inativos</p>
                <p className={`font-bold text-red-600 dark:text-red-400 mt-1 ${getMetricFontClass(dashboardMetrics.inativos)}`}>
                  {dashboardMetrics.inativos}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {dashboardMetrics.emAndamento + dashboardMetrics.bloqueados} em andamento/bloqueados
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Estagiários</p>
                <p className={`font-bold text-[#004085] dark:text-blue-400 mt-1 ${getMetricFontClass(dashboardMetrics.totalEstagiarios)}`}>
                  {dashboardMetrics.totalEstagiarios}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {dashboardMetrics.comEstagiarios} clientes com vínculo
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Filiais</p>
                <p className={`font-bold text-[#004085] dark:text-blue-400 mt-1 ${getMetricFontClass(dashboardMetrics.totalFiliais)}`}>
                  {dashboardMetrics.totalFiliais}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {dashboardMetrics.comFiliais} clientes com filial
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Novos no mês</p>
                <p className={`font-bold text-[#004085] dark:text-blue-400 mt-1 ${getMetricFontClass(dashboardMetrics.novosNoMes)}`}>
                  {dashboardMetrics.novosNoMes}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fechamentos de contrato neste mês</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                      Entradas por dia da semana
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Baseado na data de fechamento de contrato
                    </p>
                  </div>
                  {dashboardMetrics.peakWeekdayLabel && (
                    <p className="text-sm font-medium text-[#004085] dark:text-blue-400">
                      Mais entradas: {dashboardMetrics.peakWeekdayLabel} (
                      {dashboardMetrics.peakWeekdayCount})
                    </p>
                  )}
                </div>
                <div className="flex items-end gap-2 sm:gap-3 h-44">
                  {dashboardMetrics.weekdayData.map((day) => (
                    <div key={day.label} className="flex-1 flex flex-col items-center h-full justify-end">
                      <span
                        className={`text-xs font-semibold mb-1 ${
                          day.count === 0
                            ? 'text-red-600 dark:text-red-500'
                            : 'text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {day.count}
                      </span>
                      <div className="w-full flex-1 flex items-end rounded-t bg-gray-100 dark:bg-slate-700/60 overflow-hidden">
                        <div
                          className={`w-full rounded-t transition-all ${
                            day.isPeak
                              ? 'bg-[#004085] dark:bg-blue-500'
                              : 'bg-blue-300 dark:bg-blue-700'
                          }`}
                          style={{
                            height: `${Math.max(
                              (day.count / dashboardMetrics.maxWeekdayCount) * 100,
                              day.count > 0 ? 8 : 0
                            )}%`,
                          }}
                          title={`${day.fullLabel}: ${day.count}`}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                      Forma de captação
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Distribuição dos clientes por origem
                    </p>
                  </div>
                  {dashboardMetrics.peakCaptacaoLabel && (
                    <p className="text-sm font-medium text-[#004085] dark:text-blue-400">
                      Mais comum: {dashboardMetrics.peakCaptacaoLabel} (
                      {dashboardMetrics.peakCaptacaoCount})
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0">
                    {dashboardMetrics.captacaoTotal === 0 ? (
                      <circle cx="80" cy="80" r="70" className="fill-gray-300 dark:fill-slate-600" />
                    ) : dashboardMetrics.captacaoPieSlices.length === 1 ? (
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        fill={dashboardMetrics.captacaoPieSlices[0].fill}
                      />
                    ) : (
                      dashboardMetrics.captacaoPieSlices.map((slice) => (
                        <path
                          key={slice.label}
                          d={describePieSlice(80, 80, 70, slice.startAngle, slice.endAngle)}
                          fill={slice.fill}
                        >
                          <title>
                            {slice.label}: {slice.count} ({slice.percent}%)
                          </title>
                        </path>
                      ))
                    )}
                  </svg>
                  <div className="space-y-2 w-full">
                    {[...dashboardMetrics.captacaoData]
                      .filter((item) => item.count > 0)
                      .sort((a, b) => b.count - a.count)
                      .map((item) => {
                        const percent =
                          dashboardMetrics.captacaoTotal > 0
                            ? Math.round((item.count / dashboardMetrics.captacaoTotal) * 100)
                            : 0;
                        return (
                          <div key={item.label} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: item.fill }}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                {item.label}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">
                              {item.count} ({percent}%)
                            </span>
                          </div>
                        );
                      })}
                    {dashboardMetrics.captacaoTotal === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Nenhuma origem cadastrada
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                    Entradas por dia do mês
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Quantidade de fechamentos de contrato em cada dia (1 a 31)
                  </p>
                </div>
                {dashboardMetrics.peakMonthDay !== null && (
                  <p className="text-sm font-medium text-[#004085] dark:text-blue-400">
                    Mais entradas: dia {dashboardMetrics.peakMonthDay} (
                    {dashboardMetrics.peakMonthDayCount})
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-0.5 sm:gap-1 h-44 min-w-[640px]">
                  {dashboardMetrics.monthDayData.map((day) => (
                    <div
                      key={day.day}
                      className="flex-1 flex flex-col items-center h-full justify-end min-w-0"
                    >
                      <span
                        className={`text-[10px] font-semibold mb-0.5 leading-none ${
                          day.count === 0
                            ? 'text-red-600 dark:text-red-500'
                            : 'text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {day.count}
                      </span>
                      <div className="w-full flex-1 flex items-end rounded-t bg-gray-100 dark:bg-slate-700/60 overflow-hidden">
                        <div
                          className={`w-full rounded-t transition-all ${
                            day.isPeak
                              ? 'bg-[#004085] dark:bg-blue-500'
                              : 'bg-blue-300 dark:bg-blue-700'
                          }`}
                          style={{
                            height: `${Math.max(
                              (day.count / dashboardMetrics.maxMonthDayCount) * 100,
                              day.count > 0 ? 8 : 0
                            )}%`,
                          }}
                          title={`Dia ${day.day}: ${day.count}`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-600 dark:text-gray-300 mt-1">
                        {day.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-[#004085] dark:text-blue-400">Filtros</h2>
              <div className="flex space-x-3">
                <button
                  onClick={exportarPDF}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar PDF
                </button>
                <button
                  onClick={handleAdd}
                  className="bg-[#004085] hover:bg-[#0056B3] text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Adicionar Cliente
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  placeholder="Buscar por nome fantasia..."
                  value={filtroNomeFantasia}
                  onChange={(e) => setFiltroNomeFantasia(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Razão Social
                </label>
                <input
                  type="text"
                  placeholder="Buscar por razão social..."
                  value={filtroRazaoSocial}
                  onChange={(e) => setFiltroRazaoSocial(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cidade
                </label>
                <select
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Todas</option>
                  {cidadesUnicas.map(cidade => (
                    <option key={cidade} value={cidade}>{cidade}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bairro
                </label>
                <select
                  value={filtroBairro}
                  onChange={(e) => setFiltroBairro(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Todos</option>
                  {bairrosUnicos.map(bairro => (
                    <option key={bairro} value={bairro}>{bairro}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tem Estagiário
                </label>
                <select
                  value={filtroEstagiario}
                  onChange={(e) => setFiltroEstagiario(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Todos</option>
                  <option value="com-estagiario">Sim</option>
                  <option value="sem-estagiario">Não</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tem Filial
                </label>
                <select
                  value={filtroFilial}
                  onChange={(e) => setFiltroFilial(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Todos</option>
                  <option value="com-filial">Sim</option>
                  <option value="sem-filial">Não</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="em-andamento">Em andamento</option>
                  <option value="bloqueado">Bloqueado</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Responsável
                </label>
                <input
                  type="text"
                  placeholder="Buscar por responsável..."
                  value={filtroResponsavel}
                  onChange={(e) => setFiltroResponsavel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">
                  Clientes ({clientesFiltrados.length})
                </h2>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando clientes...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[21%]" />
                    <col className="w-[13%]" />
                    <col className="w-[11%]" />
                    <col className="w-[8%]" />
                    <col className="w-[7%]" />
                    <col className="w-[10%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        CNPJ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Nome Fantasia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Telefone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Responsável
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Estagiários
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Filiais
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {clientesFiltrados.map((cliente) => (
                      <tr
                        key={cliente.id}
                        onClick={() => router.push(`/cliente-detalhes?id=${cliente.id}`)}
                        className="group hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap overflow-hidden group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          <div
                            className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                            title={cliente.cnpj}
                          >
                            {cliente.cnpj}
                          </div>
                        </td>
                        <td className="px-6 py-4 overflow-hidden group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          <div
                            className="text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                            title={cliente.nomeFantasia}
                          >
                            {cliente.nomeFantasia}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          {cliente.telefone ? (
                            <a
                              href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-gray-900 dark:text-gray-100 hover:text-green-600 dark:hover:text-green-400 hover:underline cursor-pointer transition-colors"
                            >
                              {cliente.telefone}
                            </a>
                          ) : (
                            <div className="text-sm text-gray-900 dark:text-gray-100">-</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          <div className="text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {getResponsavelFirstName(cliente.responsavel)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          <div className="text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {getEstagiariosCount(cliente)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          <div className="text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {getFiliaisCount(cliente)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          <span 
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              cliente.status === 'ativo' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : cliente.status === 'em-andamento'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : cliente.status === 'bloqueado'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}
                          >
                            {cliente.status === 'ativo' ? 'Ativo' : 
                             cliente.status === 'em-andamento' ? 'Em andamento' :
                             cliente.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium group-hover:bg-gray-50 dark:group-hover:bg-slate-700">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(cliente);
                            }}
                            className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {clientesFiltrados.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">Nenhum cliente encontrado com os filtros aplicados.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Modal de Adicionar/Editar Cliente */}
        <AnimatedModal open={showAddModal || showEditModal} onClose={handleCloseModals}>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                  {editingCliente ? 'Editar Cliente' : 'Adicionar Cliente'}
                </h3>
                <button
                  onClick={handleCloseModals}
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
                    onBlur={(ev) => void handleCnpjBlur(ev)}
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
                    onChange={(e) => handleTelefoneChange(e.target.value)}
                    disabled={loadingCnpjLookup}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                    placeholder="(61) 99999-9999"
                    maxLength={15}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email *
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
                    Endereço *
                  </label>
                  <input
                    type="text"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    disabled={loadingCnpjLookup}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                    placeholder="Logradouro, quadra, número, complemento"
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Motivo da Alteração{' '}
                    {formData.status === 'bloqueado' || formData.status === 'inativo' ? '*' : ''}
                  </label>
                  <textarea
                    value={motivoStatus}
                    onChange={(e) => setMotivoStatus(e.target.value)}
                    rows={3}
                    disabled={loadingCnpjLookup}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                    placeholder={
                      formData.status === 'bloqueado' || formData.status === 'inativo'
                        ? 'Descreva o motivo da alteração de status...'
                        : 'Descreva o motivo da alteração de status (opcional)...'
                    }
                    required={formData.status === 'bloqueado' || formData.status === 'inativo'}
                  />
                </div>
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
                          Email *
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
                              uf: e.target.value.toUpperCase().slice(0, 2),
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
                          placeholder="Cargo"
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
                          !filialForm.email ||
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

              <div className="flex items-center justify-between mt-6">
                {editingCliente ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingCliente(editingCliente);
                      setShowEditModal(false);
                      setShowDeleteModal(true);
                    }}
                    disabled={loadingAction || loadingCnpjLookup}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Excluir
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex space-x-3">
                  <button
                    onClick={handleCloseModals}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={
                      loadingAction ||
                      loadingCnpjLookup ||
                      !formData.cnpj ||
                      !formData.razaoSocial ||
                      !formData.nomeFantasia ||
                      !formData.telefone ||
                      !formData.email ||
                      !formData.endereco ||
                      !formData.cidade ||
                      !formData.bairro ||
                      !formData.cep ||
                      !formData.responsavel ||
                      ((formData.status === 'bloqueado' || formData.status === 'inativo') &&
                        !motivoStatus.trim()) ||
                      ((formData.formaCaptacao === 'indicacao' ||
                        formData.formaCaptacao === 'outro') &&
                        !formData.formaCaptacaoDetalhe.trim())
                    }
                    className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingAction || loadingCnpjLookup ? (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      editingCliente ? 'Atualizar' : 'Adicionar'
                    )}
                  </button>
                </div>
              </div>
            </div>
        </AnimatedModal>

        {/* Modal de Confirmação de Exclusão */}
        <AnimatedModal open={showDeleteModal} onClose={handleCloseModals}>
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#004085]">
                  Confirmar Exclusão
                </h3>
                <button
                  onClick={handleCloseModals}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Você tem certeza que deseja excluir o cliente <b>{deletingCliente?.razaoSocial}</b>?
                </p>
                <p className="text-xs text-red-600">
                  Esta ação não pode ser desfeita.
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseModals}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={loadingAction}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAction ? (
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Excluir'
                  )}
                </button>
              </div>
            </div>
        </AnimatedModal>
        </div>
      </AdminRoute>
    </ProtectedRoute>
  );
}
