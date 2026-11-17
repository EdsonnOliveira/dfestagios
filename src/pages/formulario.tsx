import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import PublicIcon from '../components/PublicIcon';
import { estagiariosService } from '../services/firebase';
import { fetchCepLookup } from '../services/viaCepService';
import styles from '../styles/StudentRegistration.module.css';

type EducationLevel = '' | 'fundamental' | 'medio' | 'tecnico' | 'superior' | 'eja';

const initialForm = {
  nome: '', cpf: '', dataNascimento: '', telefone1: '', email: '', cep: '',
  endereco: '', complemento: '', bairro: '', cidade: '', uf: '',
  grauInstrucao: '' as EducationLevel, anoEscolar: '', curso: '', periodoCurso: '',
  outrosCursos: '',
};

function validCpf(input: string): boolean {
  const cpf = input.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length <= 10; length++) {
    const sum = Array.from({ length }, (_, index) => Number(cpf[index]) * (length + 1 - index)).reduce((a, b) => a + b, 0);
    const digit = (sum * 10) % 11 % 10;
    if (digit !== Number(cpf[length])) return false;
  }
  return true;
}

function maskCpf(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 11);
  return n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function maskPhone(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n ? `(${n}` : '';
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, n.length === 11 ? 7 : 6)}-${n.slice(n.length === 11 ? 7 : 6)}`;
}

export default function Formulario() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);

  const set = (field: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function lookupCep() {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLookingUpCep(true);
    try {
      const address = await fetchCepLookup(digits);
      if (!address) {
        setError('CEP não encontrado. Confira o número informado.');
        return;
      }
      setError('');
      setForm((current) => ({
        ...current,
        endereco: current.endereco || address.enderecoCompleto.split(' - ')[0],
        bairro: address.bairro,
        cidade: address.cidade,
        uf: address.uf,
      }));
    } catch {
      setError('Não foi possível consultar o CEP agora. Tente novamente.');
    } finally {
      setLookingUpCep(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step === 1) {
      if (!validCpf(form.cpf)) return setError('Informe um CPF válido.');
      if (form.cep.replace(/\D/g, '').length !== 8 || !form.cidade || !form.uf) return setError('Informe um CEP válido e aguarde o preenchimento do endereço.');
      if (!form.endereco.trim()) return setError('Informe o endereço.');
      setStep(2);
      return;
    }
    if (form.grauInstrucao === 'medio' && !form.anoEscolar) return setError('Informe o ano em que está estudando.');
    if (['tecnico', 'superior'].includes(form.grauInstrucao) && (!form.curso.trim() || !form.periodoCurso.trim())) return setError('Informe o curso e o período.');
    setLoading(true);
    try {
      await estagiariosService.add({
        nome: form.nome.trim(), cpf: form.cpf, dataNascimento: form.dataNascimento,
        telefone1: form.telefone1, email: form.email.trim(), cep: form.cep,
        endereco: form.endereco.trim(), complemento: form.complemento.trim(),
        bairro: form.bairro, cidade: form.cidade, uf: form.uf,
        grauInstrucao: form.grauInstrucao, anoEscolar: form.anoEscolar,
        curso: form.curso.trim(), periodoCurso: form.periodoCurso.trim(),
        outrosCursos: form.outrosCursos.trim(), status: 'ativo',
      });
      setSuccess(true);
    } catch (cause) {
      console.error('Erro ao salvar cadastro:', cause);
      setError('Não foi possível concluir o cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Image src="/paulo/cadastro.png" alt="" fill priority sizes="100vw" className={styles.background} />
      <header className={styles.header}>
        <Link href="/" aria-label="DF Estágios — página inicial"><Image src="/logo.png" alt="DF Estágios" width={285} height={123} priority /></Link>
        <div className={styles.headerAction}><span>Já tem uma conta?</span><button type="button" aria-disabled="true">Entrar</button></div>
      </header>
      <main className={styles.main}>
        <div className={styles.visualCopy}>
          <span className={styles.eyebrow}>O SEU FUTURO COMEÇA AQUI</span>
          <h1>Seu próximo passo<br /><em>começa com um<br />cadastro.</em></h1>
          <p>Crie seu perfil, encontre vagas e acompanhe suas oportunidades de estágio.</p>
        </div>
        <div className={styles.card}>
          {success ? <div className={styles.success} role="status"><h2>Cadastro realizado!</h2><p>Seus dados foram recebidos pela DF Estágios.</p><Link href="/#vagas-home-title" className={styles.submit}>Ver vagas disponíveis →</Link></div> : <>
            <h2>Crie sua conta gratuitamente</h2>
            <p className={styles.subtitle}>Leva apenas alguns minutos.</p>
            <div className={styles.stepper} aria-label="Etapas do cadastro">
              {['Dados pessoais', 'Formação', 'Acesso'].map((label, index) => <div key={label} className={`${styles.step} ${index + 1 === step ? styles.activeStep : ''}`}><span>{index + 1}</span><strong>{label}</strong></div>)}
            </div>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <form onSubmit={submit}>
              {step === 1 ? <div className={styles.grid}>
                <label>Nome completo<div className={styles.input}><PublicIcon name="user" size={21} /><input required autoComplete="name" value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Digite seu nome completo" /></div></label>
                <label>CPF<div className={styles.input}><PublicIcon name="id" size={21} /><input required inputMode="numeric" maxLength={14} value={form.cpf} onChange={(e) => set('cpf', maskCpf(e.target.value))} placeholder="000.000.000-00" /></div></label>
                <label>Data de nascimento<div className={styles.input}><PublicIcon name="calendar" size={21} /><input required type="date" value={form.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} /></div></label>
                <label>Celular (WhatsApp)<div className={styles.input}><PublicIcon name="phone" size={21} /><input required type="tel" autoComplete="tel" value={form.telefone1} onChange={(e) => set('telefone1', maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></div></label>
                <label className={styles.wide}>E-mail<div className={styles.input}><PublicIcon name="mail" size={21} /><input required type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="seu@email.com" /></div></label>
                <label>CEP<div className={styles.input}><PublicIcon name="mapPin" size={21} /><input required inputMode="numeric" autoComplete="postal-code" maxLength={9} value={form.cep} onChange={(e) => set('cep', e.target.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'))} onBlur={() => void lookupCep()} placeholder="00000-000" /></div></label>
                <label>Endereço<div className={styles.input}><PublicIcon name="home" size={21} /><input required autoComplete="street-address" value={form.endereco} onChange={(e) => set('endereco', e.target.value)} placeholder={lookingUpCep ? 'Consultando CEP...' : 'Rua, avenida e número'} /></div></label>
              </div> : <div className={styles.grid}>
                <label className={styles.wide}>Complemento<div className={styles.input}><input value={form.complemento} onChange={(e) => set('complemento', e.target.value)} placeholder="Apartamento, bloco ou referência" /></div></label>
                <label className={styles.wide}>Nível de escolaridade<div className={styles.input}><select required value={form.grauInstrucao} onChange={(e) => set('grauInstrucao', e.target.value as EducationLevel)}><option value="">Selecione</option><option value="fundamental">Fundamental</option><option value="medio">Médio</option><option value="superior">Superior</option><option value="tecnico">Técnico</option><option value="eja">EJA</option></select></div></label>
                {form.grauInstrucao === 'medio' && <label className={styles.wide}>Ano<div className={styles.input}><select required value={form.anoEscolar} onChange={(e) => set('anoEscolar', e.target.value)}><option value="">Selecione</option><option value="1">1º ano</option><option value="2">2º ano</option><option value="3">3º ano</option></select></div></label>}
                {['tecnico', 'superior'].includes(form.grauInstrucao) && <><label>Curso<div className={styles.input}><input required value={form.curso} onChange={(e) => set('curso', e.target.value)} /></div></label><label>Período<div className={styles.input}><input required value={form.periodoCurso} onChange={(e) => set('periodoCurso', e.target.value)} placeholder="Ex.: 3º semestre" /></div></label></>}
                <label className={styles.wide}>Cursos complementares<div className={styles.input}><input value={form.outrosCursos} onChange={(e) => set('outrosCursos', e.target.value)} placeholder="Ex.: Informática, inglês" /></div></label>
              </div>}
              <div className={styles.formActions}>{step === 2 && <button className={styles.back} type="button" onClick={() => setStep(1)}>Voltar</button>}<button disabled={loading || lookingUpCep} type="submit" className={styles.submit}>{loading ? 'Enviando...' : step === 1 ? 'Continuar' : 'Concluir cadastro'}<PublicIcon name="arrowRight" size={21} /></button></div>
              <p className={styles.footnote}><PublicIcon name="lock" size={17} /> Seus dados são protegidos. Cadastro 100% gratuito.</p>
            </form>
          </>}
        </div>
      </main>
    </div>
  );
}
