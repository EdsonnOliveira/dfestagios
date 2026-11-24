import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import PublicIcon from '../components/PublicIcon';
import { fetchCepLookup } from '../services/viaCepService';
import { registerStudent } from '../services/studentRegistrationService';
import { normalizeCpf } from '../lib/studentAuth';
import styles from '../styles/StudentRegistration.module.css';

type EducationLevel = '' | 'fundamental' | 'medio' | 'superior' | 'tecnico' | 'eja' | 'nao_estudando';
type Step = 1 | 2 | 3;

const initialForm = {
  nome: '', cpf: '', dataNascimento: '', telefone1: '', email: '',
  cep: '', endereco: '', complemento: '', bairro: '', cidade: '', uf: '',
  grauInstrucao: '' as EducationLevel, anoEscolar: '', curso: '', periodoCurso: '', outrosCursos: '',
};

function validCpf(input: string): boolean {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length <= 10; length++) {
    const sum = Array.from({ length }, (_, index) => Number(cpf[index]) * (length + 1 - index)).reduce((a, b) => a + b, 0);
    if ((sum * 10) % 11 % 10 !== Number(cpf[length])) return false;
  }
  return true;
}

function maskCpf(value: string): string {
  const n = normalizeCpf(value).slice(0, 11);
  return n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function maskPhone(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n ? '(' + n : '';
  if (n.length <= 6) return '(' + n.slice(0, 2) + ') ' + n.slice(2);
  return '(' + n.slice(0, 2) + ') ' + n.slice(2, n.length === 11 ? 7 : 6) + '-' + n.slice(n.length === 11 ? 7 : 6);
}

function registrationError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'auth/email-already-in-use') return 'Este CPF já possui uma conta. Use Entrar para acessar.';
  if (code === 'auth/weak-password') return 'Escolha uma senha com pelo menos 6 caracteres.';
  if (code === 'storage/unauthorized') return 'Não foi possível enviar o currículo. Tente novamente mais tarde.';
  if (code === 'permission-denied') return 'Não foi possível salvar o cadastro. Tente novamente mais tarde.';
  return 'Não foi possível concluir o cadastro. Tente novamente.';
}

