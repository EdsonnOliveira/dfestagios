/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
// import { useRouter } from 'next/router'; // Removido - não utilizado
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
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
  const [mensalidadeParaEditar, setMensalidadeParaEditar] = useState<any>(null);
  const [novoVencimento, setNovoVencimento] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [loadingMensalidade, setLoadingMensalidade] = useState(false);

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

  useEffect(() => {
    loadMensalidades();
    loadClientes();
  }, []);

  useEffect(() => {
    processarClientesComStatus();
  }, [clientes, mensalidades, filtroDataInicio, filtroDataFim, filtroCliente, filtroStatus]);

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
  };

  const fecharModalValor = () => {
    setShowValorModal(false);
    setMensalidadeParaEditar(null);
    setNovoValor('');
  };

  const handleSalvarVencimento = async () => {
    if (!mensalidadeParaEditar || !novoVencimento) {
      return;
    }

    const mensalidadeId = mensalidadeParaEditar.mensalidadeId;
    
    if (!mensalidadeId) {
      alert('Erro: ID da mensalidade não encontrado');
      return;
    }

    const dia = parseInt(novoVencimento);
    
    if (dia < 1 || dia > 31) {
      alert('Por favor, informe um dia válido (1 a 31).');
      return;
    }

    try {
      setLoadingMensalidade(true);
      
      // Atualizar mensalidade existente
      const mensalidade = mensalidades.find(m => m.id === mensalidadeId);
      
      if (mensalidade) {
        const novaDataVencimento = new Date(mensalidade.dataVencimento);
        novaDataVencimento.setDate(dia);
        
        await mensalidadesService.update(mensalidadeId, {
          dataVencimento: novaDataVencimento
        });
      }
      
      await loadMensalidades();
      fecharModalVencimento();
      alert('Data de vencimento alterada com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar vencimento:', error);
      alert('Erro ao alterar data de vencimento: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const handleSalvarValor = async () => {
    if (!mensalidadeParaEditar || !novoValor) return;

    const mensalidadeId = mensalidadeParaEditar.mensalidadeId;
    
    if (!mensalidadeId) {
      alert('Erro: ID da mensalidade não encontrado');
      return;
    }

    const valorNumerico = parseFloat(novoValor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    if (valorNumerico <= 0) {
      alert('Por favor, informe um valor válido.');
      return;
    }

    try {
      setLoadingMensalidade(true);
      
      // Atualizar mensalidade existente
      await mensalidadesService.update(mensalidadeId, {
        valor: valorNumerico
      });
      
      await loadMensalidades();
      fecharModalValor();
      alert('Valor alterado com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar valor:', error);
      alert('Erro ao alterar valor');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const handleValorChange = (value: string) => {
    // Formatar valor monetário
    const numberValue = parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numberValue);
    
    setNovoValor(formattedValue);
  };

  const processarClientesComStatus = () => {
    // Processar diretamente as mensalidades do banco de dados
    const mensalidadesProcessadas = mensalidades.map(mensalidade => {
      // Buscar dados do cliente para informações adicionais
      const cliente = clientes.find(c => c.id === mensalidade.clienteId);
      
      // Calcular mês/ano de referência
      const dataVencimento = mensalidade.dataVencimento instanceof Date 
        ? mensalidade.dataVencimento 
        : new Date(mensalidade.dataVencimento);
      
      return {
        // Dados da mensalidade (principais)
        id: mensalidade.id,
        mensalidadeId: mensalidade.id,
        statusMensalidade: mensalidade.status,
        valorMensalidade: mensalidade.valor,
        dataVencimento: dataVencimento.toISOString(),
        dataPagamento: mensalidade.dataPagamento ? 
          (mensalidade.dataPagamento instanceof Date 
            ? mensalidade.dataPagamento.toISOString() 
            : mensalidade.dataPagamento) : null,
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
    let filtrados = mensalidadesProcessadas;

    // Filtro por data (se especificado)
    if (filtroDataInicio || filtroDataFim) {
      filtrados = filtrados.filter(item => {
        const dataVencimento = new Date(item.dataVencimento);
        
        if (filtroDataInicio && filtroDataFim) {
          const dataInicio = new Date(filtroDataInicio + 'T00:00:00');
          const dataFim = new Date(filtroDataFim + 'T23:59:59');
          return dataVencimento >= dataInicio && dataVencimento <= dataFim;
        } else if (filtroDataInicio) {
          const dataInicio = new Date(filtroDataInicio + 'T00:00:00');
          return dataVencimento >= dataInicio;
        } else if (filtroDataFim) {
          const dataFim = new Date(filtroDataFim + 'T23:59:59');
          return dataVencimento <= dataFim;
        }
        
        return true;
      });
    }

    // Filtro por cliente (nome)
    if (filtroCliente) {
      filtrados = filtrados.filter(c => 
        c.razaoSocial.toLowerCase().includes(filtroCliente.toLowerCase())
      );
    }

    // Filtro por status
    if (filtroStatus) {
      filtrados = filtrados.filter(c => c.statusMensalidade === filtroStatus);
    }

    setClientesComStatus(filtrados);
  };

  const marcarComoPago = async (id: string) => {
    try {
      setLoadingAction(true);
      
      // Marcar mensalidade existente como paga
      await mensalidadesService.marcarComoPago(id, new Date());
      
      // Recarregar mensalidades
      await loadMensalidades();
    } catch (error) {
      console.error('Erro ao marcar mensalidade como paga:', error);
      alert('Erro ao marcar mensalidade como paga: ' + (error instanceof Error ? error.message : String(error)));
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
      const doc = new jsPDF();
      
      // Configurações do PDF
      const pageWidth = doc.internal.pageSize.getWidth();
      // const pageHeight = doc.internal.pageSize.getHeight();
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Mensalidades', pageWidth / 2, 20, { align: 'center' });
      
      // Data de geração
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const dataAtual = new Date().toLocaleDateString('pt-BR');
      doc.text(`Gerado em: ${dataAtual}`, pageWidth / 2, 30, { align: 'center' });
      
      // Mês de referência
      if (clientesComStatus.length > 0) {
        doc.text(`Período: ${clientesComStatus[0].mesReferencia}`, pageWidth / 2, 35, { align: 'center' });
      }
      
      // Resumo
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo', 14, 50);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total de Clientes: ${clientesComStatus.length}`, 14, 60);
      doc.text(`Pagas: ${clientesComStatus.filter(c => c.statusMensalidade === 'pago').length}`, 14, 65);
      doc.text(`Abertas: ${clientesComStatus.filter(c => c.statusMensalidade === 'aberto').length}`, 14, 70);
      doc.text(`Vencidas: ${clientesComStatus.filter(c => c.statusMensalidade === 'vencido').length}`, 14, 75);
      doc.text(`Sem Mensalidade: ${clientesComStatus.filter(c => c.statusMensalidade === 'sem_mensalidade').length}`, 14, 80);
      
      // Valores
      doc.text(`Valor Total: ${formatCurrency(valoresCalculados.total)}`, 14, 90);
      doc.text(`Valor Recebido: ${formatCurrency(valoresCalculados.recebido)}`, 14, 95);
      doc.text(`Valor a Receber: ${formatCurrency(valoresCalculados.aReceber)}`, 14, 100);
      doc.text(`Valor Vencido: ${formatCurrency(valoresCalculados.vencido)}`, 14, 105);
      
      // Preparar dados da tabela
      const tableData = clientesComStatus.map(cliente => [
        cliente.razaoSocial,
        cliente.observacoes || '-',
        cliente.numeroParcela && cliente.totalParcelas ? 
          `${cliente.numeroParcela}/${cliente.totalParcelas}` : '-',
        cliente.mesReferencia || '-',
        cliente.dataVencimento ? formatarData(cliente.dataVencimento) : '-',
        cliente.valorMensalidade > 0 ? formatCurrency(cliente.valorMensalidade) : '-',
        getStatusText(cliente.statusMensalidade),
        cliente.dataPagamento ? formatarData(cliente.dataPagamento) : '-'
      ]);
      
      // Configurações da tabela
      const tableConfig = {
        startY: 115,
        head: [['Cliente', 'Descrição (Observações)', 'Parcela', 'Mês/Ano', 'Data Vencimento', 'Valor', 'Status', 'Data Pagamento']],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [0, 64, 133], // Cor azul do tema
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { cellWidth: 30 }, // Cliente
          1: { cellWidth: 25 }, // Descrição (Observações)
          2: { cellWidth: 12 }, // Parcela
          3: { cellWidth: 15 }, // Mês/Ano
          4: { cellWidth: 20 }, // Data Vencimento
          5: { cellWidth: 20 }, // Valor
          6: { cellWidth: 15 }, // Status
          7: { cellWidth: 20 }, // Data Pagamento
        },
        margin: { left: 14, right: 14 },
      };
      
      // Adicionar tabela
      (doc as unknown as { autoTable: (config: unknown) => void }).autoTable(tableConfig);
      
      // Rodapé
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 115;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('Relatório gerado pelo sistema DF Estágios', pageWidth / 2, finalY + 20, { align: 'center' });
      
      // Salvar PDF
      const nomeArquivo = `mensalidades_${dataAtual.replace(/\//g, '-')}.pdf`;
      doc.save(nomeArquivo);
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF');
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
                    const dataHoje = hoje.toISOString().split('T')[0];
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
            <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400 mb-4">
              {(() => {
                const hoje = new Date();
                const mesReferencia = filtroDataInicio ? new Date(filtroDataInicio) : 
                                    filtroDataFim ? new Date(filtroDataFim) : hoje;
                const isDataFutura = mesReferencia > hoje;
                const mesReferenciaText = clientesComStatus.length > 0 ? clientesComStatus[0].mesReferencia : 'Mês Atual';
                
                return isDataFutura ? 
                  `Previsão por Quantidade - ${mesReferenciaText} (Futuro)` : 
                  `Resumo por Quantidade - ${mesReferenciaText}`;
              })()}
            </h2>
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
            <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400 mb-4">
              {(() => {
                const hoje = new Date();
                const mesReferencia = filtroDataInicio ? new Date(filtroDataInicio) : 
                                    filtroDataFim ? new Date(filtroDataFim) : hoje;
                const isDataFutura = mesReferencia > hoje;
                
                return isDataFutura ? 'Previsão por Valores (Futuro)' : 'Resumo por Valores';
              })()}
            </h2>
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Descrição (Observações)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Parcela
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Mês/Ano
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Data Vencimento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Data Pagamento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {clientesComStatus.map((cliente) => (
                      <tr key={cliente.mensalidadeUnicaId || cliente.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {cliente.razaoSocial}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {cliente.nomeFantasia}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <a
                                href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline cursor-pointer"
                              >
                                📱 {cliente.telefone}
                              </a>
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
                            {cliente.mesReferencia}
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
                                        marcarComoPago(cliente.mensalidadeId);
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
            )}
          </div>
        </main>
      </div>

      {/* Modal de Edição do Cliente */}
      {showClienteModal && (
        <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
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
        </div>
      )}

      {/* Modal de Alterar Vencimento */}
      {showVencimentoModal && (
        <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                Alterar Data de Vencimento
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
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar?.razaoSocial}</span>
              </p>
              
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
        </div>
      )}

      {/* Modal de Alterar Valor */}
      {showValorModal && (
        <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                Alterar Valor
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
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar?.razaoSocial}</span>
              </p>
              
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Novo Valor *
              </label>
              <input
                type="text"
                value={novoValor}
                onChange={(e) => handleValorChange(e.target.value)}
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
        </div>
      )}

      {showMultaModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-slate-900/80 flex items-center justify-center z-50">
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
        </div>
      )}
    </ProtectedRoute>
  );
}

// Modal de Multa
{/* O modal fica ao final para manter a leitura do JSX principal limpa */}
