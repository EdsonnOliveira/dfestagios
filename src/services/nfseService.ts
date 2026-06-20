import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NfseEmission, NfseStatus } from '../types/fisqal';

function mapEmission(
  id: string,
  data: Record<string, unknown>
): NfseEmission {
  const toDate = (value: unknown): Date => {
    if (
      value &&
      typeof value === 'object' &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate();
    }
    return new Date();
  };
  return {
    id,
    clienteId: String(data.clienteId ?? ''),
    dpsId: String(data.dpsId ?? ''),
    status: String(data.status ?? 'pending') as NfseStatus,
    numeroDps: String(data.numeroDps ?? ''),
    serieDps: String(data.serieDps ?? ''),
    dataCompetencia: String(data.dataCompetencia ?? ''),
    valorServico: Number(data.valorServico ?? 0),
    chaveAcesso: data.chaveAcesso ? String(data.chaveAcesso) : undefined,
    discriminacao: data.discriminacao ? String(data.discriminacao) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export const nfseService = {
  async getByCliente(clienteId: string): Promise<NfseEmission[]> {
    const q = query(
      collection(db, 'nfseEmissions'),
      where('clienteId', '==', clienteId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) =>
      mapEmission(d.id, d.data() as Record<string, unknown>)
    );
    return list.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },

  async create(
    data: Omit<NfseEmission, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, 'nfseEmissions'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async updateStatus(
    id: string,
    status: NfseStatus,
    chaveAcesso?: string
  ): Promise<void> {
    const ref = doc(db, 'nfseEmissions', id);
    await updateDoc(ref, {
      status,
      ...(chaveAcesso ? { chaveAcesso } : {}),
      updatedAt: Timestamp.now(),
    });
  },

  async updateByDpsId(
    dpsId: string,
    status: NfseStatus,
    chaveAcesso?: string
  ): Promise<void> {
    const q = query(
      collection(db, 'nfseEmissions'),
      where('dpsId', '==', dpsId)
    );
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(d.ref, {
          status,
          ...(chaveAcesso ? { chaveAcesso } : {}),
          updatedAt: Timestamp.now(),
        })
      )
    );
  },
};
