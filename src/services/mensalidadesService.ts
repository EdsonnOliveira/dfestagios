/* eslint-disable @typescript-eslint/no-explicit-any */
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, getDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Mensalidade {
  id: string;
  clienteId: string;
  clienteNome: string;
  dataVencimento: Date;
  valor: number;
  status: 'pago' | 'vencido' | 'aberto';
  dataPagamento?: Date;
  observacoes?: string;
  multaPercentual?: number; // percentual de multa aplicado (ex.: 10 para 10%)
  numeroParcela?: number; // número da parcela (ex.: 1, 2, 3...)
  totalParcelas?: number; // total de parcelas do plano
  createdAt: Date;
  updatedAt: Date;
}

export const mensalidadesService = {
  // Criar nova mensalidade
  async create(mensalidade: Omit<Mensalidade, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'mensalidades'), {
        ...mensalidade,
        dataVencimento: Timestamp.fromDate(mensalidade.dataVencimento),
        dataPagamento: mensalidade.dataPagamento ? Timestamp.fromDate(mensalidade.dataPagamento) : null,
        multaPercentual: mensalidade.multaPercentual ?? null,
        numeroParcela: mensalidade.numeroParcela ?? null,
        totalParcelas: mensalidade.totalParcelas ?? null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar mensalidade:', error);
      throw error;
    }
  },

  // Buscar todas as mensalidades
  async getAll(): Promise<Mensalidade[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'mensalidades'));
      
      const mensalidades = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clienteId: data.clienteId,
          clienteNome: data.clienteNome,
          dataVencimento: data.dataVencimento.toDate(),
          valor: data.valor,
          status: data.status,
          dataPagamento: data.dataPagamento ? data.dataPagamento.toDate() : undefined,
          observacoes: data.observacoes,
          multaPercentual: data.multaPercentual ?? undefined,
          numeroParcela: data.numeroParcela ?? undefined,
          totalParcelas: data.totalParcelas ?? undefined,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        };
      });

      // Ordenar localmente por data de vencimento
      return mensalidades.sort((a, b) => {
        const dateA = a.dataVencimento instanceof Date ? a.dataVencimento : 
                     (typeof a.dataVencimento === 'string' ? new Date(a.dataVencimento) :  (a.dataVencimento as any).toDate());
        const dateB = b.dataVencimento instanceof Date ? b.dataVencimento : 
                     (typeof b.dataVencimento === 'string' ? new Date(b.dataVencimento) :  (b.dataVencimento as any).toDate());
        return dateA.getTime() - dateB.getTime();
      });
    } catch (error) {
      console.error('Erro ao buscar mensalidades:', error);
      throw error;
    }
  },

  // Buscar mensalidades por cliente
  async getByCliente(clienteId: string): Promise<Mensalidade[]> {
    try {
      const q = query(
        collection(db, 'mensalidades'),
        where('clienteId', '==', clienteId)
      );
      
      const querySnapshot = await getDocs(q);
      
      const mensalidades = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clienteId: data.clienteId,
          clienteNome: data.clienteNome,
          dataVencimento: data.dataVencimento.toDate(),
          valor: data.valor,
          status: data.status,
          dataPagamento: data.dataPagamento ? data.dataPagamento.toDate() : undefined,
          observacoes: data.observacoes,
          multaPercentual: data.multaPercentual ?? undefined,
          numeroParcela: data.numeroParcela ?? undefined,
          totalParcelas: data.totalParcelas ?? undefined,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        };
      });

      // Ordenar localmente por data de vencimento
      return mensalidades.sort((a, b) => {
        const dateA = a.dataVencimento instanceof Date ? a.dataVencimento : 
                     (typeof a.dataVencimento === 'string' ? new Date(a.dataVencimento) :  (a.dataVencimento as any).toDate());
        const dateB = b.dataVencimento instanceof Date ? b.dataVencimento : 
                     (typeof b.dataVencimento === 'string' ? new Date(b.dataVencimento) :  (b.dataVencimento as any).toDate());
        return dateA.getTime() - dateB.getTime();
      });
    } catch (error) {
      console.error('Erro ao buscar mensalidades do cliente:', error);
      throw error;
    }
  },

  // Buscar mensalidades por status
  async getByStatus(status: 'pago' | 'vencido' | 'aberto'): Promise<Mensalidade[]> {
    try {
      const q = query(
        collection(db, 'mensalidades'),
        where('status', '==', status)
      );
      
      const querySnapshot = await getDocs(q);
      
      const mensalidades = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          clienteId: data.clienteId,
          clienteNome: data.clienteNome,
          dataVencimento: data.dataVencimento.toDate(),
          valor: data.valor,
          status: data.status,
          dataPagamento: data.dataPagamento ? data.dataPagamento.toDate() : undefined,
          observacoes: data.observacoes,
          multaPercentual: data.multaPercentual ?? undefined,
          numeroParcela: data.numeroParcela ?? undefined,
          totalParcelas: data.totalParcelas ?? undefined,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        };
      });

      // Ordenar localmente por data de vencimento
      return mensalidades.sort((a, b) => {
        const dateA = a.dataVencimento instanceof Date ? a.dataVencimento : 
                     (typeof a.dataVencimento === 'string' ? new Date(a.dataVencimento) :  (a.dataVencimento as any).toDate());
        const dateB = b.dataVencimento instanceof Date ? b.dataVencimento : 
                     (typeof b.dataVencimento === 'string' ? new Date(b.dataVencimento) :  (b.dataVencimento as any).toDate());
        return dateA.getTime() - dateB.getTime();
      });
    } catch (error) {
      console.error('Erro ao buscar mensalidades por status:', error);
      throw error;
    }
  },

  // Atualizar mensalidade
  async update(id: string, updates: Partial<Mensalidade>): Promise<void> {
    try {
      const mensalidadeRef = doc(db, 'mensalidades', id);
      const updateData: Partial<Mensalidade> = {
        ...updates,
        updatedAt: Timestamp.now() as any,
      };

      // Converter datas para Timestamp se necessário
      if (updates.dataVencimento) {
        updateData.dataVencimento = Timestamp.fromDate(updates.dataVencimento) as any;
      }
      if (updates.dataPagamento) {
        updateData.dataPagamento = Timestamp.fromDate(updates.dataPagamento) as any;
      }

      await updateDoc(mensalidadeRef, updateData);
    } catch (error) {
      console.error('Erro ao atualizar mensalidade:', error);
      throw error;
    }
  },

  // Marcar como pago
  async marcarComoPago(id: string, dataPagamento?: Date): Promise<void> {
    try {
      const mensalidadeRef = doc(db, 'mensalidades', id);
      await updateDoc(mensalidadeRef, {
        status: 'pago',
        dataPagamento: dataPagamento ? Timestamp.fromDate(dataPagamento) : Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erro ao marcar mensalidade como paga:', error);
      throw error;
    }
  },

  // Marcar como não pago
  async marcarComoNaoPago(id: string): Promise<void> {
    try {
      const mensalidadeRef = doc(db, 'mensalidades', id);
      const snap = await getDoc(mensalidadeRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const dataVencimento: Date = data.dataVencimento?.toDate ? data.dataVencimento.toDate() : new Date(data.dataVencimento);

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const venc = new Date(dataVencimento);
      venc.setHours(0, 0, 0, 0);

      const novoStatus: 'vencido' | 'aberto' = venc < hoje ? 'vencido' : 'aberto';

      await updateDoc(mensalidadeRef, {
        status: novoStatus,
        dataPagamento: null,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erro ao marcar mensalidade como não pago:', error);
      throw error;
    }
  },

  // Deletar mensalidade
  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'mensalidades', id));
    } catch (error) {
      console.error('Erro ao deletar mensalidade:', error);
      throw error;
    }
  },

  // Gerar mensalidades para um cliente (útil para criar mensalidades futuras)
  async gerarMensalidadesParaCliente(
    clienteId: string, 
    clienteNome: string, 
    valor: number, 
    dataVencimento: Date, 
    quantidadeMeses: number = 12
  ): Promise<void> {
    try {
      const mensalidades = [];
      
      for (let i = 0; i < quantidadeMeses; i++) {
        const dataMensalidade = new Date(dataVencimento);
        dataMensalidade.setMonth(dataMensalidade.getMonth() + i);
        
        mensalidades.push({
          clienteId,
          clienteNome,
          dataVencimento: dataMensalidade,
          valor,
          status: 'aberto' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Criar todas as mensalidades em lote
      const batch = [];
      for (const mensalidade of mensalidades) {
        const docRef = doc(collection(db, 'mensalidades'));
        batch.push({
          ref: docRef,
          data: {
            ...mensalidade,
            dataVencimento: Timestamp.fromDate(mensalidade.dataVencimento),
            createdAt: Timestamp.fromDate(mensalidade.createdAt),
            updatedAt: Timestamp.fromDate(mensalidade.updatedAt),
          }
        });
      }

      // Executar batch
      for (const item of batch) {
        await addDoc(collection(db, 'mensalidades'), item.data);
      }
    } catch (error) {
      console.error('Erro ao gerar mensalidades para cliente:', error);
      throw error;
    }
  }
};
