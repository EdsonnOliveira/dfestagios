import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { Estagiario, EstagiarioWithCompanyEntry, Grupo, Cliente } from '../types/firebase';

function parseFirestoreDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}
import { mensalidadesService } from './mensalidadesService';

export const estagiariosService = {
  async add(estagiario: Omit<Estagiario, 'id' | 'createdAt' | 'updatedAt'>) {
    console.log('Tentando adicionar estagiário:', estagiario);
    const now = new Date();
    try {
      const docRef = await addDoc(collection(db, 'estagiarios'), {
        ...estagiario,
        createdAt: now,
        updatedAt: now
      });
      console.log('Estagiário adicionado com sucesso, ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao adicionar estagiário:', error);
      throw error;
    }
  },

  async getAll() {
    const querySnapshot = await getDocs(collection(db, 'estagiarios'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Estagiario[];
  },

  async getByFilters(filters: {
    nome?: string;
    cidade?: string;
    bairro?: string;
    curso?: string;
    escolaridade?: string;
  }) {
    const constraints = [];

    if (filters.nome) {
      constraints.push(where('nome', '>=', filters.nome));
      constraints.push(where('nome', '<=', filters.nome + '\uf8ff'));
    }

    if (filters.cidade) {
      constraints.push(where('cidade', '==', filters.cidade));
    }

    if (filters.curso) {
      constraints.push(where('grauInstrucao', '==', filters.curso));
    }

    if (filters.escolaridade) {
      constraints.push(where('grauInstrucao', '==', filters.escolaridade));
    }

    let q;
    if (constraints.length > 0) {
      q = query(collection(db, 'estagiarios'), ...constraints, orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'estagiarios'), orderBy('createdAt', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    let results = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Estagiario[];

    if (filters.bairro) {
      results = results.filter(estagiario =>
        estagiario.bairro?.toLowerCase().includes(filters.bairro!.toLowerCase())
      );
    }

    return results;
  },

  async update(id: string, data: Partial<Estagiario>) {
    const docRef = doc(db, 'estagiarios', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  },

  async getById(id: string): Promise<Estagiario | null> {
    const docRef = doc(db, 'estagiarios', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Estagiario;
  },

  async toggleStatus(id: string, currentStatus: 'ativo' | 'inativo', motivoInativacao?: string) {
    const docRef = doc(db, 'estagiarios', id);
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    const updateData: {
      status: 'ativo' | 'inativo';
      updatedAt: Date;
      motivoInativacao?: string;
    } = {
      status: newStatus,
      updatedAt: new Date()
    };
    
    if (newStatus === 'inativo' && motivoInativacao) {
      updateData.motivoInativacao = motivoInativacao;
    } else if (newStatus === 'ativo') {
      updateData.motivoInativacao = '';
    }
    
    await updateDoc(docRef, updateData);
    return newStatus;
  },

  async delete(id: string) {
    const docRef = doc(db, 'estagiarios', id);
    await deleteDoc(docRef);
  }
};

export const authService = {
  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  },

  async signOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  },

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser() {
    return auth.currentUser;
  }
};

export const gruposService = {
  async getAll() {
    const querySnapshot = await getDocs(collection(db, 'grupos'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Grupo[];
  },

  async add(grupo: Omit<Grupo, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date();
    try {
      const docRef = await addDoc(collection(db, 'grupos'), {
        ...grupo,
        createdAt: now,
        updatedAt: now
      });
      return docRef.id;
    } catch (error) {
      console.error('Erro ao adicionar grupo:', error);
      throw error;
    }
  },

  async update(id: string, data: Partial<Grupo>) {
    const docRef = doc(db, 'grupos', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  },

  async delete(id: string) {
    const docRef = doc(db, 'grupos', id);
    await deleteDoc(docRef);
  }
};

export const clientesService = {
  async add(cliente: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt'>) {
    console.log('Tentando adicionar cliente:', cliente);
    const now = new Date();
    try {
      const docRef = await addDoc(collection(db, 'clientes'), {
        ...cliente,
        createdAt: now,
        updatedAt: now
      });
      console.log('Cliente adicionado com sucesso, ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      throw error;
    }
  },

  async getAll() {
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Cliente[];
  },

  async getById(id: string): Promise<Cliente | null> {
    const docRef = doc(db, 'clientes', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Cliente;
  },

  async getByFilters(filters: {
    razaoSocial?: string;
    nomeFantasia?: string;
    cidade?: string;
    bairro?: string;
    status?: string;
  }) {
    const constraints = [];

    if (filters.razaoSocial) {
      constraints.push(where('razaoSocial', '>=', filters.razaoSocial));
      constraints.push(where('razaoSocial', '<=', filters.razaoSocial + '\uf8ff'));
    }

    if (filters.nomeFantasia) {
      constraints.push(where('nomeFantasia', '>=', filters.nomeFantasia));
      constraints.push(where('nomeFantasia', '<=', filters.nomeFantasia + '\uf8ff'));
    }

    if (filters.cidade) {
      constraints.push(where('cidade', '==', filters.cidade));
    }

    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }

    let q;
    if (constraints.length > 0) {
      q = query(collection(db, 'clientes'), ...constraints, orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'clientes'), orderBy('createdAt', 'desc'));
    }

    const querySnapshot = await getDocs(q);
    let results = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Cliente[];

    if (filters.bairro) {
      results = results.filter(cliente =>
        cliente.bairro?.toLowerCase().includes(filters.bairro!.toLowerCase())
      );
    }

    return results;
  },

  async update(id: string, data: Partial<Cliente>) {
    const docRef = doc(db, 'clientes', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  },

  async toggleStatus(id: string, currentStatus: 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo') {
    const docRef = doc(db, 'clientes', id);
    // Lógica de alternância: ativo -> em-andamento -> bloqueado -> inativo -> ativo
    const statusCycle: ('ativo' | 'em-andamento' | 'bloqueado' | 'inativo')[] = ['ativo', 'em-andamento', 'bloqueado', 'inativo'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const newStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: new Date()
    });

    // Se o cliente foi inativado ou bloqueado, excluir mensalidades abertas
    if (newStatus === 'inativo' || newStatus === 'bloqueado') {
      try {
        await mensalidadesService.deleteMensalidadesAbertasByCliente(id);
      } catch (error) {
        console.error('Erro ao excluir mensalidades abertas:', error);
        // Não falhar a operação principal se houver erro na exclusão das mensalidades
      }
    }

    return newStatus;
  },

  async updateStatus(id: string, newStatus: 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo', motivo?: string) {
    const docRef = doc(db, 'clientes', id);
    const updateData: { status: string; updatedAt: Date; motivoStatus?: string } = {
      status: newStatus,
      updatedAt: new Date()
    };

    if (motivo) {
      updateData.motivoStatus = motivo;
    }

    await updateDoc(docRef, updateData);

    // Se o cliente foi inativado ou bloqueado, excluir mensalidades abertas
    if (newStatus === 'inativo' || newStatus === 'bloqueado') {
      try {
        await mensalidadesService.deleteMensalidadesAbertasByCliente(id);
      } catch (error) {
        console.error('Erro ao excluir mensalidades abertas:', error);
        // Não falhar a operação principal se houver erro na exclusão das mensalidades
      }
    }

    return newStatus;
  },

  async delete(id: string) {
    const docRef = doc(db, 'clientes', id);
    
    // Excluir mensalidades abertas antes de excluir o cliente
    try {
      await mensalidadesService.deleteMensalidadesAbertasByCliente(id);
    } catch (error) {
      console.error('Erro ao excluir mensalidades abertas:', error);
      // Não falhar a operação principal se houver erro na exclusão das mensalidades
    }
    
    await deleteDoc(docRef);
  }
};

export const vinculacoesService = {
  async vincularEstagiario(clienteId: string, estagiarioId: string) {
    const now = new Date();
    try {
      const docRef = await addDoc(collection(db, 'vinculacoes'), {
        clienteId,
        estagiarioId,
        dataVinculacao: now,
        status: 'ativo',
        createdAt: now,
        updatedAt: now
      });
      
      // Atualizar o cliente para incluir o estagiário na lista
      const clienteRef = doc(db, 'clientes', clienteId);
      const cliente = await getDoc(clienteRef);
      if (cliente.exists()) {
        const clienteData = cliente.data() as Cliente;
        const estagiariosVinculados = clienteData.estagiariosVinculados || [];
        if (!estagiariosVinculados.includes(estagiarioId)) {
          estagiariosVinculados.push(estagiarioId);
          await updateDoc(clienteRef, {
            estagiariosVinculados,
            updatedAt: now
          });
        }
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Erro ao vincular estagiário:', error);
      throw error;
    }
  },

  async desvincularEstagiario(clienteId: string, estagiarioId: string) {
    try {
      // Buscar a vinculação ativa
      const q = query(
        collection(db, 'vinculacoes'),
        where('clienteId', '==', clienteId),
        where('estagiarioId', '==', estagiarioId),
        where('status', '==', 'ativo')
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const vinculacaoDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'vinculacoes', vinculacaoDoc.id), {
          status: 'inativo',
          updatedAt: new Date()
        });
      }
      
      // Atualizar o cliente para remover o estagiário da lista
      const clienteRef = doc(db, 'clientes', clienteId);
      const cliente = await getDoc(clienteRef);
      if (cliente.exists()) {
        const clienteData = cliente.data() as Cliente;
        const estagiariosVinculados = (clienteData.estagiariosVinculados || []).filter(id => id !== estagiarioId);
        await updateDoc(clienteRef, {
          estagiariosVinculados,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Erro ao desvincular estagiário:', error);
      throw error;
    }
  },

  async getEstagiariosVinculados(clienteId: string): Promise<EstagiarioWithCompanyEntry[]> {
    try {
      const q = query(
        collection(db, 'vinculacoes'),
        where('clienteId', '==', clienteId),
        where('status', '==', 'ativo')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return [];

      const estagiarios = await estagiariosService.getAll();
      const byId = new Map(estagiarios.map((e) => [e.id!, e]));

      const result: EstagiarioWithCompanyEntry[] = [];
      for (const docSnap of querySnapshot.docs) {
        const row = docSnap.data();
        const estId = row.estagiarioId as string;
        const est = byId.get(estId);
        if (est) {
          result.push({
            ...est,
            companyEntryDate: parseFirestoreDate(row.dataVinculacao)
          });
        }
      }
      return result;
    } catch (error) {
      console.error('Erro ao buscar estagiários vinculados:', error);
      throw error;
    }
  },

  async getClientesDoEstagiario(estagiarioId: string) {
    try {
      const q = query(
        collection(db, 'vinculacoes'),
        where('estagiarioId', '==', estagiarioId),
        where('status', '==', 'ativo')
      );
      const querySnapshot = await getDocs(q);
      
      const clienteIds = querySnapshot.docs.map(doc => doc.data().clienteId);
      
      if (clienteIds.length === 0) return [];
      
      // Buscar os dados dos clientes
      const clientes = await clientesService.getAll();
      return clientes.filter(cliente => clienteIds.includes(cliente.id!));
    } catch (error) {
      console.error('Erro ao buscar clientes do estagiário:', error);
      throw error;
    }
  }
};
