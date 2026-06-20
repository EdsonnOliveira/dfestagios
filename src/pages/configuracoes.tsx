import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { fisqalService } from '../services/fisqalService';
import {
  fiscalSettingsService,
  onlyDigits,
} from '../services/fiscalSettingsService';
import {
  DEFAULT_NFSE_SERVICO_CODE,
  getNfseServicoOptions,
} from '../constants/nfseServicos';
import { FiscalAmbiente, FisqalCertificate, FiscalSettings } from '../types/fisqal';

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('pt-BR');
}

function maskCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function Configuracoes() {
  const supabaseReady = useMemo(() => Boolean(getSupabaseBrowserClient()), []);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [formSettings, setFormSettings] = useState({
    cnpjPrestador: '',
    codigoMunicipioEmissor: '',
    inscricaoMunicipalPrestador: '',
    defaultCodigoServico: DEFAULT_NFSE_SERVICO_CODE,
    serieDps: '900',
    fiscalAmbiente: 'producao' as FiscalAmbiente,
  });
  const [certificates, setCertificates] = useState<FisqalCertificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [certNome, setCertNome] = useState('');
  const [certPassword, setCertPassword] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [testingCertId, setTestingCertId] = useState<string | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const [serviceMessage, setServiceMessage] = useState('');

  const loadSettings = useCallback(async () => {
    const data = await fiscalSettingsService.get();
    setSettings(data);
    setFormSettings({
      cnpjPrestador: data.cnpjPrestador,
      codigoMunicipioEmissor: data.codigoMunicipioEmissor,
      inscricaoMunicipalPrestador: data.inscricaoMunicipalPrestador ?? '',
      defaultCodigoServico: data.defaultCodigoServico,
      serieDps: data.serieDps,
      fiscalAmbiente: data.fiscalAmbiente,
    });
  }, []);

  const loadCertificates = useCallback(async () => {
    if (!supabaseReady) return;
    try {
      setLoadingCertificates(true);
      const list = await fisqalService.listCertificates();
      setCertificates(list);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao listar certificados';
      toast.error(message);
    } finally {
      setLoadingCertificates(false);
    }
  }, [supabaseReady]);

  const loadServiceStatus = useCallback(async () => {
    if (!supabaseReady) return;
    try {
      const status = await fisqalService.getServiceStatus();
      setServiceOnline(status.online);
      setServiceMessage(status.message);
    } catch {
      setServiceOnline(null);
      setServiceMessage('');
    }
  }, [supabaseReady]);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await loadSettings();
        if (supabaseReady) {
          await Promise.all([loadCertificates(), loadServiceStatus()]);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erro ao carregar configurações';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCertificates, loadServiceStatus, loadSettings, supabaseReady]);

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await fiscalSettingsService.save({
        ...formSettings,
        cnpjPrestador: onlyDigits(formSettings.cnpjPrestador),
        codigoMunicipioEmissor: onlyDigits(formSettings.codigoMunicipioEmissor),
      });
      await loadSettings();
      toast.success('Dados fiscais salvos');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao salvar dados fiscais';
      toast.error(message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadCertificate = async () => {
    if (!certFile) {
      toast.error('Selecione o arquivo .pfx');
      return;
    }
    if (!certNome.trim()) {
      toast.error('Informe o nome do certificado');
      return;
    }
    if (!certPassword) {
      toast.error('Informe a senha do certificado');
      return;
    }
    try {
      setUploadingCert(true);
      await fisqalService.uploadCertificate(
        certNome.trim(),
        certPassword,
        certFile
      );
      toast.success('Certificado enviado com sucesso');
      setCertNome('');
      setCertPassword('');
      setCertFile(null);
      await loadCertificates();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao enviar certificado';
      toast.error(message);
    } finally {
      setUploadingCert(false);
    }
  };

  const handleTestCertificate = async (certificateId: string) => {
    try {
      setTestingCertId(certificateId);
      const result = await fisqalService.testCertificate(certificateId);
      if (result.valid) {
        toast.success(result.message || 'Certificado válido');
      } else {
        toast.error(result.message || 'Falha no teste do certificado');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao testar certificado';
      toast.error(message);
    } finally {
      setTestingCertId(null);
    }
  };

  const settingsComplete = settings
    ? fiscalSettingsService.isComplete(settings)
    : false;

  return (
    <ProtectedRoute>
      <AdminRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
          <PainelHeader />
          <main className="pt-24 px-4 pb-12 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-[#004085] dark:text-blue-400 mb-2">
              Configurações
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              Dados fiscais da DF Estágios e certificado digital para emissão de NFS-e.
            </p>

            {!supabaseReady && (
              <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-900 dark:text-amber-100">
                Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para
                integração com a FISQAL.
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400" />
              </div>
            ) : (
              <div className="space-y-8">
                <section className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400">
                      Dados fiscais DF Estágios
                    </h2>
                    {!settingsComplete && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                        Incompleto
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        CNPJ prestador
                      </label>
                      <input
                        type="text"
                        value={maskCnpj(formSettings.cnpjPrestador)}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            cnpjPrestador: onlyDigits(e.target.value),
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Código IBGE município emissor
                      </label>
                      <input
                        type="text"
                        value={formSettings.codigoMunicipioEmissor}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            codigoMunicipioEmissor: onlyDigits(e.target.value).slice(
                              0,
                              7
                            ),
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Inscrição municipal
                      </label>
                      <input
                        type="text"
                        value={formSettings.inscricaoMunicipalPrestador}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            inscricaoMunicipalPrestador: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Código serviço padrão
                      </label>
                      <select
                        value={formSettings.defaultCodigoServico}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            defaultCodigoServico: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      >
                        {getNfseServicoOptions(formSettings.defaultCodigoServico).map(
                          (item) => (
                            <option key={item.code} value={item.code}>
                              {item.label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Série DPS
                      </label>
                      <input
                        type="text"
                        value={formSettings.serieDps}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            serieDps: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ambiente fiscal
                      </label>
                      <select
                        value={formSettings.fiscalAmbiente}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            fiscalAmbiente: e.target.value as FiscalAmbiente,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="producao">Produção</option>
                        <option value="homologacao">Homologação</option>
                      </select>
                    </div>
                  </div>
                  {settings && (
                    <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                      Próximo número DPS: {settings.nextNumeroDps}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSaveSettings()}
                    disabled={savingSettings}
                    className="mt-6 bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {savingSettings ? 'Salvando...' : 'Salvar dados fiscais'}
                  </button>
                </section>

                {serviceOnline !== null && (
                  <section className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                    <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400 mb-2">
                      Status SEFIN Nacional
                    </h2>
                    <p
                      className={`text-sm ${
                        serviceOnline
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      {serviceOnline ? 'Online' : 'Indisponível'}
                      {serviceMessage ? ` — ${serviceMessage}` : ''}
                    </p>
                  </section>
                )}

                <section className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                  <h2 className="text-lg font-bold text-[#004085] dark:text-blue-400 mb-6">
                    Certificado digital A1
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nome do certificado
                      </label>
                      <input
                        type="text"
                        value={certNome}
                        onChange={(e) => setCertNome(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Senha do certificado
                      </label>
                      <input
                        type="password"
                        value={certPassword}
                        onChange={(e) => setCertPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Arquivo .pfx
                      </label>
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        onChange={(e) =>
                          setCertFile(e.target.files?.[0] ?? null)
                        }
                        className="w-full text-sm text-gray-700 dark:text-gray-300"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleUploadCertificate()}
                    disabled={uploadingCert || !supabaseReady}
                    className="bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {uploadingCert ? 'Enviando...' : 'Enviar certificado'}
                  </button>

                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                      Certificados cadastrados
                    </h3>
                    {loadingCertificates ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Carregando...
                      </p>
                    ) : certificates.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Nenhum certificado cadastrado.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-600 dark:text-gray-400">
                              <th className="py-2 pr-4">Nome</th>
                              <th className="py-2 pr-4">Status</th>
                              <th className="py-2 pr-4">Válido até</th>
                              <th className="py-2">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {certificates.map((cert) => (
                              <tr
                                key={cert.id}
                                className="border-b border-gray-100 dark:border-gray-700/60"
                              >
                                <td className="py-3 pr-4 text-gray-900 dark:text-gray-100">
                                  {cert.nome}
                                </td>
                                <td className="py-3 pr-4">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                      cert.status === 'active'
                                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    {cert.status}
                                  </span>
                                </td>
                                <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                                  {formatDate(cert.valido_ate)}
                                </td>
                                <td className="py-3">
                                  <button
                                    type="button"
                                    onClick={() => void handleTestCertificate(cert.id)}
                                    disabled={testingCertId === cert.id}
                                    className="text-[#004085] dark:text-blue-400 hover:underline disabled:opacity-50"
                                  >
                                    {testingCertId === cert.id ? 'Testando...' : 'Testar'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </AdminRoute>
    </ProtectedRoute>
  );
}
