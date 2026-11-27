import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PainelHeader from '../../components/PainelHeader';
import ProtectedRoute from '../../components/ProtectedRoute';
import AdminRoute from '../../components/AdminRoute';
import { formsService } from '../../services/formsService';
import {
  DynamicForm,
  FormField,
  FormFieldType,
  FormResponse,
} from '../../types/firebase';

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

export default function FormularioDetalhePage() {
  const router = useRouter();
  const formId = typeof router.query.id === 'string' ? router.query.id : '';
  const initialTab =
    router.query.tab === 'respostas' ? 'respostas' : 'editar';

  const [tab, setTab] = useState<'editar' | 'respostas'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);

  const origin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    []
  );

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order),
    [fields]
  );

  const loadData = useCallback(async () => {
    if (!formId) return;
    try {
      setLoading(true);
      const data = await formsService.getById(formId);
      if (!data) {
        setForm(null);
        return;
      }
      setForm(data);
      setTitle(data.title);
      setSlug(data.slug);
      setDescription(data.description || '');
      setIsActive(data.isActive);
      setFields(
        [...data.fields].sort((a, b) => a.order - b.order).map((field, order) => ({
          ...field,
          order,
        }))
      );
      const responseList = await formsService.listResponses(formId);
      setResponses(responseList);
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (!router.isReady) return;
    setTab(router.query.tab === 'respostas' ? 'respostas' : 'editar');
    loadData();
  }, [router.isReady, router.query.tab, loadData]);

  const updateField = (index: number, patch: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...patch } : field))
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

  const handleSave = async () => {
    if (!formId || !title.trim() || !slug.trim()) return;
    if (fields.some((field) => !field.label.trim() || !field.name.trim())) {
      alert('Preencha label e name de todos os campos.');
      return;
    }

    try {
      setSaving(true);
      const normalizedSlug = formsService.slugify(slug);
      const existing = await formsService.getBySlug(normalizedSlug);
      if (existing && existing.id !== formId) {
        alert('Já existe outro formulário com este slug.');
        return;
      }

      await formsService.update(formId, {
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

      await loadData();
      alert('Formulário atualizado.');
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
      alert('Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!formId) return;
    if (!confirm('Excluir este formulário? As respostas continuam no banco.')) {
      return;
    }
    try {
      await formsService.delete(formId);
      router.push('/formularios');
    } catch (error) {
      console.error('Erro ao excluir formulário:', error);
      alert('Não foi possível excluir.');
    }
  };

  const copyLink = async () => {
    if (!form) return;
    const url = formsService.getPublicUrl(form.slug, origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar link:', error);
    }
  };

  const formatDate = (value: Date) =>
    value.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <ProtectedRoute>
      <AdminRoute>
        <div className='min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors'>
          <PainelHeader />

          <main className='max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24'>
            <div className='mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
              <div>
                <button
                  onClick={() => router.push('/formularios')}
                  className='text-sm text-[#004085] dark:text-blue-400 hover:underline mb-2'
                >
                  ← Voltar
                </button>
                <h1 className='text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400'>
                  {form?.title || 'Formulário'}
                </h1>
              </div>
              <div className='flex flex-wrap gap-2'>
                <button
                  onClick={copyLink}
                  className='bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-100 font-medium py-2 px-4 rounded-lg'
                >
                  {copied ? 'Link copiado!' : 'Copiar link'}
                </button>
                <button
                  onClick={handleDelete}
                  className='bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg'
                >
                  Excluir
                </button>
              </div>
            </div>

            <div className='mb-4 flex gap-2'>
              <button
                onClick={() => setTab('editar')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  tab === 'editar'
                    ? 'bg-[#004085] text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Editar
              </button>
              <button
                onClick={() => setTab('respostas')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  tab === 'respostas'
                    ? 'bg-[#004085] text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200'
                }`}
              >
                Respostas ({responses.length})
              </button>
            </div>

            {loading ? (
              <div className='bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center'>
                <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400' />
                <p className='mt-2 text-gray-600 dark:text-gray-300'>
                  Carregando...
                </p>
              </div>
            ) : !form ? (
              <div className='bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center text-gray-600 dark:text-gray-300'>
                Formulário não encontrado.
              </div>
            ) : tab === 'editar' ? (
              <div className='bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 space-y-4'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      Título
                    </label>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className='w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2'
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
                      className='w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2'
                    />
                    <p className='mt-1 text-xs text-gray-500'>
                      Link: {formsService.getPublicUrl(slug || form.slug, origin)}
                    </p>
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                    Descrição
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    className='w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2'
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
                    <h2 className='font-semibold text-[#004085] dark:text-blue-400'>
                      Campos
                    </h2>
                    <button
                      type='button'
                      onClick={addField}
                      className='text-sm bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 px-3 py-1 rounded-lg'
                    >
                      Adicionar campo
                    </button>
                  </div>

                  <div className='space-y-4'>
                    {sortedFields.map((field, index) => (
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
                              className='text-xs text-gray-500'
                            >
                              ↑
                            </button>
                            <button
                              type='button'
                              onClick={() => moveField(index, 1)}
                              className='text-xs text-gray-500'
                            >
                              ↓
                            </button>
                            <button
                              type='button'
                              onClick={() => removeField(index)}
                              className='text-xs text-red-600'
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

                <div className='pt-2'>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className='bg-[#004085] hover:bg-[#0056B3] text-white font-medium py-2 px-4 rounded-lg disabled:opacity-60'
                  >
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            ) : (
              <div className='bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 overflow-x-auto'>
                {responses.length === 0 ? (
                  <p className='text-gray-500 dark:text-gray-400 text-center py-8'>
                    Nenhuma resposta ainda.
                  </p>
                ) : (
                  <table className='w-full min-w-[640px]'>
                    <thead className='bg-gray-50 dark:bg-slate-700'>
                      <tr>
                        <th className='px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase'>
                          Data
                        </th>
                        {sortedFields.map((field) => (
                          <th
                            key={field.id}
                            className='px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase'
                          >
                            {field.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                      {responses.map((response) => (
                        <tr key={response.id}>
                          <td className='px-3 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap'>
                            {formatDate(response.createdAt)}
                          </td>
                          {sortedFields.map((field) => (
                            <td
                              key={`${response.id}-${field.name}`}
                              className='px-3 py-3 text-sm text-gray-700 dark:text-gray-200'
                            >
                              {response.answers[field.name] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </main>
        </div>
      </AdminRoute>
    </ProtectedRoute>
  );
}
