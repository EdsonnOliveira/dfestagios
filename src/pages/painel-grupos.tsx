import { useState, useEffect } from 'react';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import { gruposService } from '../services/firebase';
import { Grupo } from '../types/firebase';

export default function PainelGrupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<Grupo | null>(null);
  const [formData, setFormData] = useState({
    titulo: '',
    link: ''
  });
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    loadGrupos();
  }, []);

  const loadGrupos = async () => {
    try {
      setLoading(true);
      const data = await gruposService.getAll();
      setGrupos(data);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ titulo: '', link: '' });
    setShowAddModal(true);
  };

  const handleEdit = (grupo: Grupo) => {
    setEditingGrupo(grupo);
    setFormData({
      titulo: grupo.titulo,
      link: grupo.link
    });
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este grupo?')) return;

    try {
      setLoadingAction(true);
      await gruposService.delete(id);
      setGrupos(prev => prev.filter(grupo => grupo.id !== id));
    } catch (error) {
      console.error('Erro ao excluir grupo:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSave = async () => {
    if (!formData.titulo.trim() || !formData.link.trim()) return;

    try {
      setLoadingAction(true);
      
      if (editingGrupo) {
        await gruposService.update(editingGrupo.id!, {
          titulo: formData.titulo.trim(),
          link: formData.link.trim()
        });
        
        setGrupos(prev => prev.map(grupo => 
          grupo.id === editingGrupo.id 
            ? { ...grupo, titulo: formData.titulo.trim(), link: formData.link.trim() }
            : grupo
        ));
        
        setShowEditModal(false);
        setEditingGrupo(null);
      } else {
        const newId = await gruposService.add({
          titulo: formData.titulo.trim(),
          link: formData.link.trim()
        });
        
        const newGrupo: Grupo = {
          id: newId,
          titulo: formData.titulo.trim(),
          link: formData.link.trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        setGrupos(prev => [...prev, newGrupo]);
        setShowAddModal(false);
      }
      
      setFormData({ titulo: '', link: '' });
    } catch (error) {
      console.error('Erro ao salvar grupo:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingGrupo(null);
    setFormData({ titulo: '', link: '' });
  };

  const openGrupo = (link: string) => {
    window.open(link, '_blank');
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      alert('Link copiado para a área de transferência!');
    } catch (error) {
      console.error('Erro ao copiar link:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
        <PainelHeader />

        <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2 px-4 sm:px-0">Gerenciar Grupos do WhatsApp</h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base px-4 sm:px-0">Adicione, edite ou remova grupos do WhatsApp</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 transition-colors">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4 sm:gap-0">
              <h2 className="text-lg sm:text-xl font-bold text-[#004085] dark:text-blue-400">
                Grupos ({grupos.length})
              </h2>
              <button
                onClick={handleAdd}
                className="bg-[#25D366] hover:bg-[#128C7E] text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm sm:text-base"
              >
                Adicionar Grupo
              </button>
            </div>

            {loading ? (
              <div className="p-6 sm:p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-[#004085] dark:border-blue-400"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-300 text-sm sm:text-base">Carregando grupos...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Título
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Link
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {grupos.map((grupo) => (
                      <tr key={grupo.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mr-2 sm:mr-3">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                              </svg>
                            </div>
                            <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">{grupo.titulo}</div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <button
                              onClick={() => openGrupo(grupo.link)}
                              className="bg-[#25D366] hover:bg-[#128C7E] text-white font-medium py-1 px-2 sm:px-3 rounded text-xs sm:text-sm transition-colors"
                            >
                              Abrir
                            </button>
                            <button
                              onClick={() => copyLink(grupo.link)}
                              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                              title="Copiar link"
                            >
                              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                          <button 
                            onClick={() => handleEdit(grupo)}
                            className="text-[#004085] dark:text-blue-400 hover:text-[#0056B3] dark:hover:text-blue-300 mr-2 sm:mr-3"
                          >
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDelete(grupo.id!)}
                            disabled={loadingAction}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loadingAction ? (
                              <div className="inline-block animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-current"></div>
                            ) : (
                              'Excluir'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {grupos.length === 0 && (
                  <div className="text-center py-6 sm:py-8">
                    <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">Nenhum grupo cadastrado.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 sm:p-6 w-full max-w-md mx-4 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base sm:text-lg font-bold text-[#004085] dark:text-blue-400">
                  {editingGrupo ? 'Editar Grupo' : 'Adicionar Grupo'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Título do Grupo
                  </label>
                  <input
                    type="text"
                    value={formData.titulo}
                    onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                    placeholder="Ex: Grupo de Estágios em TI"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Link do WhatsApp
                  </label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3 mt-4 sm:mt-6 gap-2 sm:gap-0">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-sm sm:text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={loadingAction || !formData.titulo.trim() || !formData.link.trim()}
                  className="px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#128C7E] disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {loadingAction ? (
                    <div className="inline-block animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                  ) : (
                    editingGrupo ? 'Salvar' : 'Adicionar'
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
