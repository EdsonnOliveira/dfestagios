import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import PainelHeader from '../components/PainelHeader';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminRoute from '../components/AdminRoute';
import {
  driveStorageService,
  DriveCategory,
  DriveFileRow,
} from '../services/driveStorageService';
import { estagiariosService } from '../services/firebase';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';

const CATEGORY_LABELS: Record<DriveCategory, string> = {
  contrato: 'Contrato',
  termo: 'Termo',
  outro: 'Outro',
};

function formatBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type PreviewType = 'pdf' | 'image' | 'docx' | 'other';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function getPreviewType(file: DriveFileRow): PreviewType {
  if (file.mimeType === 'application/pdf') return 'pdf';
  if (file.mimeType === DOCX_MIME) return 'docx';
  if (file.mimeType?.startsWith('image/')) return 'image';
  const lower = file.displayName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif')
  ) {
    return 'image';
  }
  return 'other';
}

function drivePreviewIframeUrl(
  file: DriveFileRow,
  signedUrl: string
): string {
  if (getPreviewType(file) === 'docx') {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      signedUrl
    )}`;
  }
  return signedUrl;
}

export default function Drive() {
  const router = useRouter();
  const [files, setFiles] = useState<DriveFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadCategory, setUploadCategory] = useState<DriveCategory>('contrato');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<DriveCategory | 'todos'>('todos');
  const [actionPath, setActionPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFileRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [internNameByPath, setInternNameByPath] = useState<Record<string, string>>({});

  const supabaseReady = useMemo(() => Boolean(getSupabaseBrowserClient()), []);

  const loadFiles = useCallback(async () => {
    if (!supabaseReady) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      const list = await driveStorageService.listAll();
      const names: Record<string, string> = {};
      try {
        const ests = await estagiariosService.getAll();
        for (const e of ests) {
          const p = e.contratoPdfDrivePath?.trim();
          if (p && e.nome?.trim()) names[p] = e.nome.trim();
        }
      } catch {
        void 0;
      }
      setInternNameByPath(names);
      setFiles(list);
    } catch (e) {
      console.error(e);
      setErrorMessage(
        e instanceof Error ? e.message : 'Não foi possível carregar os arquivos.',
      );
    } finally {
      setLoading(false);
    }
  }, [supabaseReady]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (!router.isReady) return;
    const cat = router.query.categoria;
    if (cat === 'contrato' || cat === 'termo' || cat === 'outro') {
      setFilterCategory(cat);
      setUploadCategory(cat);
    }
    if (router.query.focusUpload === '1') {
      requestAnimationFrame(() => {
        document.getElementById('drive-upload-section')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    }
  }, [router.isReady, router.query.categoria, router.query.focusUpload]);

  const filteredFiles = useMemo(() => {
    if (filterCategory === 'todos') return files;
    return files.filter((f) => f.category === filterCategory);
  }, [files, filterCategory]);

  const handleUpload = async () => {
    if (!selectedFile || !supabaseReady) return;
    try {
      setUploading(true);
      setErrorMessage(null);
      await driveStorageService.upload(uploadCategory, selectedFile);
      setSelectedFile(null);
      await loadFiles();
    } catch (e) {
      console.error(e);
      setErrorMessage(
        e instanceof Error ? e.message : 'Falha ao enviar o arquivo.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fullPath: string) => {
    if (!supabaseReady) return;
    try {
      setActionPath(fullPath);
      setErrorMessage(null);
      const url = await driveStorageService.getSignedDownloadUrl(fullPath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error(e);
      setErrorMessage(
        e instanceof Error ? e.message : 'Não foi possível gerar o link de download.',
      );
    } finally {
      setActionPath(null);
    }
  };

  const handleDelete = async (fullPath: string) => {
    if (!supabaseReady) return;
    if (!confirm('Excluir este arquivo do drive?')) return;
    try {
      setActionPath(fullPath);
      setErrorMessage(null);
      await driveStorageService.remove(fullPath);
      await loadFiles();
    } catch (e) {
      console.error(e);
      setErrorMessage(
        e instanceof Error ? e.message : 'Não foi possível excluir o arquivo.',
      );
    } finally {
      setActionPath(null);
    }
  };

  const handlePreview = async (row: DriveFileRow) => {
    if (!supabaseReady) return;
    try {
      setPreviewFile(row);
      setPreviewLoading(true);
      setErrorMessage(null);
      const url = await driveStorageService.getSignedDownloadUrl(row.fullPath);
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
      setPreviewFile(null);
      setPreviewUrl(null);
      setErrorMessage(
        e instanceof Error ? e.message : 'Não foi possível abrir a visualização.',
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  };

  return (
    <ProtectedRoute>
      <AdminRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
          <PainelHeader />
          <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#004085] dark:text-blue-400 mb-2 px-4 sm:px-0">
                Drive
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base px-4 sm:px-0">
                Armazene contratos, termos e outros documentos.
              </p>
            </div>

            {!supabaseReady && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                Defina{' '}
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> e{' '}
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> no ambiente
                (use a chave anon JWT do projeto) e execute o SQL em{' '}
                <span className="font-mono">yarn db:push</span> (com{' '}
                <span className="font-mono">SUPABASE_DB_URL</span> no .env.local) ou rode a migration em{' '}
                <span className="font-mono">supabase/migrations/</span> no SQL Editor do Supabase.
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                {errorMessage}
              </div>
            )}

            <div
              id="drive-upload-section"
              className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 transition-colors"
            >
              <h2 className="text-lg sm:text-xl font-bold text-[#004085] dark:text-blue-400 mb-4">
                Enviar arquivo
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) =>
                      setUploadCategory(e.target.value as DriveCategory)
                    }
                    disabled={!supabaseReady}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                  >
                    {(Object.keys(CATEGORY_LABELS) as DriveCategory[]).map((key) => (
                      <option key={key} value={key}>
                        {CATEGORY_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Arquivo
                  </label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] ?? null)
                    }
                    disabled={!supabaseReady}
                    className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#004085] file:text-white hover:file:bg-[#0056B3] dark:file:bg-blue-600 dark:hover:file:bg-blue-700 disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={!supabaseReady || !selectedFile || uploading}
                  className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Enviando…
                    </span>
                  ) : (
                    'Enviar'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden transition-colors">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-bold text-[#004085] dark:text-blue-400">
                  Arquivos ({filteredFiles.length})
                </h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    Filtrar
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) =>
                      setFilterCategory(e.target.value as DriveCategory | 'todos')
                    }
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="todos">Todos</option>
                    {(Object.keys(CATEGORY_LABELS) as DriveCategory[]).map((key) => (
                      <option key={key} value={key}>
                        {CATEGORY_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#004085] dark:border-blue-400" />
                  <p className="mt-2 text-gray-600 dark:text-gray-300">Carregando…</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Enviado em
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Tamanho
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredFiles.map((row) => (
                        <tr
                          key={row.fullPath}
                          className="hover:bg-gray-50 dark:hover:bg-slate-700/50"
                        >
                          <td className="px-4 sm:px-6 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[200px] sm:max-w-md truncate">
                            <button
                              type="button"
                              onClick={() => void handlePreview(row)}
                              disabled={!supabaseReady}
                              className="text-left max-w-[200px] sm:max-w-md truncate text-[#004085] dark:text-blue-400 hover:underline disabled:opacity-50"
                            >
                              {internNameByPath[row.fullPath] ?? row.displayName}
                            </button>
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {CATEGORY_LABELS[row.category]}
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleString('pt-BR')
                              : '—'}
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatBytes(row.size)}
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-sm whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void handleDownload(row.fullPath)}
                              disabled={!supabaseReady || actionPath === row.fullPath}
                              className="text-[#004085] dark:text-blue-400 hover:underline mr-3 disabled:opacity-50"
                            >
                              Baixar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row.fullPath)}
                              disabled={!supabaseReady || actionPath === row.fullPath}
                              className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredFiles.length === 0 && (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                      Nenhum arquivo nesta lista.
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
        {previewFile && (
          <div className="fixed inset-0 bg-[#00408580] dark:bg-slate-900/80 flex items-center justify-center z-50 px-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden transition-colors">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-[#004085] dark:text-blue-400 truncate">
                    {previewFile.displayName}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {CATEGORY_LABELS[previewFile.category]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePreview}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-4"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 sm:p-6 h-[70vh] overflow-auto">
                {previewLoading && (
                  <div className="h-full flex items-center justify-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-[#004085] dark:border-blue-400" />
                  </div>
                )}
                {!previewLoading &&
                  previewUrl &&
                  (getPreviewType(previewFile) === 'pdf' ||
                    getPreviewType(previewFile) === 'docx') && (
                    <iframe
                      src={drivePreviewIframeUrl(previewFile, previewUrl)}
                      title={previewFile.displayName}
                      className="w-full h-full min-h-[60vh] rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                  )}
                {!previewLoading && previewUrl && getPreviewType(previewFile) === 'image' && (
                  <div className="relative h-full w-full min-h-[40vh] flex items-center justify-center">
                    <Image
                      src={previewUrl}
                      alt={previewFile.displayName}
                      fill
                      unoptimized
                      className="object-contain rounded-lg border border-gray-200 dark:border-gray-700"
                    />
                  </div>
                )}
                {!previewLoading && previewUrl && getPreviewType(previewFile) === 'other' && (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-gray-700 dark:text-gray-200 mb-3">
                      Este formato não possui preview embutido.
                    </p>
                    <button
                      type="button"
                      onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                      className="px-4 py-2 bg-[#004085] dark:bg-blue-600 text-white rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 transition-colors"
                    >
                      Abrir arquivo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AdminRoute>
    </ProtectedRoute>
  );
}
