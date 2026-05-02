/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
// import { useRouter } from 'next/router'; // Removido - não utilizado
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PainelHeader from '../components/PainelHeader';
import { AnimatedModal } from '../components/AnimatedModal';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import { clientesService } from '../services/firebase';
import { mensalidadesService, Mensalidade } from '../services/mensalidadesService';
import { Cliente } from '../types/firebase';

export default function Mensalidades() {
  // const router = useRouter(); // Removido - não utilizado
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [clientesComStatus, setClientesComStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showMultaModal, setShowMultaModal] = useState(false);
  const [multaPercentual, setMultaPercentual] = useState<string>('');
  const [clienteParaMulta, setClienteParaMulta] = useState<Cliente | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);
  const [formDataCliente, setFormDataCliente] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    telefone: '',
    email: '',
    cidade: '',
    bairro: '',
    cep: '',
    responsavel: '',
    dataVencimento: '',
    valor: '',
    servico: '',
    status: 'ativo' as 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo'
  });
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [showVencimentoModal, setShowVencimentoModal] = useState(false);
  const [showValorModal, setShowValorModal] = useState(false);
  const [showExcluirModal, setShowExcluirModal] = useState(false);
  const [showFormaPagamentoModal, setShowFormaPagamentoModal] = useState(false);
  const [mensalidadeParaEditar, setMensalidadeParaEditar] = useState<any>(null);
  const [mensalidadeParaExcluir, setMensalidadeParaExcluir] = useState<any>(null);
  const [mensalidadeParaEditarFormaPagamento, setMensalidadeParaEditarFormaPagamento] = useState<any>(null);
  const [novoVencimento, setNovoVencimento] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novaFormaPagamento, setNovaFormaPagamento] = useState<'pix' | 'boleto'>('pix');
  const [loadingMensalidade, setLoadingMensalidade] = useState(false);
  const [showGerarParcelasModal, setShowGerarParcelasModal] = useState(false);
  const [mensalidadeParaGerarParcelas, setMensalidadeParaGerarParcelas] = useState<Mensalidade | null>(null);
  const [selectedParcelasIds, setSelectedParcelasIds] = useState<Set<string>>(new Set());
  const [editingBulkIds, setEditingBulkIds] = useState<string[] | null>(null);
  const [excluirBulkIds, setExcluirBulkIds] = useState<string[] | null>(null);

  // Função removida - não utilizada
  /*
  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    return null;
  };
  */

  const processarClientesComStatus = useCallback(() => {
    // Processar diretamente as mensalidades do banco de dados
    const mensalidadesProcessadas = mensalidades.map(mensalidade => {
      // Buscar dados do cliente para informações adicionais
      const cliente = clientes.find(c => c.id === mensalidade.clienteId);
      
      // Calcular mês/ano de referência
      const dataVencimento = mensalidade.dataVencimento instanceof Date 
        ? mensalidade.dataVencimento 
        : new Date(mensalidade.dataVencimento);
      
      // Recalcular status baseado na data de vencimento
      // Se a mensalidade não estiver paga e a data de vencimento já passou, deve ser "vencido"
      let statusCalculado = mensalidade.status;
      if (mensalidade.status !== 'pago') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const venc = new Date(dataVencimento);
        venc.setHours(0, 0, 0, 0);
        
        // Se a data de vencimento já passou, atualizar para "vencido"
        if (venc < hoje) {
          statusCalculado = 'vencido';
        } else {
          // Se ainda não venceu, manter como "aberto"
          statusCalculado = 'aberto';
        }
      }
      
      return {
        // Dados da mensalidade (principais)
        id: mensalidade.id,
        mensalidadeId: mensalidade.id,
        statusMensalidade: statusCalculado,
        valorMensalidade: mensalidade.valor,
        dataVencimento: dataVencimento.toISOString(),
               dataPagamento: mensalidade.dataPagamento ? 
                 (mensalidade.dataPagamento instanceof Date 
                   ? mensalidade.dataPagamento.toISOString() 
                   : mensalidade.dataPagamento) : null,
               formaPagamento: mensalidade.formaPagamento,
               multaPercentual: mensalidade.multaPercentual,
        numeroParcela: mensalidade.numeroParcela,
        totalParcelas: mensalidade.totalParcelas,
        observacoes: mensalidade.observacoes,
        mesReferencia: `${getMesAbreviado(dataVencimento.getMonth())}/${dataVencimento.getFullYear()}`,
        mensalidadeUnicaId: mensalidade.id,
        
        // Dados do cliente (para exibição)
        razaoSocial: cliente?.razaoSocial || mensalidade.clienteNome,
        nomeFantasia: cliente?.nomeFantasia || '',
        telefone: cliente?.telefone || '',
        email: cliente?.email || '',
        cidade: cliente?.cidade || '',
        bairro: cliente?.bairro || '',
        cep: cliente?.cep || '',
        responsavel: cliente?.responsavel || '',
        servico: cliente?.servico || '',
        status: cliente?.status || 'ativo',
        motivoStatus: cliente?.motivoStatus || '',
        estagiariosVinculados: cliente?.estagiariosVinculados || [],
        createdAt: cliente?.createdAt || new Date(),
        updatedAt: cliente?.updatedAt || new Date()
      };
    });

    // Aplicar filtros
    let mensalidadesFiltradas = mensalidadesProcessadas;

    // Filtro por data
    if (filtroDataInicio || filtroDataFim) {
      mensalidadesFiltradas = mensalidadesFiltradas.filter(mensalidade => {
        const dataVencimento = new Date(mensalidade.dataVencimento);
        // Normalizar data de vencimento para comparar apenas dia/mês/ano (timezone local)
        const dataVencimentoNormalizada = new Date(
          dataVencimento.getFullYear(),
          dataVencimento.getMonth(),
          dataVencimento.getDate()
        );
        
        if (filtroDataInicio) {
          // Parsear string YYYY-MM-DD manualmente para evitar problemas de timezone
          const [anoInicio, mesInicio, diaInicio] = filtroDataInicio.split('-').map(Number);
          const dataInicioNormalizada = new Date(anoInicio, mesInicio - 1, diaInicio);
          
          if (dataVencimentoNormalizada < dataInicioNormalizada) return false;
        }
        
        if (filtroDataFim) {
          // Parsear string YYYY-MM-DD manualmente para evitar problemas de timezone
          const [anoFim, mesFim, diaFim] = filtroDataFim.split('-').map(Number);
          const dataFimNormalizada = new Date(anoFim, mesFim - 1, diaFim);
          
          if (dataVencimentoNormalizada > dataFimNormalizada) return false;
        }
        
        return true;
      });
    }

    // Filtro por cliente
    if (filtroCliente) {
      mensalidadesFiltradas = mensalidadesFiltradas.filter(mensalidade =>
        mensalidade.razaoSocial.toLowerCase().includes(filtroCliente.toLowerCase()) ||
        mensalidade.nomeFantasia.toLowerCase().includes(filtroCliente.toLowerCase())
      );
    }

    // Filtro por status
    if (filtroStatus) {
      mensalidadesFiltradas = mensalidadesFiltradas.filter(mensalidade =>
        mensalidade.statusMensalidade === filtroStatus
      );
    }

    // Adicionar clientes que não têm nenhuma mensalidade
    const clientesIdsComMensalidade = new Set(mensalidades.map(m => m.clienteId));
    const clientesSemMensalidade = clientes
      .filter((cliente): cliente is Cliente & { id: string } => 
        !!cliente.id && !clientesIdsComMensalidade.has(cliente.id)
      )
      .map(cliente => ({
        // Dados da mensalidade (vazios, pois não há mensalidade)
        id: `sem_mensalidade_${cliente.id}`,
        mensalidadeId: '',
        statusMensalidade: 'sem_mensalidade' as const,
        valorMensalidade: 0,
        dataVencimento: '',
        dataPagamento: null,
        formaPagamento: undefined,
        multaPercentual: undefined,
        numeroParcela: undefined,
        totalParcelas: undefined,
        observacoes: '-',
        mesReferencia: '-',
        mensalidadeUnicaId: `sem_mensalidade_${cliente.id}`,
        
        // Dados do cliente (para exibição)
        razaoSocial: cliente.razaoSocial || '',
        nomeFantasia: cliente.nomeFantasia || '',
        telefone: cliente.telefone || '',
        email: cliente.email || '',
        cidade: cliente.cidade || '',
        bairro: cliente.bairro || '',
        cep: cliente.cep || '',
        responsavel: cliente.responsavel || '',
        servico: cliente.servico || '',
        status: cliente.status || 'ativo',
        motivoStatus: cliente.motivoStatus || '',
        estagiariosVinculados: cliente.estagiariosVinculados || [],
        createdAt: cliente.createdAt || new Date(),
        updatedAt: cliente.updatedAt || new Date()
      }));

    // Aplicar filtros aos clientes sem mensalidade
    let clientesSemMensalidadeFiltrados = clientesSemMensalidade;

    // Filtro por cliente
    if (filtroCliente) {
      clientesSemMensalidadeFiltrados = clientesSemMensalidadeFiltrados.filter(cliente =>
        cliente.razaoSocial.toLowerCase().includes(filtroCliente.toLowerCase()) ||
        cliente.nomeFantasia.toLowerCase().includes(filtroCliente.toLowerCase())
      );
    }

    // Filtro por status - se estiver filtrando por "sem_mensalidade", incluir esses clientes
    if (filtroStatus) {
      if (filtroStatus === 'sem_mensalidade') {
        // Manter apenas clientes sem mensalidade
      } else {
        // Se estiver filtrando por outro status, não incluir clientes sem mensalidade
        clientesSemMensalidadeFiltrados = [];
      }
    }

    // Filtro por data - clientes sem mensalidade não têm data de vencimento, então só incluir se não houver filtro de data
    if (filtroDataInicio || filtroDataFim) {
      // Se houver filtro de data, não incluir clientes sem mensalidade
      clientesSemMensalidadeFiltrados = [];
    }

    // Combinar mensalidades filtradas com clientes sem mensalidade
    const todosClientes = [...mensalidadesFiltradas, ...clientesSemMensalidadeFiltrados];

    setClientesComStatus(todosClientes);
  }, [mensalidades, clientes, filtroDataInicio, filtroDataFim, filtroCliente, filtroStatus]);

  useEffect(() => {
    loadMensalidades();
    loadClientes();
  }, []);

  useEffect(() => {
    processarClientesComStatus();
  }, [processarClientesComStatus]);

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

  const loadMensalidades = async () => {
    try {
      setLoading(true);
      const data = await mensalidadesService.getAll();
      setMensalidades(data);
      
      // Atualizar status de mensalidades vencidas no banco de dados
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const atualizacoesPromises = data
        .filter(mensalidade => {
          // Apenas atualizar se não estiver paga
          if (mensalidade.status === 'pago') return false;
          
          // Verificar se está vencida
          const dataVencimento = mensalidade.dataVencimento instanceof Date 
            ? mensalidade.dataVencimento 
            : new Date(mensalidade.dataVencimento);
          const venc = new Date(dataVencimento);
          venc.setHours(0, 0, 0, 0);
          
          // Se está vencida e o status no banco não está como "vencido", precisa atualizar
          return venc < hoje && mensalidade.status !== 'vencido';
        })
        .map(mensalidade => 
          mensalidadesService.update(mensalidade.id, { status: 'vencido' })
            .catch(error => {
              console.error(`Erro ao atualizar status da mensalidade ${mensalidade.id}:`, error);
            })
        );
      
      // Executar atualizações em paralelo (sem bloquear a UI)
      if (atualizacoesPromises.length > 0) {
        Promise.all(atualizacoesPromises).then(() => {
          // Recarregar mensalidades após atualizar os status
          mensalidadesService.getAll().then(updatedData => {
            setMensalidades(updatedData);
          }).catch(error => {
            console.error('Erro ao recarregar mensalidades após atualização:', error);
          });
        });
      }
    } catch (error) {
      console.error('Erro ao carregar mensalidades:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const data = await clientesService.getAll();
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const getMesAbreviado = (mes: number): string => {
    const meses = [
      'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
      'jul', 'ago', 'set', 'out', 'nov', 'dez'
    ];
    return meses[mes] || 'inv';
  };

  const toggleMenu = (id: string, event: React.MouseEvent) => {
    if (menuAberto === id) {
      setMenuAberto(null);
    } else {
      // Capturar posição do mouse
      const x = event.clientX;
      const y = event.clientY;
      
      // Ajustar posição se o menu sair da tela
      const menuWidth = 192; // w-48 = 192px
      const menuHeight = 120; // Altura aproximada do menu
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let adjustedX = x;
      let adjustedY = y;
      
      // Ajustar horizontalmente se sair da tela
      if (x + menuWidth / 2 > viewportWidth) {
        adjustedX = viewportWidth - menuWidth / 2 - 10; // 10px de margem
      } else if (x - menuWidth / 2 < 0) {
        adjustedX = menuWidth / 2 + 10; // 10px de margem
      }
      
      // Ajustar verticalmente se sair da tela
      if (y + menuHeight > viewportHeight) {
        adjustedY = y - menuHeight - 10; // Mostrar acima do cursor
      }
      
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

  const abrirModalCliente = (cliente: any) => {
    setClienteParaEditar(cliente);
    setFormDataCliente({
      cnpj: cliente.cnpj || '',
      razaoSocial: cliente.razaoSocial || '',
      nomeFantasia: cliente.nomeFantasia || '',
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      cidade: cliente.cidade || '',
      bairro: cliente.bairro || '',
      cep: cliente.cep || '',
      responsavel: cliente.responsavel || '',
      dataVencimento: cliente.dataVencimento || '',
      valor: cliente.valor || '',
      servico: cliente.servico || '',
      status: cliente.status || 'ativo'
    });
    setShowClienteModal(true);
    fecharMenu();
  };

  const fecharModalCliente = () => {
    setShowClienteModal(false);
    setClienteParaEditar(null);
    setFormDataCliente({
      cnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
      telefone: '',
      email: '',
      cidade: '',
      bairro: '',
      cep: '',
      responsavel: '',
      dataVencimento: '',
      valor: '',
      servico: '',
      status: 'ativo'
    });
  };

  const handleSalvarCliente = async () => {
    if (!clienteParaEditar?.id) return;

    try {
      setLoadingCliente(true);
      await clientesService.update(clienteParaEditar.id, formDataCliente);
      await loadClientes(); // Recarregar clientes
      fecharModalCliente();
      alert('Cliente atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      alert('Erro ao atualizar cliente');
    } finally {
      setLoadingCliente(false);
    }
  };

  const abrirModalVencimento = (cliente: any) => {
    setMensalidadeParaEditar(cliente);
    // Extrair dia atual do vencimento
    const diaAtual = cliente.dataVencimento ? 
      (() => {
        try {
          const data = new Date(cliente.dataVencimento);
          return data.getDate().toString();
        } catch {
          return '';
        }
      })() : '';
    setNovoVencimento(diaAtual);
    setShowVencimentoModal(true);
    fecharMenu();
  };

  const abrirModalValor = (cliente: any) => {
    setMensalidadeParaEditar(cliente);
    setNovoValor(cliente.valorMensalidade ? formatCurrency(cliente.valorMensalidade) : '');
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

  const abrirModalExcluir = (cliente: any) => {
    setMensalidadeParaExcluir(cliente);
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

  const abrirModalFormaPagamento = (cliente: any) => {
    setMensalidadeParaEditarFormaPagamento(cliente);
    // Usar a forma de pagamento atual ou padrão PIX
    const formaAtual = cliente.formaPagamento || 'pix';
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

  const parcelasSelecionaveis = clientesComStatus.filter(c => c.statusMensalidade !== 'sem_mensalidade' && c.mensalidadeId);

  const toggleParcelaSelection = useCallback((mensalidadeId: string) => {
    setSelectedParcelasIds(prev => {
      const next = new Set(prev);
      if (next.has(mensalidadeId)) next.delete(mensalidadeId);
      else next.add(mensalidadeId);
      return next;
    });
  }, []);

  const toggleSelectAllMensalidades = useCallback(() => {
    const ids = parcelasSelecionaveis.map(c => c.mensalidadeId).filter(Boolean) as string[];
    if (selectedParcelasIds.size === ids.length) {
      setSelectedParcelasIds(new Set());
    } else {
      setSelectedParcelasIds(new Set(ids));
    }
  }, [parcelasSelecionaveis, selectedParcelasIds.size]);

  const abrirBarraVencimento = useCallback(() => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    const first = clientesComStatus.find(c => c.mensalidadeId === ids[0]);
    setMensalidadeParaEditar(null);
    setEditingBulkIds(ids);
    if (first?.dataVencimento) {
      try {
        const data = new Date(first.dataVencimento);
        setNovoVencimento(data.getDate().toString());
      } catch {
        setNovoVencimento('');
      }
    } else {
      setNovoVencimento('');
    }
    setShowVencimentoModal(true);
  }, [selectedParcelasIds, clientesComStatus]);

  const abrirBarraValor = useCallback(() => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    const first = clientesComStatus.find(c => c.mensalidadeId === ids[0]);
    setMensalidadeParaEditar(null);
    setEditingBulkIds(ids);
    setNovoValor(first?.valorMensalidade ? formatCurrency(first.valorMensalidade) : '');
    setShowValorModal(true);
  }, [selectedParcelasIds, clientesComStatus]);

  const abrirBarraFormaPagamento = useCallback(() => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    const first = clientesComStatus.find(c => c.mensalidadeId === ids[0]);
    setMensalidadeParaEditarFormaPagamento(null);
    setEditingBulkIds(ids);
    setNovaFormaPagamento((first?.formaPagamento as 'pix' | 'boleto') || 'pix');
    setShowFormaPagamentoModal(true);
  }, [selectedParcelasIds, clientesComStatus]);

  const marcarSelecionadasComoPago = useCallback(async () => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    try {
      setLoadingAction(true);
      for (const id of ids) {
        const item = clientesComStatus.find(c => c.mensalidadeId === id);
        if (item) await mensalidadesService.marcarComoPago(id, new Date(), (item.formaPagamento || 'pix') as 'pix' | 'boleto');
      }
      await loadMensalidades();
      setSelectedParcelasIds(new Set());
    } catch (error) {
      console.error('Erro ao marcar mensalidades como pagas:', error);
      alert('Erro ao marcar mensalidades como pagas');
    } finally {
      setLoadingAction(false);
    }
  }, [selectedParcelasIds, clientesComStatus]);

  const marcarSelecionadasComoNaoPago = useCallback(async () => {
    const ids = Array.from(selectedParcelasIds);
    if (ids.length === 0) return;
    try {
      setLoadingAction(true);
      for (const id of ids) {
        await mensalidadesService.marcarComoNaoPago(id);
      }
      await loadMensalidades();
      setSelectedParcelasIds(new Set());
    } catch (error) {
      console.error('Erro ao marcar mensalidades como não pagas:', error);
      alert('Erro ao marcar mensalidades como não pagas');
    } finally {
      setLoadingAction(false);
    }
  }, [selectedParcelasIds]);

  const excluirMensalidade = async () => {
    const ids = excluirBulkIds && excluirBulkIds.length > 0 ? excluirBulkIds : (mensalidadeParaExcluir?.mensalidadeId ? [mensalidadeParaExcluir.mensalidadeId] : null);
    if (!ids || ids.length === 0) return;

    try {
      setLoadingAction(true);
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
      setLoadingAction(false);
    }
  };

  const handleSalvarVencimento = async () => {
    if (!novoVencimento) return;
    const dia = parseInt(novoVencimento);
    if (dia < 1 || dia > 31) {
      alert('Por favor, informe um dia válido (1 a 31).');
      return;
    }
    const ids = editingBulkIds && editingBulkIds.length > 0 ? editingBulkIds : (mensalidadeParaEditar?.mensalidadeId ? [mensalidadeParaEditar.mensalidadeId] : null);
    if (!ids || ids.length === 0) return;
    try {
      setLoadingMensalidade(true);
      if (editingBulkIds && editingBulkIds.length > 0) {
        for (const mensalidadeId of ids) {
          const mensalidade = mensalidades.find(m => m.id === mensalidadeId);
          if (mensalidade) {
            const novaDataVencimento = new Date(mensalidade.dataVencimento);
            novaDataVencimento.setDate(dia);
            await mensalidadesService.update(mensalidadeId, { dataVencimento: novaDataVencimento });
          }
        }
        setSelectedParcelasIds(new Set());
      } else {
        const mensalidade = mensalidades.find(m => m.id === ids[0]);
        if (mensalidade) {
          const novaDataVencimento = new Date(mensalidade.dataVencimento);
          novaDataVencimento.setDate(dia);
          await mensalidadesService.update(ids[0], { dataVencimento: novaDataVencimento });
        }
      }
      await loadMensalidades();
      fecharModalVencimento();
      alert(ids.length > 1 ? 'Datas de vencimento alteradas com sucesso!' : 'Data de vencimento alterada com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar vencimento:', error);
      alert('Erro ao alterar data de vencimento: ' + (error instanceof Error ? error.message : String(error)));
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
    const ids = editingBulkIds && editingBulkIds.length > 0 ? editingBulkIds : (mensalidadeParaEditar?.mensalidadeId ? [mensalidadeParaEditar.mensalidadeId] : null);
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

  const handleSalvarFormaPagamento = async () => {
    const ids = editingBulkIds && editingBulkIds.length > 0 ? editingBulkIds : (mensalidadeParaEditarFormaPagamento?.mensalidadeId ? [mensalidadeParaEditarFormaPagamento.mensalidadeId] : null);
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

  const handleValorChange = (value: string) => {
    // Máscara baseada apenas em dígitos: últimos 2 como centavos
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



  const marcarComoPago = async (cliente: any) => {
    const mensalidadeRef = mensalidades.find(m => m.id === cliente.mensalidadeId);
    const abertasDoCliente = mensalidadeRef
      ? mensalidades.filter(m => m.clienteId === mensalidadeRef.clienteId && m.status !== 'pago')
      : [];
    const ehUltimaParcelaAberta = abertasDoCliente.length === 1 && abertasDoCliente[0].id === cliente.mensalidadeId;
    try {
      setLoadingAction(true);
      const formaPagamentoPlano = cliente.formaPagamento || 'pix';
      await mensalidadesService.marcarComoPago(cliente.mensalidadeId, new Date(), formaPagamentoPlano as 'pix' | 'boleto');
      await loadMensalidades();
      if (ehUltimaParcelaAberta && mensalidadeRef) {
        setMensalidadeParaGerarParcelas(mensalidadeRef);
        setShowGerarParcelasModal(true);
      }
    } catch (error) {
      console.error('Erro ao marcar mensalidade como paga:', error);
      alert('Erro ao marcar mensalidade como paga: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoadingAction(false);
    }
  };

  const fecharModalGerarParcelas = () => {
    setShowGerarParcelasModal(false);
    setMensalidadeParaGerarParcelas(null);
  };

  const gerarDozeParcelas = async () => {
    const base = mensalidadeParaGerarParcelas;
    if (!base) return;
    try {
      setLoadingAction(true);
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
          clienteId: base.clienteId,
          clienteNome: base.clienteNome,
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
      setLoadingAction(false);
    }
  };

  const marcarComoNaoPago = async (id: string) => {
    try {
      setLoadingAction(true);
      await mensalidadesService.marcarComoNaoPago(id);
      // Recarregar mensalidades
      await loadMensalidades();
    } catch (error) {
      console.error('Erro ao marcar mensalidade como não pago:', error);
      alert('Erro ao marcar mensalidade como não pago');
    } finally {
      setLoadingAction(false);
    }
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
      doc.text('RELATÓRIO DE MENSALIDADES', pageWidth / 2, 15, { align: 'center' });
      
      // Informações do relatório
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const dataAtual = new Date();
      const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
      const horaFormatada = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      doc.text(`Gerado em: ${dataFormatada} às ${horaFormatada}`, margin, 35);
      
      // Período do relatório
      let periodoTexto = 'Período: Todos os registros';
      if (filtroDataInicio && filtroDataFim) {
        const dataInicio = new Date(filtroDataInicio).toLocaleDateString('pt-BR');
        const dataFim = new Date(filtroDataFim).toLocaleDateString('pt-BR');
        periodoTexto = `Período: ${dataInicio} a ${dataFim}`;
      } else if (filtroDataInicio) {
        const dataInicio = new Date(filtroDataInicio).toLocaleDateString('pt-BR');
        periodoTexto = `A partir de: ${dataInicio}`;
      } else if (filtroDataFim) {
        const dataFim = new Date(filtroDataFim).toLocaleDateString('pt-BR');
        periodoTexto = `Até: ${dataFim}`;
      }
      
      doc.text(periodoTexto, pageWidth - margin, 35, { align: 'right' });
      
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
        { label: 'Total de Clientes', value: clientesComStatus.length, color: [59, 130, 246] },
        { label: 'Mensalidades Pagas', value: clientesComStatus.filter(c => c.statusMensalidade === 'pago').length, color: [34, 197, 94] },
        { label: 'Mensalidades Abertas', value: clientesComStatus.filter(c => c.statusMensalidade === 'aberto').length, color: [251, 191, 36] },
        { label: 'Mensalidades Vencidas', value: clientesComStatus.filter(c => c.statusMensalidade === 'vencido').length, color: [239, 68, 68] },
        { label: 'Sem Mensalidade', value: clientesComStatus.filter(c => c.statusMensalidade === 'sem_mensalidade').length, color: [107, 114, 128] }
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
      
      // Resumo financeiro
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO FINANCEIRO', margin, yPosition);
      
      yPosition += 10;
      
      const financeiroData = [
        { label: 'Valor Total', value: formatCurrency(valoresCalculados.total), color: [59, 130, 246] },
        { label: 'Valor Recebido', value: formatCurrency(valoresCalculados.recebido), color: [34, 197, 94] },
        { label: 'Valor a Receber', value: formatCurrency(valoresCalculados.aReceber), color: [251, 191, 36] },
        { label: 'Valor Vencido', value: formatCurrency(valoresCalculados.vencido), color: [239, 68, 68] }
      ];
      
      const financeiroWidth = (contentWidth - 15) / 4;
      financeiroData.forEach((item, index) => {
        const x = margin + (index * (financeiroWidth + 5));
        
        // Fundo do card
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.roundedRect(x, yPosition, financeiroWidth, 20, 3, 3, 'F');
        
        // Texto do card
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, x + financeiroWidth/2, yPosition + 8, { align: 'center' });
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x + financeiroWidth/2, yPosition + 15, { align: 'center' });
      });
      
      yPosition += 35;
      
      // Linha separadora
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      
      // Tabela de detalhes
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALHAMENTO DAS MENSALIDADES', margin, yPosition);
      
      yPosition += 10;
      
      // Preparar dados da tabela com mais informações
      const tableData = clientesComStatus.map((cliente, index) => [
        index + 1, // Número sequencial
        cliente.nomeFantasia || cliente.razaoSocial,
        cliente.telefone || '-',
        cliente.observacoes || '-',
        cliente.numeroParcela && cliente.totalParcelas ? 
          `${cliente.numeroParcela}/${cliente.totalParcelas}` : '-',
        cliente.dataVencimento ? formatarData(cliente.dataVencimento) : '-',
        cliente.valorMensalidade > 0 ? formatCurrency(cliente.valorMensalidade) : '-',
        getStatusText(cliente.statusMensalidade),
        cliente.dataPagamento ? formatarData(cliente.dataPagamento) : '-',
        cliente.formaPagamento ? cliente.formaPagamento.toUpperCase() : '-'
      ]);
      
      // Configurações da tabela
      const tableConfig = {
        startY: yPosition,
        head: [['#', 'Cliente', 'Telefone', 'Descrição', 'Parcela', 'Vencimento', 'Valor', 'Status', 'Pagamento', 'Forma']],
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
          1: { cellWidth: 35, halign: 'left' as const }, // Cliente
          2: { cellWidth: 20, halign: 'center' as const }, // Telefone
          3: { cellWidth: 25, halign: 'left' as const }, // Descrição
          4: { cellWidth: 12, halign: 'center' as const }, // Parcela
          5: { cellWidth: 18, halign: 'center' as const }, // Vencimento
          6: { cellWidth: 20, halign: 'right' as const }, // Valor
          7: { cellWidth: 15, halign: 'center' as const }, // Status
          8: { cellWidth: 18, halign: 'center' as const }, // Pagamento
          9: { cellWidth: 12, halign: 'center' as const } // Forma
        },
        margin: { left: margin, right: margin },
        showHead: 'everyPage' as const
      };
      
      // Adicionar tabela
      autoTable(doc, tableConfig);
      
      // Rodapé
      const finalY = (doc as any).lastAutoTable?.finalY || yPosition;
      
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
        doc.text(`Total de registros: ${clientesComStatus.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      // Salvar PDF
      const nomeArquivo = `Relatorio_Mensalidades_${dataFormatada.replace(/\//g, '-')}_${horaFormatada.replace(/:/g, '-')}.pdf`;
      doc.save(nomeArquivo);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const formatarData = (data: Date | string) => {
    try {
      if (typeof data === 'string') {
        return new Date(data).toLocaleDateString('pt-BR');
      }
      return data.toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return String(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pago':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'vencido':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'aberto':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'sem_mensalidade':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
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
      case 'sem_mensalidade':
        return 'Sem Mensalidade';
      default:
        return 'Indefinido';
    }
  };

  // Função removida - não utilizada
  /*
  const getDiasVencimentoText = (dataVencimento: Date | string | null) => {
    if (!dataVencimento) {
      return 'Sem data';
    }
    
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
    } else if (dias > 30) {
      // Para datas muito futuras, mostrar a data completa
      return `Vence em ${dataVencimentoDate.toLocaleDateString('pt-BR')}`;
    } else {
      return `Vence em ${dias} dias`;
    }
  };
  */

  // const clientesUnicos = Array.from(new Set(clientes.map(c => c.razaoSocial).filter(razao => razao))).sort();

  // Função para formatar valor monetário
  const formatCurrency = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Calcular valores totais
  const valoresCalculados = {
    total: clientesComStatus.reduce((acc, c) => acc + c.valorMensalidade, 0),
    recebido: clientesComStatus
      .filter(c => c.statusMensalidade === 'pago')
      .reduce((acc, c) => acc + c.valorMensalidade, 0),
    aReceber: clientesComStatus
      .filter(c => c.statusMensalidade === 'aberto')
      .reduce((acc, c) => acc + c.valorMensalidade, 0),
    vencido: clientesComStatus
      .filter(c => c.statusMensalidade === 'vencido')
      .reduce((acc, c) => acc + c.valorMensalidade, 0)
  };

  const abrirModalMulta = (cliente: Cliente) => {
    setClienteParaMulta(cliente);
    // Se já tem multa aplicada, mostrar o percentual atual, senão deixar vazio
    setMultaPercentual((cliente as any).multaPercentual ? (cliente as any).multaPercentual.toString() : '');
    setShowMultaModal(true);
  };

  const aplicarMulta = async () => {
    if (!clienteParaMulta) return;
    const perc = parseFloat(multaPercentual.replace(',', '.'));
    if (isNaN(perc) || perc <= 0) {
      alert('Informe um percentual válido (> 0).');
      return;
    }

    try {
      setLoadingAction(true);
      const novoValor = Math.round(((clienteParaMulta as any).valorMensalidade * (1 + perc / 100)) * 100) / 100;

      if ((clienteParaMulta as any).mensalidadeId) {
        await mensalidadesService.update((clienteParaMulta as any).mensalidadeId, {
          valor: novoValor,
          multaPercentual: perc,
          observacoes: `Multa de ${perc}% aplicada em ${new Date().toLocaleDateString('pt-BR')}`
        });
      }

      await loadMensalidades();
      
      setShowMultaModal(false);
      setClienteParaMulta(null);
    } catch (error) {
      console.error('Erro ao aplicar multa:', error);
      alert('Erro ao aplicar multa');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
        <PainelHeader />

        <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between px-4 sm:px-0">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2">Mensalidades</h1>
                <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
                  {(() => {
                    const hoje = new Date();
                    const mesReferencia = filtroDataInicio ? new Date(filtroDataInicio) : 
                                        filtroDataFim ? new Date(filtroDataFim) : hoje;
                    const isDataFutura = mesReferencia > hoje;
                    
                    return isDataFutura ? 
                      'Previsão de mensalidades futuras' : 
                      'Controle de mensalidades dos clientes';
                  })()}
                </p>
              </div>
              {(() => {
                const hoje = new Date();
                const mesReferencia = filtroDataInicio ? new Date(filtroDataInicio) : 
                                    filtroDataFim ? new Date(filtroDataFim) : hoje;
                const isDataFutura = mesReferencia > hoje;
                
                return isDataFutura ? (
                  <div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium">
                    📅 Modo Previsão
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 transition-colors">
            <h2 className="text-lg sm:text-xl font-bold text-[#004085] dark:text-blue-400 mb-4">Filtros</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Início
                </label>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cliente
                </label>
                <input
                  type="text"
                  placeholder="Buscar por cliente..."
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
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
                  <option value="pago">Pago</option>
                  <option value="vencido">Vencido</option>
                  <option value="aberto">Aberto</option>
                  <option value="sem_mensalidade">Sem Mensalidade</option>
                </select>
              </div>
            </div>

            {/* Filtros Pré-definidos */}
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Filtros Rápidos</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => {
                    const hoje = new Date();
                    const primeiroDiaMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                    const ultimoDiaMesPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                    setFiltroDataInicio(primeiroDiaMesPassado.toISOString().split('T')[0]);
                    setFiltroDataFim(ultimoDiaMesPassado.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  Mês Passado
                </button>
                
                <button
                  onClick={() => {
                    const hoje = new Date();
                    const primeiroDiaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                    const ultimoDiaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                    setFiltroDataInicio(primeiroDiaMesAtual.toISOString().split('T')[0]);
                    setFiltroDataFim(ultimoDiaMesAtual.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                >
                  Mês Atual
                </button>
                
                <button
                  onClick={() => {
                    const hoje = new Date();
                    // Formatar data no formato YYYY-MM-DD usando timezone local
                    const ano = hoje.getFullYear();
                    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                    const dia = String(hoje.getDate()).padStart(2, '0');
                    const dataHoje = `${ano}-${mes}-${dia}`;
                    setFiltroDataInicio(dataHoje);
                    setFiltroDataFim(dataHoje);
                  }}
                  className="px-3 py-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
                >
                  Hoje
                </button>
                
                <button
                  onClick={() => {
                    const hoje = new Date();
                    const primeiroDiaMesSeguinte = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
                    const ultimoDiaMesSeguinte = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0);
                    setFiltroDataInicio(primeiroDiaMesSeguinte.toISOString().split('T')[0]);
                    setFiltroDataFim(ultimoDiaMesSeguinte.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                >
                  Mês Seguinte
                </button>
                
                <button
                  onClick={() => {
                    const hoje = new Date();
                    const primeiroDiaAno = new Date(hoje.getFullYear(), 0, 1);
                    const ultimoDiaAno = new Date(hoje.getFullYear(), 11, 31);
                    setFiltroDataInicio(primeiroDiaAno.toISOString().split('T')[0]);
                    setFiltroDataFim(ultimoDiaAno.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                >
                  Ano Atual
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setFiltroDataInicio('');
                  setFiltroDataFim('');
                  setFiltroCliente('');
                  setFiltroStatus('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Limpar Filtros
              </button>
            </div>
          </div>

          {/* Resumo - Quantidades */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{clientesComStatus.length}</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Clientes</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                      <span className="text-red-600 dark:text-red-400 font-bold">
                        {clientesComStatus.filter(c => c.statusMensalidade === 'vencido').length}
                      </span>
                  </div>
                </div>
                <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Vencidas</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mensalidades</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                      <span className="text-yellow-600 dark:text-yellow-400 font-bold">
                        {clientesComStatus.filter(c => c.statusMensalidade === 'aberto').length}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Abertas</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mensalidades</p>
                </div>
              </div>
            </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        {clientesComStatus.filter(c => c.statusMensalidade === 'pago').length}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pagas</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mensalidades</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 dark:text-gray-400 font-bold">
                        {clientesComStatus.filter(c => c.statusMensalidade === 'sem_mensalidade').length}
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sem</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mensalidade</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo - Valores Monetários */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
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
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(valoresCalculados.total)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
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
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(valoresCalculados.recebido)}</p>
                </div>
              </div>
            </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
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
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(valoresCalculados.aReceber)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 transition-colors">
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
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(valoresCalculados.vencido)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Clientes com Status de Mensalidade */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">
                  {(() => {
                    const hoje = new Date();
                    const mesReferencia = filtroDataInicio ? new Date(filtroDataInicio) : 
                                        filtroDataFim ? new Date(filtroDataFim) : hoje;
                    const isDataFutura = mesReferencia > hoje;
                    
                    return isDataFutura ? 
                      `Previsão de Clientes - Status Mensalidade (${clientesComStatus.length})` :
                      `Clientes - Status Mensalidade (${clientesComStatus.length})`;
                  })()}
                </h2>
                <button
                  onClick={exportarPDF}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar PDF
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando clientes...</p>
              </div>
            ) : (
              <>
                {selectedParcelasIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                      {selectedParcelasIds.size} parcela(s) selecionada(s)
                    </span>
                    <button
                      onClick={marcarSelecionadasComoPago}
                      disabled={loadingAction}
                      className="px-3 py-1.5 text-sm bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Marcar como Pago
                    </button>
                    <button
                      onClick={marcarSelecionadasComoNaoPago}
                      disabled={loadingAction}
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

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={parcelasSelecionaveis.length > 0 && selectedParcelasIds.size === parcelasSelecionaveis.length}
                          onChange={toggleSelectAllMensalidades}
                          className="h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 dark:border-gray-600 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Cliente
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
                          Forma
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Ações
                        </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {clientesComStatus.map((cliente) => (
                      <tr key={cliente.mensalidadeUnicaId || cliente.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-4 py-4">
                          {cliente.statusMensalidade !== 'sem_mensalidade' && cliente.mensalidadeId ? (
                            <input
                              type="checkbox"
                              checked={selectedParcelasIds.has(cliente.mensalidadeId)}
                              onChange={() => toggleParcelaSelection(cliente.mensalidadeId)}
                              className="h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 dark:border-gray-600 rounded"
                            />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {cliente.nomeFantasia || cliente.razaoSocial}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {cliente.telefone ? (
                                <a
                                  href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline cursor-pointer"
                                >
                                  📱 {cliente.telefone}
                                </a>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {cliente.observacoes || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {cliente.numeroParcela && cliente.totalParcelas ? 
                              `${cliente.numeroParcela}/${cliente.totalParcelas}` : 
                              '-'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {cliente.dataVencimento ? 
                              (() => {
                                try {
                                  // Se é uma string ISO, converter para Date e formatar
                                  if (typeof cliente.dataVencimento === 'string' && cliente.dataVencimento.includes('T')) {
                                    const data = new Date(cliente.dataVencimento);
                                    return data.toLocaleDateString('pt-BR');
                                  }
                                  
                                  // Se é apenas o dia (formato antigo)
                                  const dv = String(cliente.dataVencimento).trim();
                                  if (dv.includes('-')) {
                                    // Formato YYYY-MM-DD - extrair apenas o dia
                                    const parts = dv.split('-');
                                    return parts[2] || dv;
                                  } else if (/^\d+$/.test(dv)) {
                                    // Formato DD - retornar como está
                                    return dv;
                                  }
                                  
                                  return dv;
                                } catch (error) {
                                  console.error('Erro ao formatar data de vencimento:', error);
                                  return String(cliente.dataVencimento);
                                }
                              })()
                              : '-'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {cliente.valorMensalidade > 0 ? (
                              <div className="flex items-center space-x-1">
                                <span>{formatCurrency(cliente.valorMensalidade)}</span>
                                {typeof cliente.multaPercentual === 'number' && cliente.multaPercentual > 0 && (
                                  <span className="text-orange-500">+ ({cliente.multaPercentual}%)</span>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(cliente.statusMensalidade)}`}
                          >
                            {getStatusText(cliente.statusMensalidade)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {cliente.dataPagamento ? 
                              (() => {
                                try {
                                  const data = new Date(cliente.dataPagamento);
                                  return data.toLocaleDateString('pt-BR');
                                } catch (error) {
                                  console.error('Erro ao formatar data de pagamento:', error);
                                  return String(cliente.dataPagamento);
                                }
                              })()
                              : '-'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {cliente.formaPagamento ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                cliente.formaPagamento === 'pix' 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              }`}>
                                {cliente.formaPagamento.toUpperCase()}
                              </span>
                            ) : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="relative">
                            <button
                              onClick={(e) => toggleMenu(cliente.mensalidadeUnicaId || cliente.id, e)}
                              className="menu-button p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            {/* Menu Dropdown */}
                            {menuAberto === (cliente.mensalidadeUnicaId || cliente.id) && (
                              <div 
                                className="menu-dropdown fixed w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700"
                                style={{
                                  left: `${menuPosition.x}px`,
                                  top: `${menuPosition.y}px`,
                                  transform: 'translate(-50%, 10px)' // Centralizar horizontalmente e dar um pequeno offset vertical
                                }}
                              >
                                <div className="py-1">
                                  <button
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                                    onClick={() => abrirModalCliente(cliente)}
                                  >
                                    Editar Cliente
                                  </button>
                                  
                                  {/* Mostrar opções de mensalidade apenas se o cliente tiver mensalidade */}
                                  {cliente.statusMensalidade !== 'sem_mensalidade' && (
                                    <>
                                      {cliente.statusMensalidade === 'pago' ? (
                                        <button 
                                          className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                          onClick={() => {
                                            marcarComoNaoPago(cliente.mensalidadeId);
                                            fecharMenu();
                                          }}
                                          disabled={loadingAction}
                                        >
                                          {loadingAction ? (
                                            <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                                          ) : null}
                                          Marcar como Não Pago
                                        </button>
                                      ) : (
                                        <button 
                                          className="block w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                          onClick={() => {
                                            marcarComoPago(cliente);
                                            fecharMenu();
                                          }}
                                          disabled={loadingAction}
                                        >
                                          {loadingAction ? (
                                            <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                                          ) : null}
                                          Marcar como Pago
                                        </button>
                                      )}

                                      {cliente.statusMensalidade === 'vencido' && (
                                        <button
                                          className="block w-full text-left px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                          onClick={() => {
                                            abrirModalMulta(cliente);
                                            fecharMenu();
                                          }}
                                        >
                                          Aplicar Multa
                                        </button>
                                      )}

                                      {cliente.statusMensalidade !== 'pago' && (
                                        <>
                                          <button
                                            className="block w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                            onClick={() => abrirModalVencimento(cliente)}
                                          >
                                            Alterar Vencimento
                                          </button>

                                          <button
                                            className="block w-full text-left px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                            onClick={() => abrirModalValor(cliente)}
                                          >
                                            Alterar Valor
                                          </button>
                                        </>
                                      )}

                                      <button
                                        className="block w-full text-left px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                                        onClick={() => abrirModalFormaPagamento(cliente)}
                                      >
                                        Editar Parcela
                                      </button>

                                      <button
                                        className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={() => abrirModalExcluir(cliente)}
                                        disabled={loadingAction}
                                      >
                                        {loadingAction ? (
                                          <div className="inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                                        ) : null}
                                        Excluir Parcela
                                      </button>
                                    </>
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
                
                {clientesComStatus.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">Nenhum cliente encontrado com os filtros aplicados.</p>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Modal de Edição do Cliente */}
      <AnimatedModal open={showClienteModal} onClose={fecharModalCliente}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                Editar Cliente
              </h3>
              <button
                onClick={fecharModalCliente}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CNPJ *
                </label>
                <input
                  type="text"
                  value={formDataCliente.cnpj}
                  onChange={(e) => setFormDataCliente({...formDataCliente, cnpj: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Razão Social *
                </label>
                <input
                  type="text"
                  value={formDataCliente.razaoSocial}
                  onChange={(e) => setFormDataCliente({...formDataCliente, razaoSocial: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  value={formDataCliente.nomeFantasia}
                  onChange={(e) => setFormDataCliente({...formDataCliente, nomeFantasia: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telefone *
                </label>
                <input
                  type="text"
                  value={formDataCliente.telefone}
                  onChange={(e) => setFormDataCliente({...formDataCliente, telefone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formDataCliente.email}
                  onChange={(e) => setFormDataCliente({...formDataCliente, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cidade *
                </label>
                <input
                  type="text"
                  value={formDataCliente.cidade}
                  onChange={(e) => setFormDataCliente({...formDataCliente, cidade: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bairro *
                </label>
                <input
                  type="text"
                  value={formDataCliente.bairro}
                  onChange={(e) => setFormDataCliente({...formDataCliente, bairro: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CEP *
                </label>
                <input
                  type="text"
                  value={formDataCliente.cep}
                  onChange={(e) => setFormDataCliente({...formDataCliente, cep: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Responsável *
                </label>
                <input
                  type="text"
                  value={formDataCliente.responsavel}
                  onChange={(e) => setFormDataCliente({...formDataCliente, responsavel: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dia de Vencimento
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formDataCliente.dataVencimento}
                  onChange={(e) => setFormDataCliente({...formDataCliente, dataVencimento: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  placeholder="Ex: 15"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valor
                </label>
                <input
                  type="text"
                  value={formDataCliente.valor}
                  onChange={(e) => setFormDataCliente({...formDataCliente, valor: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  placeholder="Ex: R$ 1.200,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Serviço
                </label>
                <input
                  type="text"
                  value={formDataCliente.servico}
                  onChange={(e) => setFormDataCliente({...formDataCliente, servico: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  placeholder="Ex: Consultoria em TI"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status *
                </label>
                <select
                  value={formDataCliente.status}
                  onChange={(e) => setFormDataCliente({...formDataCliente, status: e.target.value as 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo'})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="ativo">Ativo</option>
                  <option value="em-andamento">Em andamento</option>
                  <option value="bloqueado">Bloqueado</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={fecharModalCliente}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarCliente}
                disabled={loadingCliente || !formDataCliente.cnpj || !formDataCliente.razaoSocial || !formDataCliente.telefone || !formDataCliente.email || !formDataCliente.cidade || !formDataCliente.bairro || !formDataCliente.cep || !formDataCliente.responsavel}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingCliente ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Salvar'
                )}
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
                  Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar.razaoSocial}</span>
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
                  Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar.razaoSocial}</span>
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

      <AnimatedModal
        open={showMultaModal}
        onClose={() => setShowMultaModal(false)}
        overlayClassName="bg-black/40 dark:bg-slate-900/80"
      >
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                {(clienteParaMulta as any)?.multaPercentual ? 'Editar Multa' : 'Aplicar Multa'}
              </h3>
              <button
                onClick={() => setShowMultaModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{clienteParaMulta?.razaoSocial}</span>
            </p>

            {(clienteParaMulta as any)?.multaPercentual && (
              <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <span className="font-medium">Multa atual:</span> {(clienteParaMulta as any).multaPercentual}%
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <span className="font-medium">Valor atual:</span> {formatCurrency((clienteParaMulta as any).valorMensalidade)}
                </p>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {(clienteParaMulta as any)?.multaPercentual ? 'Novo Percentual de Multa (%)' : 'Percentual de Multa (%)'}
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
                disabled={loadingAction}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction ? 
                  ((clienteParaMulta as any)?.multaPercentual ? 'Atualizando...' : 'Aplicando...') : 
                  ((clienteParaMulta as any)?.multaPercentual ? 'Atualizar Multa' : 'Aplicar Multa')
                }
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
                      <p className="text-gray-900 dark:text-gray-100">{mensalidadeParaExcluir.razaoSocial}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Valor:</span>
                      <p className="text-gray-900 dark:text-gray-100 font-semibold">
                        {formatCurrency(mensalidadeParaExcluir.valorMensalidade)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Vencimento:</span>
                      <p className="text-gray-900 dark:text-gray-100">
                        {formatarData(mensalidadeParaExcluir.dataVencimento)}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                      <p className="text-gray-900 dark:text-gray-100">
                        {getStatusText(mensalidadeParaExcluir.statusMensalidade)}
                      </p>
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
                disabled={loadingAction}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction ? (
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
                disabled={loadingAction}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Sim, gerar 12 meses'
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
              {!editingBulkIds?.length && mensalidadeParaEditarFormaPagamento && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditarFormaPagamento.razaoSocial}</span>
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
      </AdminRoute>
    </ProtectedRoute>
  );
}

// Modal de Multa
{/* O modal fica ao final para manter a leitura do JSX principal limpa */}
