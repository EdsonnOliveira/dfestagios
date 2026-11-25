import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, deleteUser, setPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { studentAuthEmail } from '../lib/studentAuth';
import type { Estagiario } from '../types/firebase';

type StudentProfile = Omit<Estagiario, 'id' | 'createdAt' | 'updatedAt' | 'authUid' | 'curriculoStoragePath' | 'curriculoNome'>;

export async function registerStudent(profile: StudentProfile, password: string, resume: File | null): Promise<void> {
  const email = await studentAuthEmail(profile.cpf ?? '');
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  const extension = resume?.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
  const storagePath = resume ? `curriculos/${uid}/curriculo.${extension}` : null;
  const fileRef = storagePath ? ref(storage, storagePath) : null;
  let uploaded = false;

  try {
    if (resume && fileRef) {
      await uploadBytes(fileRef, resume, { contentType: resume.type || (extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') });
      uploaded = true;
    }
    const now = new Date();
    await setDoc(doc(db, 'estagiarios', uid), {
      ...profile,
      authUid: uid,
      ...(storagePath && resume ? { curriculoStoragePath: storagePath, curriculoNome: resume.name } : {}),
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (uploaded && fileRef) await deleteObject(fileRef).catch(() => undefined);
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }
}

export async function signInStudent(cpf: string, password: string, remember = false): Promise<void> {
  const email = await studentAuthEmail(cpf);
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  await signInWithEmailAndPassword(auth, email, password);
}

export type StudentProfileUpdate = {
  nome: string;
  email: string;
  telefone1: string;
  cep?: string;
  endereco: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  grauInstrucao: string;
  curso?: string;
};

export async function updateStudentProfile(
  uid: string,
  data: StudentProfileUpdate,
  resume: File | null
): Promise<{ curriculoStoragePath?: string; curriculoNome?: string }> {
  const payload: Partial<Estagiario> = {
    nome: data.nome.trim(),
    email: data.email.trim(),
    telefone1: data.telefone1.replace(/\D/g, ''),
    cep: data.cep?.replace(/\D/g, '') || '',
    endereco: data.endereco.trim(),
    complemento: data.complemento?.trim() || '',
    bairro: data.bairro.trim(),
    cidade: data.cidade.trim(),
    uf: data.uf.trim().toUpperCase(),
    grauInstrucao: data.grauInstrucao.trim(),
    curso: data.curso?.trim() || '',
  };

  if (resume) {
    const extension = resume.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
    const storagePath = `curriculos/${uid}/curriculo.${extension}`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, resume, {
      contentType:
        resume.type ||
        (extension === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    });
    payload.curriculoStoragePath = storagePath;
    payload.curriculoNome = resume.name;
  }

  await updateDoc(doc(db, 'estagiarios', uid), {
    ...payload,
    updatedAt: new Date(),
  });

  return {
    curriculoStoragePath: payload.curriculoStoragePath,
    curriculoNome: payload.curriculoNome,
  };
}
