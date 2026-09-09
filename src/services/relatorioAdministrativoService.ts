import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTodayIsoDate } from '../lib/relatorioAdministrativo';
import type { RelatorioAdministrativoEvento } from '../types/firebase';

function parseFirestoreDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function mapEvento(
  id: string,
  data: Record<string, unknown>
): RelatorioAdministrativoEvento {
  return {
    id,
    tipo: data.tipo as RelatorioAdministrativoEvento['tipo'],
    dataRegistro: String(data.dataRegistro ?? ''),
    clienteId: String(data.clienteId ?? ''),
    clienteNome: String(data.clienteNome ?? ''),
    estagiarioId: String(data.estagiarioId ?? ''),
    estagiarioNome: String(data.estagiarioNome ?? ''),
    dataReferencia: String(data.dataReferencia ?? ''),
    haveraReposicao:
      data.haveraReposicao === true
        ? true
        : data.haveraReposicao === false
          ? false
          : null,
    createdAt: parseFirestoreDate(data.createdAt),
    updatedAt: parseFirestoreDate(data.updatedAt),
  };
}

async function getEventosByDataRegistroRaw(
  dataRegistro: string
): Promise<RelatorioAdministrativoEvento[]> {
  const q = query(
    collection(db, 'relatorioAdministrativoEventos'),
    where('dataRegistro', '==', dataRegistro)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => mapEvento(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

async function findEventoDuplicado(
  dataRegistro: string,
  tipo: RelatorioAdministrativoEvento['tipo'],
  clienteId: string,
  estagiarioId: string
): Promise<RelatorioAdministrativoEvento | null> {
  const eventos = await getEventosByDataRegistroRaw(dataRegistro);
  return (
    eventos.find(
      (item) =>
        item.tipo === tipo &&
        item.clienteId === clienteId &&
        item.estagiarioId === estagiarioId
    ) ?? null
  );
}

export const relatorioAdministrativoService = {
  async logContrato(params: {
    clienteId: string;
    clienteNome: string;
    estagiarioId: string;
    estagiarioNome: string;
    dataInicio: string;
    dataRegistro?: string;
  }): Promise<RelatorioAdministrativoEvento | null> {
    const dataRegistro = params.dataRegistro ?? getTodayIsoDate();
    const duplicado = await findEventoDuplicado(
      dataRegistro,
      'contrato',
      params.clienteId,
      params.estagiarioId
    );
    if (duplicado) return duplicado;

    const now = new Date();
    const payload = {
      tipo: 'contrato' as const,
      dataRegistro,
      clienteId: params.clienteId,
      clienteNome: params.clienteNome.trim(),
      estagiarioId: params.estagiarioId,
      estagiarioNome: params.estagiarioNome.trim(),
      dataReferencia: params.dataInicio.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(collection(db, 'relatorioAdministrativoEventos'), payload);
    return { id: docRef.id, ...payload };
  },

  async logRescisao(params: {
    clienteId: string;
    clienteNome: string;
    estagiarioId: string;
    estagiarioNome: string;
    dataSaida: string;
    haveraReposicao?: boolean | null;
    dataRegistro?: string;
  }): Promise<RelatorioAdministrativoEvento | null> {
    const dataRegistro = params.dataRegistro ?? getTodayIsoDate();
    const duplicado = await findEventoDuplicado(
      dataRegistro,
      'rescisao',
      params.clienteId,
      params.estagiarioId
    );
    if (duplicado) {
      if (
        params.haveraReposicao !== undefined &&
        params.haveraReposicao !== null &&
        duplicado.haveraReposicao !== params.haveraReposicao
      ) {
        await updateDoc(doc(db, 'relatorioAdministrativoEventos', duplicado.id!), {
          haveraReposicao: params.haveraReposicao,
          updatedAt: new Date(),
        });
        return {
          ...duplicado,
          haveraReposicao: params.haveraReposicao,
          updatedAt: new Date(),
        };
      }
      return duplicado;
    }

    const now = new Date();
    const payload = {
      tipo: 'rescisao' as const,
      dataRegistro,
      clienteId: params.clienteId,
      clienteNome: params.clienteNome.trim(),
      estagiarioId: params.estagiarioId,
      estagiarioNome: params.estagiarioNome.trim(),
      dataReferencia: params.dataSaida.trim(),
      haveraReposicao: params.haveraReposicao ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(collection(db, 'relatorioAdministrativoEventos'), payload);
    return { id: docRef.id, ...payload };
  },

  async updateRescisaoReposicao(params: {
    clienteId: string;
    clienteNome: string;
    estagiarioId: string;
    estagiarioNome: string;
    haveraReposicao: boolean;
    dataSaida?: string;
    dataRegistro?: string;
  }): Promise<void> {
    const dataRegistro = params.dataRegistro ?? getTodayIsoDate();
    const eventos = await this.getByDataRegistro(dataRegistro);
    const match = eventos
      .filter(
        (item) =>
          item.tipo === 'rescisao' &&
          item.clienteId === params.clienteId &&
          item.estagiarioId === params.estagiarioId
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (match?.id) {
      await updateDoc(doc(db, 'relatorioAdministrativoEventos', match.id), {
        haveraReposicao: params.haveraReposicao,
        updatedAt: new Date(),
      });
      return;
    }

    await this.logRescisao({
      clienteId: params.clienteId,
      clienteNome: params.clienteNome,
      estagiarioId: params.estagiarioId,
      estagiarioNome: params.estagiarioNome,
      dataSaida: params.dataSaida ?? dataRegistro,
      haveraReposicao: params.haveraReposicao,
      dataRegistro,
    });
  },

  async getByDataRegistro(dataRegistro: string): Promise<RelatorioAdministrativoEvento[]> {
    return getEventosByDataRegistroRaw(dataRegistro);
  },

  async getHistoricoDatas(limit = 90): Promise<string[]> {
    const q = query(
      collection(db, 'relatorioAdministrativoEventos'),
      orderBy('dataRegistro', 'desc')
    );
    const snapshot = await getDocs(q);
    const dates = new Set<string>();
    for (const item of snapshot.docs) {
      const data = item.data() as Record<string, unknown>;
      const date = String(data.dataRegistro ?? '');
      if (date) dates.add(date);
      if (dates.size >= limit) break;
    }
    return Array.from(dates);
  },
};
