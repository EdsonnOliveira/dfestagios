import Image from 'next/image';
import Link from 'next/link';
import PublicIcon from './PublicIcon';
import styles from '../styles/PublicFooter.module.css';

export default function HomeFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>DF Estágios - Todos os direitos reservados</span>
        <Link href="/" aria-label="DF Estágios — página inicial" className={styles.brand}>
          <Image src="/logo.png" alt="DF Estágios" width={116} height={50} />
        </Link>
        <Link href="/login" className={styles.admin}><PublicIcon name="lock" size={18} />Login administrativo</Link>
      </div>
    </footer>
  );
}
