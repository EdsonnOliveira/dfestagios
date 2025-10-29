import { useState, useEffect } from 'react';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import { estagiariosService } from '../services/firebase';
import { Estagiario } from '../types/firebase';

export default function Painel() {
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroCurso, setFiltroCurso] = useState('');
  const [filtroEscolaridade, setFiltroEscolaridade] = useState('');
  const [filtroIdade, setFiltroIdade] = useState('');
  const [filtroIngles, setFiltroIngles] = useState('');
  const [filtroFrances, setFiltroFrances] = useState('');
  const [filtroEspanhol, setFiltroEspanhol] = useState('');
  const [filtroInformatica, setFiltroInformatica] = useState('');
  const [filtroAperfeicoamento, setFiltroAperfeicoamento] = useState('');

  const [estagiarios, setEstagiarios] = useState<Estagiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEstagiario, setEditingEstagiario] = useState<Estagiario | null>(null);
  const [editForm, setEditForm] = useState({
    telefone1: '',
    telefone2: '',
    endereco: '',
    bairro: '',
    cidade: '',
    uf: '',
    complemento: '',
    grauInstrucao: ''
  });
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [showInativarModal, setShowInativarModal] = useState(false);
  const [inativandoEstagiario, setInativandoEstagiario] = useState<Estagiario | null>(null);
  const [motivoInativacao, setMotivoInativacao] = useState('');
  const [loadingInativacao, setLoadingInativacao] = useState(false);
  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const [estagiarioMotivo, setEstagiarioMotivo] = useState<Estagiario | null>(null);

  useEffect(() => {
    loadEstagiarios();
  }, []);

  const loadEstagiarios = async () => {
    try {
      setLoading(true);
      const data = await estagiariosService.getAll();
      setEstagiarios(data);
    } catch (error) {
      console.error('Erro ao carregar estagiários:', error);
    } finally {
      setLoading(false);
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

  const handleToggleStatus = async (id: string, currentStatus: 'ativo' | 'inativo') => {
    if (currentStatus === 'ativo') {
      const estagiario = estagiarios.find(e => e.id === id);
      if (estagiario) {
        setInativandoEstagiario(estagiario);
        setMotivoInativacao('');
        setShowInativarModal(true);
      }
    } else {
      try {
        setLoadingStatus(id);
        const newStatus = await estagiariosService.toggleStatus(id, currentStatus);
        
        setEstagiarios(prev => prev.map(estagiario => 
          estagiario.id === id 
            ? { ...estagiario, status: newStatus, motivoInativacao: '' }
            : estagiario
        ));
      } catch (error) {
        console.error('Erro ao alterar status:', error);
      } finally {
        setLoadingStatus(null);
      }
    }
  };

  const handleConfirmarInativacao = async () => {
    if (!inativandoEstagiario || !motivoInativacao.trim()) return;

    try {
      setLoadingInativacao(true);
      const newStatus = await estagiariosService.toggleStatus(
        inativandoEstagiario.id!, 
        'ativo', 
        motivoInativacao.trim()
      );
      
      setEstagiarios(prev => prev.map(estagiario => 
        estagiario.id === inativandoEstagiario.id 
          ? { ...estagiario, status: newStatus, motivoInativacao: motivoInativacao.trim() }
          : estagiario
      ));

      setShowInativarModal(false);
      setInativandoEstagiario(null);
      setMotivoInativacao('');
    } catch (error) {
      console.error('Erro ao inativar estagiário:', error);
    } finally {
      setLoadingInativacao(false);
    }
  };

  const handleCancelarInativacao = () => {
    setShowInativarModal(false);
    setInativandoEstagiario(null);
    setMotivoInativacao('');
  };

  const handleShowMotivo = (estagiario: Estagiario) => {
    setEstagiarioMotivo(estagiario);
    setShowMotivoModal(true);
  };

  const handleCloseMotivoModal = () => {
    setShowMotivoModal(false);
    setEstagiarioMotivo(null);
  };

  const handleEdit = (estagiario: Estagiario) => {
    setEditingEstagiario(estagiario);
    setEditForm({
      telefone1: estagiario.telefone1 || '',
      telefone2: estagiario.telefone2 || '',
      endereco: estagiario.endereco || '',
      bairro: estagiario.bairro || '',
      cidade: estagiario.cidade || '',
      uf: estagiario.uf || '',
      complemento: estagiario.complemento || '',
      grauInstrucao: estagiario.grauInstrucao || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEstagiario) return;

    try {
      setLoadingEdit(true);
      await estagiariosService.update(editingEstagiario.id!, {
        telefone1: editForm.telefone1,
        telefone2: editForm.telefone2,
        endereco: editForm.endereco,
        bairro: editForm.bairro,
        cidade: editForm.cidade,
        uf: editForm.uf,
        complemento: editForm.complemento,
        grauInstrucao: editForm.grauInstrucao
      });

      setEstagiarios(prev => prev.map(estagiario => 
        estagiario.id === editingEstagiario.id 
          ? { ...estagiario, ...editForm }
          : estagiario
      ));

      setShowEditModal(false);
      setEditingEstagiario(null);
    } catch (error) {
      console.error('Erro ao atualizar estagiário:', error);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingEstagiario(null);
    setEditForm({
      telefone1: '',
      telefone2: '',
      endereco: '',
      bairro: '',
      cidade: '',
      uf: '',
      complemento: '',
      grauInstrucao: ''
    });
  };

  const filtrarEstagiarios = () => {
    return estagiarios.filter(estagiario => {
      const matchNome = estagiario.nome.toLowerCase().includes(filtroNome.toLowerCase());
      const matchCidade = filtroCidade === '' || estagiario.cidade === filtroCidade;
      const matchBairro = filtroBairro === '' || estagiario.bairro === filtroBairro;
      const matchCurso = filtroCurso === '' || 
        (estagiario.outrosCursos && estagiario.outrosCursos.toLowerCase().includes(filtroCurso.toLowerCase()));
      const matchEscolaridade = filtroEscolaridade === '' || estagiario.grauInstrucao === filtroEscolaridade;
      
      const idade = calcularIdade(estagiario.dataNascimento || '');
      const matchIdade = filtroIdade === '' || idade.toString() === filtroIdade;
      
      const matchIngles = filtroIngles === '' || estagiario.ingles === filtroIngles;
      const matchFrances = filtroFrances === '' || estagiario.frances === filtroFrances;
      const matchEspanhol = filtroEspanhol === '' || estagiario.espanhol === filtroEspanhol;
      
      const matchInformatica = filtroInformatica === '' || 
        (estagiario.informatica && estagiario.informatica.some(skill => 
          skill.toLowerCase().includes(filtroInformatica.toLowerCase())
        ));
      
      const matchAperfeicoamento = filtroAperfeicoamento === '' || 
        (estagiario.aperfeicoamento && estagiario.aperfeicoamento.some(skill => 
          skill.toLowerCase().includes(filtroAperfeicoamento.toLowerCase())
        ));
      
      return matchNome && matchCidade && matchBairro && matchCurso && matchEscolaridade && matchIdade && 
             matchIngles && matchFrances && matchEspanhol && matchInformatica && matchAperfeicoamento;
    });
  };

  const estagiariosFiltrados = filtrarEstagiarios();

  const idadesUnicas = Array.from(new Set(estagiarios.map(e => calcularIdade(e.dataNascimento || '')).filter(idade => idade > 0))).sort((a, b) => a - b);
  const cidadesUnicas = Array.from(new Set(estagiarios.map(e => e.cidade).filter(cidade => cidade))).sort();
  const bairrosUnicos = Array.from(new Set(estagiarios.map(e => e.bairro).filter(bairro => bairro))).sort();
  // const escolaridadesUnicas = Array.from(new Set(estagiarios.map(e => e.grauInstrucao).filter(escolaridade => escolaridade))).sort();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
        <PainelHeader />

        <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2 px-4 sm:px-0">Painel de Controle</h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base px-4 sm:px-0">Gerencie todos os estagiários cadastrados</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 transition-colors">
          <h2 className="text-lg sm:text-xl font-bold text-[#004085] dark:text-blue-400 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome
              </label>
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
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
                Idade
              </label>
              <select
                value={filtroIdade}
                onChange={(e) => setFiltroIdade(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todas</option>
                {idadesUnicas.map(idade => (
                  <option key={idade} value={idade.toString()}>{idade} anos</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Curso
              </label>
              <input
                type="text"
                placeholder="Buscar por curso..."
                value={filtroCurso}
                onChange={(e) => setFiltroCurso(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Escolaridade
              </label>
              <select
                value={filtroEscolaridade}
                onChange={(e) => setFiltroEscolaridade(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todas</option>
                <option value="fundamental">Fundamental</option>
                <option value="medio">Médio</option>
                <option value="tecnico">Técnico</option>
                <option value="superior">Superior</option>
                <option value="pos-graduacao">Pós-graduação</option>
              </select>
            </div>
          </div>

          {/* Segunda linha de filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inglês
              </label>
              <select
                value={filtroIngles}
                onChange={(e) => setFiltroIngles(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todos</option>
                <option value="nenhum">Nenhum</option>
                <option value="basico">Básico</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
                <option value="fluente">Fluente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Francês
              </label>
              <select
                value={filtroFrances}
                onChange={(e) => setFiltroFrances(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todos</option>
                <option value="nenhum">Nenhum</option>
                <option value="basico">Básico</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
                <option value="fluente">Fluente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Espanhol
              </label>
              <select
                value={filtroEspanhol}
                onChange={(e) => setFiltroEspanhol(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todos</option>
                <option value="nenhum">Nenhum</option>
                <option value="basico">Básico</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
                <option value="fluente">Fluente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Informática
              </label>
              <input
                type="text"
                placeholder="Ex: Excel, Word, PowerPoint..."
                value={filtroInformatica}
                onChange={(e) => setFiltroInformatica(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Terceira linha de filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aperfeiçoamento/Experiência
              </label>
              <input
                type="text"
                placeholder="Ex: Marketing, Logística, Enfermagem..."
                value={filtroAperfeicoamento}
                onChange={(e) => setFiltroAperfeicoamento(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">
                Estagiários ({estagiariosFiltrados.length})
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando estagiários...</p>
            </div>
          ) : (
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
                {estagiariosFiltrados.map((estagiario) => (
                  <tr key={estagiario.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{estagiario.nome}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{estagiario.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => {
                          const numero = estagiario.telefone1?.replace(/\D/g, '');
                          if (numero) {
                            window.open(`https://wa.me/55${numero}`, '_blank');
                          }
                        }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        {estagiario.telefone1}
                      </button>
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
                        onClick={() => estagiario.status === 'inativo' && handleShowMotivo(estagiario)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer ${
                          estagiario.status === 'ativo' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {estagiario.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => handleEdit(estagiario)}
                        className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 mr-3"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(estagiario.id!, estagiario.status)}
                        disabled={loadingStatus === estagiario.id}
                        className={`${
                          estagiario.status === 'ativo' 
                            ? 'text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300' 
                            : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                        } ${loadingStatus === estagiario.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {loadingStatus === estagiario.id ? (
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          estagiario.status === 'ativo' ? 'Inativar' : 'Ativar'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {estagiariosFiltrados.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">Nenhum estagiário encontrado com os filtros aplicados.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                Editar {editingEstagiario?.nome}
              </h3>
              <button
                onClick={handleCloseModal}
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
                  Telefone Principal
                </label>
                <input
                  type="text"
                  value={editForm.telefone1}
                  onChange={(e) => setEditForm({...editForm, telefone1: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefone Secundário
                </label>
                <input
                  type="text"
                  value={editForm.telefone2}
                  onChange={(e) => setEditForm({...editForm, telefone2: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={editForm.endereco}
                  onChange={(e) => setEditForm({...editForm, endereco: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={editForm.bairro}
                  onChange={(e) => setEditForm({...editForm, bairro: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={editForm.cidade}
                  onChange={(e) => setEditForm({...editForm, cidade: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  UF
                </label>
                <input
                  type="text"
                  value={editForm.uf}
                  onChange={(e) => setEditForm({...editForm, uf: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  value={editForm.complemento}
                  onChange={(e) => setEditForm({...editForm, complemento: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Escolaridade
                </label>
                <select
                  value={editForm.grauInstrucao}
                  onChange={(e) => setEditForm({...editForm, grauInstrucao: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Selecione</option>
                  <option value="fundamental">Fundamental</option>
                  <option value="medio">Médio</option>
                  <option value="tecnico">Técnico</option>
                  <option value="superior">Superior</option>
                  <option value="pos-graduacao">Pós-graduação</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loadingEdit}
                className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingEdit ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

             {showInativarModal && (
         <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
           <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                 Inativar {inativandoEstagiario?.nome}
               </h3>
               <button
                 onClick={handleCancelarInativacao}
                 className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>

             <div className="space-y-4">
               <p className="text-sm text-gray-700 dark:text-gray-300">
                 Você tem certeza que deseja inativar o estagiário <b>{inativandoEstagiario?.nome}</b>?
               </p>
               <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                   Motivo da Inativação
                 </label>
                 <textarea
                   value={motivoInativacao}
                   onChange={(e) => setMotivoInativacao(e.target.value)}
                   rows={4}
                   className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                 />
               </div>
             </div>

             <div className="flex justify-end space-x-3 mt-6">
               <button
                 onClick={handleCancelarInativacao}
                 className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
               >
                 Cancelar
               </button>
               <button
                 onClick={handleConfirmarInativacao}
                 disabled={loadingInativacao || !motivoInativacao.trim()}
                 className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {loadingInativacao ? (
                   <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                 ) : (
                   'Confirmar Inativação'
                 )}
               </button>
             </div>
           </div>
         </div>
       )}

       {showMotivoModal && (
         <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
           <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                 {estagiarioMotivo?.nome} inativado
               </h3>
               <button
                 onClick={handleCloseMotivoModal}
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
                   Motivo da Inativação
                 </label>
                 <textarea
                   value={estagiarioMotivo?.motivoInativacao || ''}
                   readOnly
                   rows={4}
                   className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                 />
               </div>
             </div>

             <div className="flex justify-end mt-6">
               <button
                 onClick={handleCloseMotivoModal}
                 className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
               >
                 Sair
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
