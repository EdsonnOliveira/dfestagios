import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, deleteUser, setPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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
