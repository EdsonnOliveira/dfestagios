/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import { clientesService, estagiariosService, vinculacoesService } from '../services/firebase';
import { mensalidadesService, Mensalidade } from '../services/mensalidadesService';
import { Cliente, Estagiario } from '../types/firebase';

export default function ClienteDetalhes() {
  const router = useRouter();
  const { id } = router.query;
  
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [estagiarios, setEstagiarios] = useState<Estagiario[]>([]);
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
  const [activeTab, setActiveTab] = useState<'info' | 'estagiarios' | 'financeiro'>('info');
  const [showMensalidadeModal, setShowMensalidadeModal] = useState(false);
  const [isEditandoMensalidade, setIsEditandoMensalidade] = useState(false);
  
  const [formDataEstagiario, setFormDataEstagiario] = useState({
    nome: '',
    telefone: '',
    email: '',
    dataNascimento: ''
  });

  const [formDataMensalidade, setFormDataMensalidade] = useState({
    diaVencimento: '',
    valor: '',
    servico: ''
  });

  // Normalizador seguro de datas (Date | string | Firestore Timestamp)
  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    return null;
  };

  useEffect(() => {
    if (id) {
      loadCliente();
      loadEstagiarios();
    }
  }, [id]);

  useEffect(() => {
    if (cliente) {
      loadMensalidades();
    }
  }, [cliente]);

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

  const loadCliente = async () => {
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
  };

  const loadEstagiarios = async () => {
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
  };

  const loadMensalidades = async () => {
    try {
      setLoadingMensalidades(true);
      
      if (id && cliente) {
        // Buscar mensalidades específicas do banco
        const mensalidadesData = await mensalidadesService.getByCliente(id as string);
        
        // Gerar mensalidades mensais desde a criação do cliente
        const mensalidadesGeradas = gerarMensalidadesMensais(cliente, mensalidadesData);
        
        setMensalidades(mensalidadesGeradas);
      }
    } catch (error) {
      console.error('Erro ao carregar mensalidades:', error);
    } finally {
      setLoadingMensalidades(false);
    }
  };

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
                   (typeof a.dataVencimento === 'string' ? new Date(a.dataVencimento) : /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ (a.dataVencimento as any).toDate());
      const dateB = b.dataVencimento instanceof Date ? b.dataVencimento : 
                   (typeof b.dataVencimento === 'string' ? new Date(b.dataVencimento) : /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ (b.dataVencimento as any).toDate());
      return dateA.getTime() - dateB.getTime();
    });
  };

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
      telefone: '',
      email: '',
      dataNascimento: ''
    });
    setShowCadastrarModal(true);
  };

  // Função para verificar se o cliente tem dados de vencimento e valor
  const clienteTemDadosFinanceiros = () => {
    if (!cliente) return false;
    
    // Verifica se tem dataVencimento e valor preenchidos
    const temDataVencimento = cliente.dataVencimento && cliente.dataVencimento.trim() !== '';
    const temValor = cliente.valor && cliente.valor.trim() !== '';
    
    return temDataVencimento && temValor;
  };

  const handleAdicionarMensalidade = () => {
    if (clienteTemDadosFinanceiros()) {
      // Se já tem dados, carrega os dados existentes para edição
      const diaVencimento = cliente?.dataVencimento || '';
      const valor = cliente?.valor || '';
      const servico = cliente?.servico || '';
      
      setFormDataMensalidade({
        diaVencimento: diaVencimento,
        valor: valor,
        servico: servico
      });
      setIsEditandoMensalidade(true);
    } else {
      // Se não tem dados, inicia com formulário vazio
      setFormDataMensalidade({
        diaVencimento: '',
        valor: '',
        servico: ''
      });
      setIsEditandoMensalidade(false);
    }
    setShowMensalidadeModal(true);
  };

  const handleValorMensalidadeChange = (value: string) => {
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');
    
    // Se estiver vazio, define como vazio
    if (!numericValue) {
      setFormDataMensalidade({...formDataMensalidade, valor: ''});
      return;
    }
    
    // Converte para número e divide por 100
    const numberValue = parseInt(numericValue) / 100;
    
    // Formata como moeda
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numberValue);
    
    setFormDataMensalidade({...formDataMensalidade, valor: formattedValue});
  };

  const handleSalvarMensalidade = async () => {
    if (!formDataMensalidade.diaVencimento || !formDataMensalidade.valor) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!isEditandoMensalidade && !formDataMensalidade.servico.trim()) {
      alert('Por favor, preencha o campo serviço.');
      return;
    }

    const dia = parseInt(formDataMensalidade.diaVencimento);
    if (dia < 1 || dia > 31) {
      alert('Por favor, informe um dia válido (1 a 31).');
      return;
    }

    try {
      setLoadingMensalidade(true);
      
      if (!cliente || !id) {
        alert('Erro: Cliente não encontrado.');
        return;
      }

      // Converter valor para number
      const valorNumerico = parseFloat(formDataMensalidade.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
      
      if (isEditandoMensalidade) {
        // Atualizar dados do cliente
        await clientesService.update(id as string, {
          dataVencimento: formDataMensalidade.diaVencimento,
          valor: formDataMensalidade.valor,
          servico: formDataMensalidade.servico.trim() || ''
        });
        
        // Recarregar dados do cliente
        await loadCliente();
        
        setShowMensalidadeModal(false);
        alert('Dados financeiros atualizados com sucesso!');
      } else {
        // Criar nova mensalidade
        const hoje = new Date();
        const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
        
        // Se o dia já passou no mês atual, usar o próximo mês
        if (dataVencimento < hoje) {
          dataVencimento.setMonth(dataVencimento.getMonth() + 1);
        }

        const novaMensalidade = {
          clienteId: id as string,
          clienteNome: cliente.razaoSocial,
          dataVencimento: dataVencimento,
          valor: valorNumerico,
          status: 'aberto' as const,
          observacoes: `Serviço: ${formDataMensalidade.servico} - Mensalidade adicionada manualmente`
        };

        await mensalidadesService.create(novaMensalidade);
        
        // Recarregar mensalidades
        await loadMensalidades();
        
        setShowMensalidadeModal(false);
        alert('Mensalidade adicionada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar mensalidade:', error);
      alert('Erro ao salvar mensalidade. Tente novamente.');
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

  const handleCadastrarEstagiario = async () => {
    if (!formDataEstagiario.nome.trim() || !formDataEstagiario.telefone.trim() || !formDataEstagiario.email.trim()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoadingCadastrar(true);
      
      // Criar estagiário
      const novoEstagiario = {
        nome: formDataEstagiario.nome,
        telefone1: formDataEstagiario.telefone,
        email: formDataEstagiario.email,
        dataNascimento: formDataEstagiario.dataNascimento || undefined,
        uf: 'DF', // Valor padrão
        cidade: 'Brasília', // Valor padrão
        bairro: '', // Valor padrão
        endereco: '', // Valor padrão
        grauInstrucao: 'Ensino Médio', // Valor padrão
        status: 'ativo' as const
      };

      const estagiarioId = await estagiariosService.add(novoEstagiario);
      
      // Vincular automaticamente ao cliente
      if (id) {
        await vinculacoesService.vincularEstagiario(id as string, estagiarioId);
        
        // Atualizar listas locais
        const estagiarioCompleto: Estagiario = { 
          ...novoEstagiario, 
          id: estagiarioId,
          createdAt: new Date(),
          updatedAt: new Date()
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
          setEstagiarios(prev => [...prev, estagiarioParaVincular]);
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
        // Desvincular no banco de dados
        await vinculacoesService.desvincularEstagiario(id as string, estagiarioId);
        
        // Atualizar a lista local
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

  const calcularIdade = (dataNascimento: string): number => {
    if (!dataNascimento) return 0;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mesAtual = hoje.getMonth();
    const mesNascimento = nascimento.getMonth();
    
    if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    
    return idade;
  };

  const formatarData = (data: string) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

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

  const marcarComoPago = async (mensalidadeId: string) => {
    try {
      // Se é uma mensalidade gerada automaticamente, criar no banco
      if (mensalidadeId.startsWith('gerada_')) {
        const mensalidade = mensalidades.find(m => m.id === mensalidadeId);
        if (mensalidade) {
          const novaMensalidade = {
            clienteId: mensalidade.clienteId,
            clienteNome: mensalidade.clienteNome,
            dataVencimento: mensalidade.dataVencimento,
            valor: mensalidade.valor,
            multaPercentual: mensalidade.multaPercentual,
            status: 'pago' as const,
            dataPagamento: new Date(),
            observacoes: 'Marcado como pago via sistema'
          };
          
          await mensalidadesService.create(novaMensalidade);
        }
      } else {
        // Se é uma mensalidade existente, apenas marcar como pago
        await mensalidadesService.marcarComoPago(mensalidadeId);
      }
      
      await loadMensalidades();
    } catch (error) {
      console.error('Erro ao marcar mensalidade como paga:', error);
      alert('Erro ao marcar mensalidade como paga');
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
              <div className="mt-4 sm:mt-0 flex space-x-3">
                <button
                  onClick={() => router.push('/clientes')}
                  className="bg-gray-600 dark:bg-slate-700 hover:bg-gray-700 dark:hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => router.push(`/clientes?edit=${cliente.id}`)}
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
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.cnpj}</p>
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
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.telefone}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{cliente.email}</p>
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

                    {cliente.motivoStatus && (
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Motivo do Status
                        </label>
                        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-900 dark:text-gray-100 italic">
                            "{cliente.motivoStatus}"
                          </p>
                        </div>
                      </div>
                    )}

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
                </div>
              )}

              {/* Aba Estagiários */}
              {activeTab === 'estagiarios' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">
                      Estagiários Vinculados ({estagiarios.length})
                    </h2>
                    <div className="flex gap-2">
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
                                Nome
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Email
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Telefone
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Idade
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Cidade
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Bairro
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Grau de Instrução
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
                            {estagiarios.map((estagiario) => (
                              <tr key={estagiario.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{estagiario.nome}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.telefone1}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {estagiario.dataNascimento ? `${calcularIdade(estagiario.dataNascimento)} anos` : '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.cidade}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.bairro || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.grauInstrucao}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span 
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      estagiario.status === 'ativo' 
                                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                    }`}
                                  >
                                    {estagiario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button 
                                    onClick={() => handleDesvincularEstagiario(estagiario.id!)}
                                    disabled={loadingVincular}
                                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {loadingVincular ? (
                                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                    ) : (
                                      'Desvincular'
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
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
                      onClick={handleAdicionarMensalidade}
                      className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      {clienteTemDadosFinanceiros() ? 'Editar mensalidade' : 'Adicionar mensalidade'}
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
                                Situação
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
                            {mensalidades.map((mensalidade) => (
                              <tr key={mensalidade.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {`${mensalidade.dataVencimento.getMonth() + 1}/${mensalidade.dataVencimento.getFullYear()}`}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatarData(mensalidade.dataVencimento.toISOString())}
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
                                    {getDiasVencimentoText(mensalidade.dataVencimento)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900 dark:text-gray-100">
                                    {mensalidade.dataPagamento ? formatarData(mensalidade.dataPagamento.toISOString()) : '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <div className="flex flex-col space-y-2">
                                    {mensalidade.status === 'vencido' && (
                                      <button 
                                        onClick={() => marcarComoPago(mensalidade.id)}
                                        className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 text-xs"
                                      >
                                        Marcar como Pago
                                      </button>
                                    )}
                                    {mensalidade.status === 'aberto' && (
                                      <button 
                                        onClick={() => marcarComoPago(mensalidade.id)}
                                        className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 text-xs"
                                      >
                                        Marcar como Pago
                                      </button>
                                    )}
                                    {mensalidade.id.startsWith('gerada_') && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        (Gerada)
                                      </span>
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
            </div>
          </div>


          {/* Modal para Vincular Estagiários */}
          {showVincularModal && (
            <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
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
                              <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.telefone1}</div>
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
            </div>
          )}

          {/* Modal para Cadastrar Novo Estagiário */}
          {showCadastrarModal && (
            <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
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
                    disabled={loadingCadastrar || !formDataEstagiario.nome.trim() || !formDataEstagiario.telefone.trim() || !formDataEstagiario.email.trim()}
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
            </div>
          )}

          {/* Modal para Adicionar Mensalidade */}
          {showMensalidadeModal && (
            <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                    {isEditandoMensalidade ? 'Editar Mensalidade' : 'Adicionar Mensalidade'}
                  </h3>
                  <button
                    onClick={() => setShowMensalidadeModal(false)}
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
                      Serviço {!isEditandoMensalidade ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      value={formDataMensalidade.servico}
                      onChange={(e) => setFormDataMensalidade({...formDataMensalidade, servico: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      placeholder={isEditandoMensalidade ? "Ex: Consultoria, Desenvolvimento, Suporte (opcional)" : "Ex: Consultoria, Desenvolvimento, Suporte"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Dia de Vencimento *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formDataMensalidade.diaVencimento}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 31)) {
                          setFormDataMensalidade({...formDataMensalidade, diaVencimento: value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      placeholder="Ex: 5, 10, 15, 31"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Digite apenas o dia do mês (1 a 31)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Valor *
                    </label>
                    <input
                      type="text"
                      value={formDataMensalidade.valor}
                      onChange={(e) => handleValorMensalidadeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowMensalidadeModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSalvarMensalidade}
                    disabled={loadingMensalidade || !formDataMensalidade.diaVencimento || !formDataMensalidade.valor || (!isEditandoMensalidade && !formDataMensalidade.servico.trim())}
                    className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loadingMensalidade ? (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      isEditandoMensalidade ? 'Atualizar' : 'Adicionar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
