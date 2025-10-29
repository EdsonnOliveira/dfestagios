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
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showMultaModal, setShowMultaModal] = useState(false);
  const [multaPercentual, setMultaPercentual] = useState<string>('');
  const [mensalidadeParaMulta, setMensalidadeParaMulta] = useState<Mensalidade | null>(null);
  const [showVencimentoModal, setShowVencimentoModal] = useState(false);
  const [showValorModal, setShowValorModal] = useState(false);
  const [mensalidadeParaEditar, setMensalidadeParaEditar] = useState<Mensalidade | null>(null);
  const [novoVencimento, setNovoVencimento] = useState('');
  const [novoValor, setNovoValor] = useState('');
  
  const [formDataEstagiario, setFormDataEstagiario] = useState({
    nome: '',
    telefone: '',
    email: '',
    dataNascimento: ''
  });

  const [formDataPlano, setFormDataPlano] = useState({
    descricaoServico: '',
    dataPrimeiroVencimento: '',
    periodoPagamento: 'mensal',
    numeroParcelas: '12-parcelas',
    valorParcela: ''
  });

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
  };

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
      telefone: '',
      email: '',
      dataNascimento: ''
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
      valorParcela: ''
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
      const dataVencimento = new Date(formDataPlano.dataPrimeiroVencimento).getDate().toString();
      
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
        const diaVencimento = parseInt(dataVencimento);
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

  const marcarComoPago = async (mensalidadeId: string) => {
    try {
      // Marcar mensalidade como paga no banco
      await mensalidadesService.marcarComoPago(mensalidadeId);
      
      // Recarregar mensalidades para atualizar a interface
      await loadMensalidades();
    } catch (error) {
      console.error('Erro ao marcar mensalidade como paga:', error);
      alert('Erro ao marcar mensalidade como paga');
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

    const dia = parseInt(novoVencimento);
    if (dia < 1 || dia > 31) {
      alert('Por favor, informe um dia válido (1 a 31).');
      return;
    }

    try {
      setLoadingMensalidade(true);
      
      const novaDataVencimento = new Date(mensalidadeParaEditar.dataVencimento);
      novaDataVencimento.setDate(dia);
      
      await mensalidadesService.update(mensalidadeParaEditar.id, {
        dataVencimento: novaDataVencimento
      });
      
      await loadMensalidades();
      fecharModalVencimento();
      alert('Data de vencimento alterada com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar vencimento:', error);
      alert('Erro ao alterar data de vencimento');
    } finally {
      setLoadingMensalidade(false);
    }
  };

  const handleSalvarValor = async () => {
    if (!mensalidadeParaEditar || !novoValor) return;

    const valorNumerico = parseFloat(novoValor.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    if (valorNumerico <= 0) {
      alert('Por favor, informe um valor válido.');
      return;
    }

    try {
      setLoadingMensalidade(true);
      
      await mensalidadesService.update(mensalidadeParaEditar.id, {
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
                            &ldquo;{cliente.motivoStatus}&rdquo;
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
                                Descrição (Observações)
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Parcela
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
                            {mensalidades.map((mensalidade) => (
                              <tr key={mensalidade.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
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
                                        className="menu-dropdown fixed w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700"
                                        style={{
                                          left: `${menuPosition.x}px`,
                                          top: `${menuPosition.y}px`,
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
                                                marcarComoPago(mensalidade.id);
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

          {/* Modal para Plano de Pagamento */}
          {showPlanoModal && (
            <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
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
            </div>
          )}

      {/* Modal de Aplicar Multa */}
      {showMultaModal && (
        <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
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
                Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar?.clienteNome}</span>
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
                Cliente: <span className="font-medium text-gray-900 dark:text-gray-100">{mensalidadeParaEditar?.clienteNome}</span>
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
        </main>
      </div>
    </ProtectedRoute>
  );
}
