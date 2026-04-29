import { getSupabaseBrowserClient } from '../lib/supabaseClient';

export const DRIVE_BUCKET = 'painel-drive';

const NAME_MARKER = '###';

export type DriveCategory = 'contrato' | 'termo' | 'outro';

export interface DriveFileRow {
  storageName: string;
  fullPath: string;
  category: DriveCategory;
  displayName: string;
  createdAt: string | null;
  size: number | null;
  mimeType: string | null;
}

function getClient() {
  const c = getSupabaseBrowserClient();
  if (!c) {
    throw new Error('SUPABASE_CONFIG_MISSING');
  }
  return c;
}

function buildStorageName(originalSafeName: string): string {
  return `${crypto.randomUUID()}${NAME_MARKER}${originalSafeName}`;
}

export function displayNameFromStorageName(storageName: string): string {
  const i = storageName.indexOf(NAME_MARKER);
  if (i === -1) return storageName;
  return storageName.slice(i + NAME_MARKER.length);
}

function sanitizeOriginalFileName(name: string): string {
  return name.replace(/[^\w.\-()+ ]/g, '_').trim() || 'arquivo';
}

function fileSizeFromMetadata(metadata: Record<string, unknown> | undefined): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata.size;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fileMimeTypeFromMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const candidates = [metadata.mimetype, metadata.contentType];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  }
  return null;
}

export const driveStorageService = {
  async upload(category: DriveCategory, file: File): Promise<string> {
    const supabase = getClient();
    const safe = sanitizeOriginalFileName(file.name);
    const storageName = buildStorageName(safe);
    const path = `${category}/${storageName}`;
    const { error } = await supabase.storage.from(DRIVE_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    return path;
  },

  async listAll(): Promise<DriveFileRow[]> {
    const supabase = getClient();
    const categories: DriveCategory[] = ['contrato', 'termo', 'outro'];
    const rows: DriveFileRow[] = [];
    for (const cat of categories) {
      const { data, error } = await supabase.storage.from(DRIVE_BUCKET).list(cat, {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      for (const obj of data ?? []) {
        if (!obj.name) continue;
        rows.push({
          storageName: obj.name,
          fullPath: `${cat}/${obj.name}`,
          category: cat,
          displayName: displayNameFromStorageName(obj.name),
          createdAt: obj.created_at ?? null,
          size: fileSizeFromMetadata(obj.metadata as Record<string, unknown> | undefined),
          mimeType: fileMimeTypeFromMetadata(
            obj.metadata as Record<string, unknown> | undefined,
          ),
        });
      }
    }
    rows.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return rows;
  },

  async getSignedDownloadUrl(fullPath: string): Promise<string> {
    const supabase = getClient();
    const { data, error } = await supabase.storage
      .from(DRIVE_BUCKET)
      .createSignedUrl(fullPath, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async remove(fullPath: string): Promise<void> {
    const supabase = getClient();
    const { error } = await supabase.storage.from(DRIVE_BUCKET).remove([fullPath]);
    if (error) throw error;
  },
};
