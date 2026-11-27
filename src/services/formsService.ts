import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DynamicForm, FormField, FormResponse } from '../types/firebase';

const FORMS_COLLECTION = 'forms';
const RESPONSES_COLLECTION = 'formResponses';
const ESCRITORIOS_SLUG = 'escritorios';

const parseDate = (value: unknown): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
};

const mapForm = (id: string, data: Record<string, unknown>): DynamicForm => ({
  id,
  title: String(data.title ?? ''),
  slug: String(data.slug ?? ''),
  description: data.description ? String(data.description) : undefined,
  isActive: Boolean(data.isActive),
  fields: Array.isArray(data.fields) ? (data.fields as FormField[]) : [],
  createdAt: parseDate(data.createdAt),
  updatedAt: parseDate(data.updatedAt),
});

const mapResponse = (id: string, data: Record<string, unknown>): FormResponse => ({
  id,
  formId: String(data.formId ?? ''),
  formSlug: String(data.formSlug ?? ''),
  answers:
    data.answers && typeof data.answers === 'object'
      ? (data.answers as Record<string, string>)
      : {},
  createdAt: parseDate(data.createdAt),
});

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const createEscritoriosFields = (): FormField[] => [
  {
    id: 'field-company',
    label: 'Nome da empresa',
    name: 'company',
    type: 'text',
    required: true,
    placeholder: 'Como sua empresa se chama?',
    order: 0,
  },
  {
    id: 'field-contact',
    label: 'WhatsApp ou e-mail',
    name: 'contact',
    type: 'text',
    required: true,
    placeholder: 'Para retornarmos o contato',
    order: 1,
  },
  {
    id: 'field-position',
    label: 'Perfil da vaga',
    name: 'position',
    type: 'text',
    required: true,
    placeholder: 'Ex.: auxiliar administrativo',
    order: 2,
  },
  {
    id: 'field-city',
    label: 'Cidade',
    name: 'city',
    type: 'text',
    required: true,
    placeholder: 'Ex.: Brasília',
    order: 3,
  },
];

export const formsService = {
  slugify,

  getPublicUrl(slug: string, origin?: string): string {
    const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
    if (slug === ESCRITORIOS_SLUG) {
      return `${base}/escritorios`;
    }
    return `${base}/f/${slug}`;
  },

  async getAll(): Promise<DynamicForm[]> {
    const snapshot = await getDocs(collection(db, FORMS_COLLECTION));
    return snapshot.docs
      .map((item) => mapForm(item.id, item.data() as Record<string, unknown>))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getById(id: string): Promise<DynamicForm | null> {
    const snapshot = await getDoc(doc(db, FORMS_COLLECTION, id));
    if (!snapshot.exists()) return null;
    return mapForm(snapshot.id, snapshot.data() as Record<string, unknown>);
  },

  async getBySlug(slug: string): Promise<DynamicForm | null> {
    const q = query(collection(db, FORMS_COLLECTION), where('slug', '==', slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const item = snapshot.docs[0];
    return mapForm(item.id, item.data() as Record<string, unknown>);
  },

  async create(
    payload: Omit<DynamicForm, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, FORMS_COLLECTION), {
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  },

  async update(
    id: string,
    payload: Partial<Omit<DynamicForm, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(db, FORMS_COLLECTION, id), {
      ...payload,
      updatedAt: Timestamp.now(),
    });
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, FORMS_COLLECTION, id));
  },

  async listResponses(formId: string): Promise<FormResponse[]> {
    const q = query(
      collection(db, RESPONSES_COLLECTION),
      where('formId', '==', formId),
      orderBy('createdAt', 'desc')
    );
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map((item) =>
        mapResponse(item.id, item.data() as Record<string, unknown>)
      );
    } catch {
      const fallback = query(
        collection(db, RESPONSES_COLLECTION),
        where('formId', '==', formId)
      );
      const snapshot = await getDocs(fallback);
      return snapshot.docs
        .map((item) => mapResponse(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  },

  async countResponses(formId: string): Promise<number> {
    const responses = await this.listResponses(formId);
    return responses.length;
  },

  async submitResponse(
    form: DynamicForm,
    answers: Record<string, string>
  ): Promise<string> {
    if (!form.id) {
      throw new Error('Formulário sem id');
    }
    const sanitized: Record<string, string> = {};
    Object.entries(answers).forEach(([key, value]) => {
      if (typeof value !== 'string') return;
      const name = key.trim().slice(0, 80);
      if (!name) return;
      sanitized[name] = value.trim().slice(0, 2000);
    });
    const docRef = await addDoc(collection(db, RESPONSES_COLLECTION), {
      formId: form.id,
      formSlug: form.slug,
      answers: sanitized,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async ensureEscritoriosForm(): Promise<DynamicForm> {
    const existing = await this.getBySlug(ESCRITORIOS_SLUG);
    if (existing) return existing;

    const payload: Omit<DynamicForm, 'id' | 'createdAt' | 'updatedAt'> = {
      title: 'Escritórios — Solicite atendimento',
      slug: ESCRITORIOS_SLUG,
      description: 'Formulário da landing /escritorios',
      isActive: true,
      fields: createEscritoriosFields(),
    };
    const now = Timestamp.now();
    const ref = doc(db, FORMS_COLLECTION, ESCRITORIOS_SLUG);
    await setDoc(ref, {
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
    return {
      id: ESCRITORIOS_SLUG,
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};
