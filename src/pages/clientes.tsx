import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import { clientesService } from '../services/firebase';
import { Cliente } from '../types/firebase';

export default function Clientes() {
  const router = useRouter();
  const [filtroRazaoSocial, setFiltroRazaoSocial] = useState('');
  const [filtroNomeFantasia, setFiltroNomeFantasia] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [statusCliente, setStatusCliente] = useState<Cliente | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [novoStatus, setNovoStatus] = useState<'ativo' | 'em-andamento' | 'bloqueado' | 'inativo'>('ativo');
  const [motivoStatus, setMotivoStatus] = useState('');

  const [formData, setFormData] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    telefone: '',
    email: '',
    cidade: '',
    bairro: '',
    cep: '',
    responsavel: '',
    status: 'ativo' as 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo'
  });

  useEffect(() => {
    loadClientes();
  }, []);

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
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');
    
    // Aplica a máscara do CNPJ: XX.XXX.XXX/XXXX-XX
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
      formattedValue = formattedValue.substring(0, 15) + '-' + formattedValue.substring(15, 17);
    }
    
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
      cidade: '',
      bairro: '',
      cep: '',
      responsavel: '',
      status: 'ativo'
    });
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
      cidade: cliente.cidade,
      bairro: cliente.bairro,
      cep: cliente.cep,
      responsavel: cliente.responsavel,
      status: cliente.status
    });
    setShowEditModal(true);
  };

  const handleDelete = (cliente: Cliente) => {
    setDeletingCliente(cliente);
    setShowDeleteModal(true);
  };

  const handleSave = async () => {
    try {
      setLoadingAction(true);
      
      // Validação básica
      
      if (editingCliente) {
        // Editar cliente existente
        await clientesService.update(editingCliente.id!, formData);
        setClientes(prev => prev.map(cliente => 
          cliente.id === editingCliente.id 
            ? { ...cliente, ...formData }
            : cliente
        ));
        setShowEditModal(false);
        setEditingCliente(null);
      } else {
        // Adicionar novo cliente
        const clienteData = {
          ...formData,
          dataVencimento: '',
          valor: '',
          servico: '',
          motivoStatus: '',
          estagiariosVinculados: []
        };
        const id = await clientesService.add(clienteData);
        const newCliente: Cliente = {
          id,
          ...clienteData,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setClientes(prev => [newCliente, ...prev]);
        setShowAddModal(false);
      }
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
    setShowStatusModal(false);
    setEditingCliente(null);
    setDeletingCliente(null);
    setStatusCliente(null);
    setNovoStatus('ativo');
    setMotivoStatus('');
    setFormData({
      cnpj: '',
      razaoSocial: '',
      nomeFantasia: '',
      telefone: '',
      email: '',
      cidade: '',
      bairro: '',
      cep: '',
      responsavel: '',
      status: 'ativo'
    });
  };

  const handleOpenStatusModal = (cliente: Cliente) => {
    setStatusCliente(cliente);
    setNovoStatus(cliente.status);
    setMotivoStatus('');
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!statusCliente) return;
    
    try {
      setLoadingAction(true);
      await clientesService.updateStatus(statusCliente.id!, novoStatus, motivoStatus);
      
      setClientes(prev => prev.map(cliente => 
        cliente.id === statusCliente.id 
          ? { ...cliente, status: novoStatus }
          : cliente
      ));
      
      handleCloseModals();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status. Tente novamente.');
    } finally {
      setLoadingAction(false);
    }
  };

  const filtrarClientes = () => {
    return clientes.filter(cliente => {
      const matchRazaoSocial = cliente.razaoSocial.toLowerCase().includes(filtroRazaoSocial.toLowerCase());
      const matchNomeFantasia = cliente.nomeFantasia.toLowerCase().includes(filtroNomeFantasia.toLowerCase());
      const matchCidade = filtroCidade === '' || cliente.cidade === filtroCidade;
      const matchBairro = filtroBairro === '' || cliente.bairro === filtroBairro;
      const matchStatus = filtroStatus === '' || cliente.status === filtroStatus;
      
      return matchRazaoSocial && matchNomeFantasia && matchCidade && matchBairro && matchStatus;
    });
  };

  const clientesFiltrados = filtrarClientes();

  const cidadesUnicas = Array.from(new Set(clientes.map(c => c.cidade).filter(cidade => cidade))).sort();
  const bairrosUnicos = Array.from(new Set(clientes.map(c => c.bairro).filter(bairro => bairro))).sort();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
        <PainelHeader />

        <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2 px-4 sm:px-0">Clientes</h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base px-4 sm:px-0">Gerencie todos os clientes cadastrados</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-[#004085] dark:text-blue-400">Filtros</h2>
              <button
                onClick={handleAdd}
                className="bg-[#004085] hover:bg-[#0056B3] text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Adicionar Cliente
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
                <table className="w-full">
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
                        Email
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
                      <tr key={cliente.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{cliente.cnpj}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{cliente.nomeFantasia}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{cliente.telefone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{cliente.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => router.push(`/cliente-detalhes?id=${cliente.id}`)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                          >
                            Detalhes
                          </button>
                          <button 
                            onClick={() => handleEdit(cliente)}
                            className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 mr-3"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleOpenStatusModal(cliente)}
                            className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 mr-3"
                          >
                            Status
                          </button>
                          <button 
                            onClick={() => handleDelete(cliente)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            Excluir
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
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    placeholder="email@empresa.com"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="em-andamento">Em andamento</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseModals}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={loadingAction || !formData.cnpj || !formData.razaoSocial || !formData.nomeFantasia || !formData.telefone || !formData.email || !formData.cidade || !formData.bairro || !formData.cep || !formData.responsavel}
                  className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingAction ? (
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    editingCliente ? 'Atualizar' : 'Adicionar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-[#00408580] flex items-center justify-center z-50">
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
          </div>
        )}

        {/* Modal de Alteração de Status */}
        {showStatusModal && (
          <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                  Alterar Status do Cliente
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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cliente
                  </label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                    {statusCliente?.razaoSocial}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status Atual
                  </label>
                  <span 
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      statusCliente?.status === 'ativo' 
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : statusCliente?.status === 'em-andamento'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : statusCliente?.status === 'bloqueado'
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {statusCliente?.status === 'ativo' ? 'Ativo' : 
                     statusCliente?.status === 'em-andamento' ? 'Em andamento' :
                     statusCliente?.status === 'bloqueado' ? 'Bloqueado' : 'Inativo'}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Novo Status *
                  </label>
                  <select
                    value={novoStatus}
                    onChange={(e) => setNovoStatus(e.target.value as 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="em-andamento">Em andamento</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Motivo da Alteração {novoStatus === 'bloqueado' || novoStatus === 'inativo' ? '*' : ''}
                  </label>
                  <textarea
                    value={motivoStatus}
                    onChange={(e) => setMotivoStatus(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                    placeholder={novoStatus === 'bloqueado' || novoStatus === 'inativo' 
                      ? "Descreva o motivo da alteração de status..." 
                      : "Descreva o motivo da alteração de status (opcional)..."
                    }
                    required={novoStatus === 'bloqueado' || novoStatus === 'inativo'}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseModals}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={loadingAction || ((novoStatus === 'bloqueado' || novoStatus === 'inativo') && !motivoStatus.trim())}
                  className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingAction ? (
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Atualizar Status'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
