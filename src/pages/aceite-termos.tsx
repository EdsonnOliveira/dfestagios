import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import {
  TERMOS_CLAUSULAS,
  TERMOS_TITULO,
  VERSAO_TERMOS,
} from '../constants/termosContratacao';
import { clientesService } from '../services/firebase';
import {
  downloadBlobAsFile,
  generateTermosAceitePdfBlob,
} from '../services/termosAceitePdfService';
import { driveStorageService } from '../services/driveStorageService';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import type { Cliente, ClienteTermosAceite } from '../types/firebase';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100';

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const reqMark = (
  <span className="text-red-600 dark:text-red-400" aria-hidden="true">
    *
  </span>
);

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeFileBaseName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-()+ ]/g, '_')
    .trim();
  return base || 'Empresa';
}

function hasAcceptedCurrentVersion(
  termosAceite: ClienteTermosAceite | undefined
): boolean {
  return Boolean(
    termosAceite?.aceito && termosAceite.versaoTermos === VERSAO_TERMOS
  );
}

export default function AceiteTermosPage() {
  const router = useRouter();
  const clienteIdRaw = useMemo(() => {
    const raw = router.query.clienteId;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw[0] ?? '';
    return '';
  }, [router.query.clienteId]);

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [nomeSignatario, setNomeSignatario] = useState('');
  const [cargoSignatario, setCargoSignatario] = useState('');
  const [emailSignatario, setEmailSignatario] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [lastPdfBlob, setLastPdfBlob] = useState<Blob | null>(null);

  const alreadyAccepted = hasAcceptedCurrentVersion(cliente?.termosAceite);

  const loadCliente = useCallback(async () => {
    if (!clienteIdRaw) {
      setLoadError('Link inválido. Solicite um novo link à DF Estágios.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const data = await clientesService.getById(clienteIdRaw);
      if (!data) {
        setCliente(null);
        setLoadError('Cliente não encontrado. Verifique o link e tente novamente.');
        return;
      }
      setCliente(data);
      if (data.responsavel?.trim()) {
        setNomeSignatario(data.responsavel.trim());
      }
      if (data.responsavelCargo?.trim()) {
        setCargoSignatario(data.responsavelCargo.trim());
      }
      if (data.email?.trim()) {
        setEmailSignatario(data.email.trim());
      }
    } catch (error) {
      console.error(error);
      setLoadError('Não foi possível carregar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [clienteIdRaw]);

  useEffect(() => {
    if (!router.isReady) return;
    void loadCliente();
  }, [router.isReady, loadCliente]);

  const handleDownloadExisting = async () => {
    const path = cliente?.termosAceite?.pdfDrivePath?.trim();
    if (!path) {
      if (lastPdfBlob) {
        downloadBlobAsFile(
          lastPdfBlob,
          `Aceite_Termos_${safeFileBaseName(cliente?.nomeFantasia || 'Cliente')}.pdf`
        );
        return;
      }
      toast.error('Comprovante ainda não disponível.');
      return;
    }
    if (!getSupabaseBrowserClient()) {
      toast.error('Armazenamento não configurado para download.');
      return;
    }
    setDownloading(true);
    try {
      const url = await driveStorageService.getSignedDownloadUrl(path);
      const res = await fetch(url);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      downloadBlobAsFile(
        blob,
        `Aceite_Termos_${safeFileBaseName(cliente?.nomeFantasia || 'Cliente')}.pdf`
      );
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível baixar o comprovante.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!cliente?.id || submitting) return;
    if (alreadyAccepted) {
      toast.error('Os termos desta versão já foram aceitos.');
      return;
    }
    const nome = nomeSignatario.trim();
    if (!nome) {
      toast.error('Informe o nome completo do responsável.');
      return;
    }
    if (!aceitouTermos) {
      toast.error('É necessário marcar “Li e aceito” para continuar.');
      return;
    }

    setSubmitting(true);
    try {
      const aceitoEm = new Date();
      const cargo = cargoSignatario.trim();
      const email = emailSignatario.trim();
      const pdfBlob = generateTermosAceitePdfBlob({
        razaoSocial: cliente.razaoSocial,
        nomeFantasia: cliente.nomeFantasia,
        cnpj: cliente.cnpj,
        nomeSignatario: nome,
        cargoSignatario: cargo || undefined,
        emailSignatario: email || undefined,
        aceitoEm,
        versaoTermos: VERSAO_TERMOS,
      });

      let pdfDrivePath: string | undefined;
      if (getSupabaseBrowserClient()) {
        const fileName = `Aceite_Termos_${safeFileBaseName(cliente.nomeFantasia || cliente.razaoSocial)}.pdf`;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (cliente.termosAceite?.pdfDrivePath) {
          try {
            await driveStorageService.remove(cliente.termosAceite.pdfDrivePath);
          } catch {
            void 0;
          }
        }
        pdfDrivePath = await driveStorageService.upload('termo', file);
      }

      const termosAceite: ClienteTermosAceite = {
        aceito: true,
        nomeSignatario: nome,
        ...(cargo ? { cargoSignatario: cargo } : {}),
        ...(email ? { emailSignatario: email } : {}),
        aceitoEm,
        userAgent:
          typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        ...(pdfDrivePath ? { pdfDrivePath } : {}),
        versaoTermos: VERSAO_TERMOS,
      };

      await clientesService.update(cliente.id, { termosAceite });
      setCliente({ ...cliente, termosAceite });
      setLastPdfBlob(pdfBlob);
      downloadBlobAsFile(
        pdfBlob,
        `Aceite_Termos_${safeFileBaseName(cliente.nomeFantasia || cliente.razaoSocial)}.pdf`
      );
      toast.success('Aceite registrado com sucesso. O comprovante foi baixado.');
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar o aceite. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const aceiteDate = toDate(cliente?.termosAceite?.aceitoEm);

  return (
    <>
      <Head>
        <title>Aceite de Termos | DF Estágios</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004085] dark:border-blue-400" />
              <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando...</p>
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-6 text-center">
              <p className="text-sm text-amber-800 dark:text-amber-200">{loadError}</p>
            </div>
          ) : cliente ? (
            <div className="space-y-6">
              <header className="text-center space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#004085] dark:text-blue-400">
                  Aceite de Termos de Contratação
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {cliente.nomeFantasia || cliente.razaoSocial}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  CNPJ: {cliente.cnpj}
                </p>
              </header>

              <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
                <h2 className="text-base font-bold text-[#004085] dark:text-blue-400 border-b border-gray-200 dark:border-gray-600 pb-2">
                  {TERMOS_TITULO}
                </h2>
                <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
                  {TERMOS_CLAUSULAS.map((clausula) => (
                    <div key={clausula.numero} className="space-y-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {clausula.numero}. {clausula.titulo}
                      </h3>
                      {clausula.paragrafos.map((paragrafo, paragrafoIndex) => (
                        <p
                          key={`${clausula.numero}-${paragrafoIndex}`}
                          className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                        >
                          {paragrafo}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Versão dos termos: {VERSAO_TERMOS}
                </p>
              </section>

              {alreadyAccepted ? (
                <section className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-5 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-green-800 dark:text-green-300">
                    Termos já aceitos
                  </h2>
                  <p className="text-sm text-green-900 dark:text-green-200">
                    Aceito em{' '}
                    {aceiteDate
                      ? aceiteDate.toLocaleString('pt-BR')
                      : 'data registrada'}{' '}
                    por {cliente.termosAceite?.nomeSignatario}.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDownloadExisting()}
                    disabled={downloading}
                    className="w-full bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    {downloading ? 'Baixando...' : 'Baixar comprovante'}
                  </button>
                </section>
              ) : (
                <form
                  onSubmit={(e) => void handleSubmit(e)}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4"
                >
                  <h2 className="text-base font-bold text-[#004085] dark:text-blue-400 border-b border-gray-200 dark:border-gray-600 pb-2">
                    Confirmação do aceite
                  </h2>

                  <div>
                    <label className={labelClass} htmlFor="nomeSignatario">
                      Nome completo do responsável {reqMark}
                    </label>
                    <input
                      id="nomeSignatario"
                      className={inputClass}
                      value={nomeSignatario}
                      onChange={(e) => setNomeSignatario(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="cargoSignatario">
                      Cargo (opcional)
                    </label>
                    <input
                      id="cargoSignatario"
                      className={inputClass}
                      value={cargoSignatario}
                      onChange={(e) => setCargoSignatario(e.target.value)}
                      autoComplete="organization-title"
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="emailSignatario">
                      E-mail (opcional)
                    </label>
                    <input
                      id="emailSignatario"
                      type="email"
                      className={inputClass}
                      value={emailSignatario}
                      onChange={(e) => setEmailSignatario(e.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-[#004085] focus:ring-[#004085]"
                      checked={aceitouTermos}
                      onChange={(e) => setAceitouTermos(e.target.checked)}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Li e aceito as Regras Gerais e Termos de Contratação da DF
                      Estágios. {reqMark}
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#004085] dark:bg-blue-600 hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    {submitting ? 'Registrando aceite...' : 'Confirmar aceite'}
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