export default function Formulario() {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState<Step>(1);
  const [resume, setResume] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (field: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function lookupCep(): Promise<boolean> {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length !== 8) return false;
    setLookingUpCep(true);
    try {
      const address = await fetchCepLookup(digits);
      if (!address) {
        setError('CEP não encontrado. Confira o número informado.');
        return false;
      }
      setForm((current) => ({
        ...current,
        endereco: current.endereco || address.enderecoCompleto.split(' - ')[0],
        bairro: address.bairro, cidade: address.cidade, uf: address.uf,
      }));
      setError('');
      return true;
    } catch {
      setError('Não foi possível consultar o CEP agora. Tente novamente.');
      return false;
    } finally {
      setLookingUpCep(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step === 1) {
      if (!validCpf(form.cpf)) return setError('Informe um CPF válido.');
      if (form.telefone1.replace(/\D/g, '').length < 10) return setError('Informe um celular válido.');
      if ((!form.cidade || !form.uf) && !await lookupCep()) return setError('Informe um CEP válido e aguarde a consulta.');
      if (!form.endereco.trim()) return setError('Informe o endereço.');
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!form.grauInstrucao) return setError('Selecione o nível de escolaridade.');
      if (form.grauInstrucao === 'medio' && !form.anoEscolar) return setError('Selecione o ano do ensino médio.');
      if (['superior', 'tecnico'].includes(form.grauInstrucao) && (!form.curso.trim() || !form.periodoCurso)) return setError('Informe o curso e o período em que estuda.');
      setStep(3);
      return;
    }
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não coincidem.');
    setLoading(true);
    try {
      await registerStudent({
        nome: form.nome.trim(), cpf: maskCpf(form.cpf), dataNascimento: form.dataNascimento,
        telefone1: form.telefone1, email: form.email.trim().toLowerCase(),
        cep: form.cep, endereco: form.endereco.trim(), complemento: form.complemento.trim(),
        bairro: form.bairro, cidade: form.cidade, uf: form.uf,
        grauInstrucao: form.grauInstrucao,
        anoEscolar: form.grauInstrucao === 'medio' ? form.anoEscolar : '',
        curso: ['superior', 'tecnico'].includes(form.grauInstrucao) ? form.curso.trim() : '',
        periodoCurso: ['superior', 'tecnico'].includes(form.grauInstrucao) ? form.periodoCurso : '',
        outrosCursos: form.outrosCursos.trim(), status: 'ativo',
      }, password, resume);
      setSuccess(true);
    } catch (cause) {
      console.error('Erro ao salvar cadastro:', cause);
      setError(registrationError(cause));
    } finally {
      setLoading(false);
    }
  }

  function selectResume(file: File | undefined) {
    if (!file) return setResume(null);
    const validType = /\.pdf$/i.test(file.name)
      ? !file.type || file.type === 'application/pdf'
      : /\.docx$/i.test(file.name) && (!file.type || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (!validType) { setResume(null); return setError('Anexe um currículo em PDF ou DOCX.'); }
    if (file.size > 5 * 1024 * 1024) { setResume(null); return setError('O currículo deve ter no máximo 5 MB.'); }
    setError('');
    setResume(file);
  }

  return (
    <div className={styles.page}>
      <Image src="/paulo/cadastro.png" alt="" fill priority sizes="100vw" className={styles.background} />
      <header className={styles.header}>
        <Link href="/" aria-label="DF Estágios — página inicial"><Image src="/logo.png" alt="DF Estágios" width={285} height={123} priority /></Link>
        <div className={styles.headerAction}><span>Já tem uma conta?</span><Link href="/acesso-estudante" className={styles.headerLogin}>Entrar</Link></div>
      </header>
      <main className={styles.main}>
        <div className={styles.visualCopy}>
          <span className={styles.eyebrow}>O SEU FUTURO COMEÇA AQUI</span>
          <h1>Seu próximo passo<br /><em>começa com um<br />cadastro.</em></h1>
          <p>Crie seu perfil, encontre vagas e acompanhe suas oportunidades de estágio.</p>
        </div>
        <div className={styles.card}>
          {success ? (
            <div className={styles.success} role="status">
              <h2>Cadastro realizado!</h2>
              <p>Sua conta foi criada. Seu CPF é o login para acessar suas oportunidades.</p>
              <Link href="/area-estudante" className={styles.submit}>Acessar minha área <PublicIcon name="arrowRight" size={21} /></Link>
            </div>
          ) : (
            <>
              <h2>Crie sua conta gratuitamente</h2>
              <p className={styles.subtitle}>Leva apenas alguns minutos.</p>
              <div className={styles.stepper} aria-label="Etapas do cadastro">
                {['Dados pessoais', 'Formação', 'Acesso'].map((label, index) => (
                  <div key={label} className={styles.step + (index + 1 === step ? ' ' + styles.activeStep : '')}>
                    <span>{index + 1}</span><strong>{label}</strong>
                  </div>
                ))}
              </div>
              {error && <div className={styles.error} role="alert">{error}</div>}
              <form onSubmit={submit}>
                {step === 1 && (
                  <div className={styles.grid}>
                    <label>Nome completo<div className={styles.input}><PublicIcon name="user" size={21} /><input required autoComplete="name" value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Digite seu nome completo" /></div></label>
                    <label>CPF<div className={styles.input}><PublicIcon name="id" size={21} /><input required inputMode="numeric" maxLength={14} value={form.cpf} onChange={(e) => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" /></div></label>
                    <label>Data de nascimento<div className={styles.input}><PublicIcon name="calendar" size={21} /><input required type="date" value={form.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} /></div></label>
                    <label>Celular (WhatsApp)<div className={styles.input}><PublicIcon name="phone" size={21} /><input required type="tel" autoComplete="tel" value={form.telefone1} onChange={(e) => set('telefone1', maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></div></label>
                    <label className={styles.wide}>E-mail<div className={styles.input}><PublicIcon name="mail" size={21} /><input required type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="seu@email.com" /></div></label>
                    <label>CEP<div className={styles.input}><PublicIcon name="mapPin" size={21} /><input required inputMode="numeric" autoComplete="postal-code" maxLength={9} value={form.cep} onChange={(e) => { set('cep', e.target.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')); setForm((current) => ({ ...current, cidade: '', uf: '' })); }} onBlur={() => void lookupCep()} placeholder="00000-000" /></div></label>
                    <label>Endereço<div className={styles.input}><PublicIcon name="home" size={21} /><input required autoComplete="street-address" value={form.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder={lookingUpCep ? 'Consultando CEP...' : 'Rua, avenida e número'} /></div></label>
                    <label className={styles.wide}>Complemento <small>(opcional)</small><div className={styles.input}><input value={form.complemento} onChange={(e) => set('complemento', e.target.value)} placeholder="Apartamento, bloco ou referência" /></div></label>
                    {form.cidade && form.uf && <p className={styles.location}>Localidade: {form.cidade} / {form.uf}</p>}
                  </div>
                )}
                {step === 2 && (
                  <div className={styles.grid}>
                    <label className={styles.wide}>Nível de escolaridade<div className={styles.input}><select required value={form.grauInstrucao} onChange={(e) => { set('grauInstrucao', e.target.value as EducationLevel); setForm((current) => ({ ...current, anoEscolar: '', curso: '', periodoCurso: '' })); }}><option value="">Selecione</option><option value="fundamental">Nível fundamental</option><option value="medio">Nível médio</option><option value="superior">Superior</option><option value="tecnico">Técnico</option><option value="eja">EJA</option><option value="nao_estudando">Não está estudando</option></select></div></label>
                    {form.grauInstrucao === 'medio' && <label className={styles.wide}>Ano do ensino médio<div className={styles.input}><select required value={form.anoEscolar} onChange={(e) => set('anoEscolar', e.target.value)}><option value="">Selecione</option><option value="1">1º ano</option><option value="2">2º ano</option><option value="3">3º ano</option></select></div></label>}
                    {['superior', 'tecnico'].includes(form.grauInstrucao) && <>
                      <label>Curso<div className={styles.input}><input required value={form.curso} onChange={(e) => set('curso', e.target.value)} placeholder="Nome do curso" /></div></label>
                      <label>Período em que estuda<div className={styles.input}><select required value={form.periodoCurso} onChange={(e) => set('periodoCurso', e.target.value)}><option value="">Selecione</option><option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Noite">Noite</option><option value="EAD">EAD</option></select></div></label>
                    </>}
                    <label className={styles.wide}>Cursos complementares <small>(opcional)</small><div className={styles.input}><input value={form.outrosCursos} onChange={(e) => set('outrosCursos', e.target.value)} placeholder="Ex.: Informática, inglês" /></div></label>
                    <label className={styles.wide}>Currículo <small>(opcional, PDF ou DOCX até 5 MB)</small><input className={styles.fileInput} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => selectResume(e.target.files?.[0])} /></label>
                    {resume && <p className={styles.fileName}>Arquivo selecionado: {resume.name}</p>}
                  </div>
                )}
                {step === 3 && (
                  <div className={styles.grid}>
                    <p className={styles.accessInfo}>Seu login será o CPF <strong>{form.cpf}</strong>. Escolha uma senha para acessar sua conta.</p>
                    <label className={styles.wide}>Senha<div className={styles.input}><PublicIcon name="lock" size={21} /><input required type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Pelo menos 6 caracteres" /></div></label>
                    <label className={styles.wide}>Confirmar senha<div className={styles.input}><PublicIcon name="lock" size={21} /><input required type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" /></div></label>
                  </div>
                )}
                <div className={styles.formActions}>
                  {step > 1 && <button className={styles.back} type="button" disabled={loading} onClick={() => { setError(''); setStep((step - 1) as Step); }}>Voltar</button>}
                  <button disabled={loading || lookingUpCep} type="submit" className={styles.submit}>{loading ? 'Criando conta...' : step === 3 ? 'Concluir cadastro' : 'Continuar'}<PublicIcon name="arrowRight" size={21} /></button>
                </div>
                <p className={styles.footnote}><PublicIcon name="lock" size={17} /> Seus dados são protegidos. Cadastro 100% gratuito.</p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
