import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PainelHeader from '../components/PainelHeader';
import { AnimatedModal } from '../components/AnimatedModal';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import { formsService } from '../services/formsService';
import { DynamicForm, FormField, FormFieldType } from '../types/firebase';

type FormListItem = DynamicForm & { responsesCount: number };

const FIELD_TYPES: FormFieldType[] = ['text', 'textarea', 'email', 'tel', 'select'];

const createEmptyField = (order: number): FormField => ({
  id: `field-${Date.now()}-${order}`,
  label: '',
  name: '',
  type: 'text',
  required: true,
  placeholder: '',
  options: [],
  order,
});

export default function FormulariosPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([createEmptyField(0)]);

  const origin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    []
  );

  const loadForms = useCallback(async () => {
    try {
      setLoading(true);
      await formsService.ensureEscritoriosForm();
      const data = await formsService.getAll();
      const withCounts = await Promise.all(
        data.map(async (form) => ({
          ...form,
          responsesCount: form.id
            ? await formsService.countResponses(form.id)
            : 0,
        }))
      );
      setForms(withCounts);
    } catch (error) {
      console.error('Erro ao carregar formulários:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const resetCreateForm = () => {
    setTitle('');
    setSlug('');
    setDescription('');
    setIsActive(true);
    setFields([createEmptyField(0)]);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    resetCreateForm();
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug || slug === formsService.slugify(title)) {
      setSlug(formsService.slugify(value));
    }
  };

  const updateField = (index: number, patch: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((field, i) => {
        if (i !== index) return field;
        const next = { ...field, ...patch };
        if (patch.label !== undefined && (!field.name || field.name === formsService.slugify(field.label).replace(/-/g, '_'))) {
          next.name = formsService.slugify(patch.label).replace(/-/g, '_') || field.name;
        }
        return next;
      })
    );
  };

  const addField = () => {
    setFields((prev) => [...prev, createEmptyField(prev.length)]);
  };

  const removeField = (index: number) => {
    setFields((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((field, order) => ({ ...field, order }))
    );
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next.map((field, order) => ({ ...field, order }));
    });
  };

  const handleCreate = async () => {
    const normalizedSlug = formsService.slugify(slug || title);
    if (!title.trim() || !normalizedSlug || fields.length === 0) return;
    if (fields.some((field) => !field.label.trim() || !field.name.trim())) return;

    try {
      setSaving(true);
      const existing = await formsService.getBySlug(normalizedSlug);
      if (existing) {
        alert('Já existe um formulário com este slug.');
        return;
      }

      await formsService.create({
        title: title.trim(),
        slug: normalizedSlug,
        description: description.trim() || undefined,
        isActive,
        fields: fields.map((field, order) => ({
          ...field,
          label: field.label.trim(),
          name: field.name.trim(),
          placeholder: field.placeholder?.trim() || undefined,
          options:
            field.type === 'select'
              ? (field.options || []).map((item) => item.trim()).filter(Boolean)
              : undefined,
          order,
        })),
      });

      handleCloseModal();
      await loadForms();
    } catch (error) {
      console.error('Erro ao criar formulário:', error);
      alert('Não foi possível criar o formulário.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (form: DynamicForm) => {
    const url = formsService.getPublicUrl(form.slug, origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form.id || form.slug);
      setTimeout(() => setCopiedId(''), 2000);
    } catch (error) {
      console.error('Erro ao copiar link:', error);
    }
  };

  return (
    <ProtectedRoute>
      <AdminRoute>
        <div className='min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors'>
          <PainelHeader />

          <main className='max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24'>
            <div className='mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
              <div>
                <h1 className='text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2'>
                  Formulários
                </h1>
                <p className='text-gray-600 dark:text-gray-300 text-sm sm:text-base'>
                  Crie formulários dinâmicos, copie o link e veja as respostas.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className='bg-[#004085] hover:bg-[#0056B3] text-white font-medium py-2 px-4 rounded-lg transition-colors'
              >
                Novo formulário
              </button>
            </div>

            <div className='bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 transition-colors'>
              {loading ? (
                <div className='p-8 text-center'>
                  <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400' />
                  <p className='mt-2 text-gray-600 dark:text-gray-300'>
                    Carregando formulários...
                  </p>
                </div>
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full'>
                    <thead className='bg-gray-50 dark:bg-slate-700'>
                      <tr>
                        <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase'>
                          Título
                        </th>
                        <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase'>
                          Slug
                        </th>
                        <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase'>
                          Respostas
                        </th>
                        <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase'>
                          Ativo
                        </th>
                        <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase'>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {forms.map((form) => (
                        <tr
                          key={form.id}
                          className='hover:bg-gray-50 dark:hover:bg-slate-700'
                        >
                          <td className='px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100'>
                            {form.title}
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-600 dark:text-gray-300'>
                            {form.slug}
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-600 dark:text-gray-300'>
                            {form.responsesCount}
                          </td>
                          <td className='px-4 py-4 text-sm'>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                form.isActive
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-slate-600 dark:text-gray-300'
                              }`}
                            >
                              {form.isActive ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className='px-4 py-4 text-sm'>
                            <div className='flex flex-wrap gap-2'>
                              <button
                                onClick={() =>
                                  router.push(`/formularios/${form.id}`)
                                }
                                className='text-[#004085] dark:text-blue-400 hover:underline'
                              >
                                Abrir
                              </button>
                              <button
                                onClick={() => copyLink(form)}
                                className='text-gray-600 dark:text-gray-300 hover:underline'
                              >
                                {copiedId === form.id ? 'Copiado!' : 'Copiar link'}
                              </button>
                              <button
                                onClick={() =>
                                  router.push(`/formularios/${form.id}?tab=respostas`)
                                }
                                className='text-gray-600 dark:text-gray-300 hover:underline'
                              >
                                Respostas
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {forms.length === 0 ? (
                    <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                      Nenhum formulário cadastrado.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </main>

          <AnimatedModal open={showCreateModal} onClose={handleCloseModal}>
            <div className='bg-white dark:bg-slate-800 rounded-lg p-4 sm:p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto transition-colors'>
              <div className='flex justify-between items-center mb-4'>
                <h3 className='text-lg font-bold text-[#004085] dark:text-blue-400'>
                  Novo formulário
                </h3>
                <button
                  onClick={handleCloseModal}
                  className='text-gray-500 hover:text-gray-700 dark:text-gray-300'
                >
                  ✕
                </button>
              </div>

              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Título
                  </label>
                  <input
                    value={title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    className='w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-gray-100'
                    placeholder='Ex.: Pesquisa de satisfação'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Slug
                  </label>
                  <input
                    value={slug}
                    onChange={(event) =>
                      setSlug(formsService.slugify(event.target.value))
                    }
                    className='w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-gray-100'
                    placeholder='ex.: pesquisa-satisfacao'
                  />
                  <p className='mt-1 text-xs text-gray-500'>
                    Link público: /f/{slug || 'slug'}
                  </p>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Descrição
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    className='w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-gray-900 dark:text-gray-100'
                  />
                </div>

                <label className='inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
                  <input
                    type='checkbox'
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                  />
                  Formulário ativo
                </label>

                <div className='border-t border-gray-200 dark:border-slate-600 pt-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <h4 className='font-semibold text-[#004085] dark:text-blue-400'>
                      Campos
                    </h4>
                    <button
                      type='button'
                      onClick={addField}
                      className='text-sm bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 px-3 py-1 rounded-lg'
                    >
                      Adicionar campo
                    </button>
                  </div>

                  <div className='space-y-4'>
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className='rounded-lg border border-gray-200 dark:border-slate-600 p-3 space-y-3'
                      >
                        <div className='flex flex-wrap gap-2 justify-between'>
                          <span className='text-sm font-medium text-gray-600 dark:text-gray-300'>
                            Campo {index + 1}
                          </span>
                          <div className='flex gap-2'>
                            <button
                              type='button'
                              onClick={() => moveField(index, -1)}
                              className='text-xs text-gray-500 hover:text-gray-700'
                            >
                              ↑
                            </button>
                            <button
                              type='button'
                              onClick={() => moveField(index, 1)}
                              className='text-xs text-gray-500 hover:text-gray-700'
                            >
                              ↓
                            </button>
                            <button
                              type='button'
                              onClick={() => removeField(index)}
                              className='text-xs text-red-600 hover:text-red-800'
                              disabled={fields.length === 1}
                            >
                              Remover
                            </button>
                          </div>
                        </div>

                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                          <input
                            value={field.label}
                            onChange={(event) =>
                              updateField(index, { label: event.target.value })
                            }
                            placeholder='Label'
                            className='rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm'
                          />
                          <input
                            value={field.name}
                            onChange={(event) =>
                              updateField(index, {
                                name: event.target.value
                                  .replace(/\s+/g, '_')
                                  .toLowerCase(),
                              })
                            }
                            placeholder='name'
                            className='rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm'
                          />
                          <select
                            value={field.type}
                            onChange={(event) =>
                              updateField(index, {
                                type: event.target.value as FormFieldType,
                              })
                            }
                            className='rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm'
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <input
                            value={field.placeholder || ''}
                            onChange={(event) =>
                              updateField(index, {
                                placeholder: event.target.value,
                              })
                            }
                            placeholder='Placeholder'
                            className='rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm'
                          />
                        </div>

                        {field.type === 'select' ? (
                          <input
                            value={(field.options || []).join(', ')}
                            onChange={(event) =>
                              updateField(index, {
                                options: event.target.value
                                  .split(',')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder='Opções separadas por vírgula'
                            className='w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm'
                          />
                        ) : null}

                        <label className='inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
                          <input
                            type='checkbox'
                            checked={field.required}
                            onChange={(event) =>
                              updateField(index, {
                                required: event.target.checked,
                              })
                            }
                          />
                          Obrigatório
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className='mt-6 flex justify-end gap-3'>
                <button
                  onClick={handleCloseModal}
                  className='px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200'
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className='px-4 py-2 rounded-lg bg-[#004085] hover:bg-[#0056B3] text-white disabled:opacity-60'
                >
                  {saving ? 'Salvando...' : 'Criar formulário'}
                </button>
              </div>
            </div>
          </AnimatedModal>
        </div>
      </AdminRoute>
    </ProtectedRoute>
  );
}
