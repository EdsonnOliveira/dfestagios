import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import PublicIcon from '../components/PublicIcon';
import { signInStudent } from '../services/studentRegistrationService';
import styles from '../styles/StudentRegistration.module.css';

export default function AcessoEstudante() {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInStudent(cpf, password, remember);
      await router.push('/area-estudante');
    } catch {
      setError('CPF ou senha incorretos. Confira os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <Image src="/paulo/acesso-estudante.png" alt="" fill priority sizes="100vw" className={styles.background} />
      <header className={styles.header}>
        <Link href="/" aria-label="DF Estágios — página inicial"><Image src="/logo.png" alt="DF Estágios" width={285} height={123} priority /></Link>
        <div className={styles.headerAction}><span>Ainda não tem cadastro?</span><Link href="/formulario" className={styles.headerLogin}>Cadastre-se gratuitamente</Link></div>
      </header>
      <main className={styles.main}>
        <div className={styles.visualCopy}>
          <span className={styles.eyebrow}>ÁREA DO ESTUDANTE</span>
          <h1>Suas oportunidades<br /><em>começam aqui.</em></h1>
          <p className={styles.loginIntro}>Acesse sua conta, encontre vagas de estágio e acompanhe suas candidaturas em um só lugar.</p>
        </div>
        <div className={styles.card + ' ' + styles.loginCard}>
          <h2>Bem-vindo de volta!</h2>
          <p className={styles.subtitle}>Entre com seu CPF e senha para acessar sua conta.</p>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <form onSubmit={submit}>
            <div className={styles.grid}>
              <label className={styles.wide}>CPF<div className={styles.input}><PublicIcon name="id" size={21} /><input required inputMode="numeric" autoComplete="username" value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="000.000.000-00" /></div></label>
              <label className={styles.wide}>Senha<div className={styles.input}><PublicIcon name="lock" size={21} /><input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" /><button type="button" onClick={() => setShowPassword((value) => !value)} className={styles.showPassword}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></label>
            </div>
            <div className={styles.loginOptions}><label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Lembrar de mim</label><a href="https://wa.me/5561998109169?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20para%20recuperar%20meu%20acesso%20ao%20site." target="_blank" rel="noopener noreferrer">Esqueci minha senha</a></div>
            <div className={styles.formActions}><button type="submit" className={styles.submit} disabled={loading}>{loading ? 'Entrando...' : 'Entrar na minha conta'}<PublicIcon name="arrowRight" size={21} /></button></div>
          </form>
          <div className={styles.loginDivider}><span>ou</span></div>
          <p className={styles.loginSignup}>Ainda não possui cadastro? <Link href="/formulario">Inscreva-se gratuitamente</Link></p>
          <p className={styles.loginPrivacy}><PublicIcon name="lock" size={17} /> Seus dados estão protegidos.</p>
        </div>
      </main>
    </div>
  );
}
