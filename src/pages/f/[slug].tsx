import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { formsService } from '../../services/formsService';
import { DynamicForm, FormField } from '../../types/firebase';

export default function PublicFormPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';

  const [form, setForm] = useState<DynamicForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const fields = useMemo(
    () => [...(form?.fields ?? [])].sort((a, b) => a.order - b.order),
    [form]
  );

  const loadForm = useCallback(async () => {
    if (!slug) return;

    if (slug === 'escritorios') {
      router.replace('/escritorios');
      return;
    }

    try {
      setLoading(true);
      setNotFound(false);
      setError('');
      const data = await formsService.getBySlug(slug);
      if (!data || !data.isActive) {
        setForm(null);
        setNotFound(true);
        return;
      }
      setForm(data);
      const initial: Record<string, string> = {};
      data.fields.forEach((field) => {
        initial[field.name] = '';
      });
      setAnswers(initial);
    } catch (err) {
      console.error('Erro ao carregar formulário público:', err);
      setError('Não foi possível carregar o formulário.');
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    if (!router.isReady) return;
    loadForm();
  }, [router.isReady, loadForm]);

  const handleChange = (field: FormField, value: string) => {
    setAnswers((prev) => ({ ...prev, [field.name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    try {
      setSubmitting(true);
      setError('');
      await formsService.submitResponse(form, answers);
      setSuccess(true);
    } catch (err) {
      console.error('Erro ao enviar resposta:', err);
      setError('Não foi possível enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      required: field.required,
      placeholder: field.placeholder || '',
      value: answers[field.name] || '',
      onChange: (
        event: ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
      ) => handleChange(field, event.target.value),
      className:
        'w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-[#004085] focus:ring-2 focus:ring-[#004085]/20',
    };

    if (field.type === 'textarea') {
      return <textarea {...commonProps} rows={4} />;
    }

    if (field.type === 'select') {
      return (
        <select {...commonProps}>
          <option value="">Selecione</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return <input type={field.type} {...commonProps} />;
  };

  return (
    <>
      <Head>
        <title>
          {form?.title ? `${form.title} | DF Estágios` : 'Formulário | DF Estágios'}
        </title>
      </Head>

      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg sm:p-8">
          {loading ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-[#004085]" />
              <p className="text-gray-600">Carregando formulário...</p>
            </div>
          ) : notFound ? (
            <div className="py-10 text-center">
              <h1 className="mb-2 text-2xl font-bold text-[#004085]">
                Formulário não encontrado
              </h1>
              <p className="text-gray-600">
                Este link é inválido ou o formulário está inativo.
              </p>
            </div>
          ) : success ? (
            <div className="py-10 text-center">
              <h1 className="mb-2 text-2xl font-bold text-[#004085]">
                Resposta enviada
              </h1>
              <p className="text-gray-600">
                Obrigado! Recebemos suas informações.
              </p>
            </div>
          ) : (
            <>
              <h1 className="mb-2 text-2xl font-bold text-[#004085] sm:text-3xl">
                {form?.title}
              </h1>
              {form?.description ? (
                <p className="mb-6 text-gray-600">{form.description}</p>
              ) : (
                <div className="mb-6" />
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id}>
                    <label
                      htmlFor={field.name}
                      className="mb-1 block text-sm font-semibold text-gray-700"
                    >
                      {field.label}
                      {field.required ? (
                        <span className="text-red-500"> *</span>
                      ) : null}
                    </label>
                    {renderField(field)}
                  </div>
                ))}

                {error ? (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#004085] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#0056B3] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
