import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import PublicIcon from './PublicIcon';
import styles from '../styles/PublicHeader.module.css';

export default function HomeHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label="DF Estágios — página inicial" onClick={close}>
          <Image src="/logo.png" alt="DF Estágios" width={285} height={123} priority />
        </Link>
        <nav className={`${styles.nav} ${open ? styles.navOpen : ''}`} aria-label="Navegação principal">
          <Link href="/estudante" onClick={close}>Sou Estudante <PublicIcon name="chevronDown" size={17} /></Link>
          <Link href="/empresa" onClick={close}>Sou Empresa <PublicIcon name="chevronDown" size={17} /></Link>
          <Link href="/conheca" onClick={close}>Conheça a DF Estágios <PublicIcon name="chevronDown" size={17} /></Link>
          <div className={styles.mobileActions}>
            <Link href="/acesso-estudante" onClick={close}>Login</Link>
            <Link href="/formulario" onClick={close}>Inscreva-se</Link>
          </div>
        </nav>
        <div className={styles.actions}>
          <Link href="/#vagas-home-title" className={styles.search} aria-label="Ir para vagas disponíveis"><Image src="/paulo/search.svg" alt="" width={23} height={23} /></Link>
          <Link href="/acesso-estudante" className={styles.login} onClick={close}><PublicIcon name="user" size={25} /> Login</Link>
          <Link href="/formulario" className={styles.signup}><PublicIcon name="userPlus" size={25} />Inscreva-se</Link>
        </div>
        <button type="button" className={styles.menuButton} onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>
          <Image src={open ? '/paulo/x.svg' : '/paulo/menu.svg'} alt="" width={26} height={26} />
        </button>
      </div>
    </header>
  );
}
