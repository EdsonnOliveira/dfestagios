import Image from 'next/image';
import Link from 'next/link';
import HomeHeader from '../components/HomeHeader';
import HomeFooter from '../components/HomeFooter';
import PublicIcon from '../components/PublicIcon';
import styles from '../styles/PublicMarketing.module.css';

const values = [
  ['Propósito', 'Acreditamos na educação como ponte para um futuro melhor.'],
  ['Pessoas', 'Valorizamos histórias, talentos e novas perspectivas.'],
  ['Confiança', 'Construímos relações sólidas e duradouras.'],
];
const highlights = [
  'Conexões que fazem a diferença',
  'Oportunidades para crescer',
  'Parceria do início ao fim',
];

export default function Conheca() {
  return (
    <div className={`${styles.page} ${styles.aboutPage}`}>
      <HomeHeader />
      <main>
        <section className={styles.pageHero}>
          <div className={styles.pageHeroCopy}>
            <span className={styles.eyebrow}>Nossa história</span>
            <h1 className={styles.pageTitle}>Há 10 anos conectando <em>talentos a oportunidades.</em></h1>
            <p>A DF Estágios acredita no potencial de quem está começando. Há uma década, aproximamos estudantes e empresas, transformando oportunidades de estágio em experiências que impulsionam carreiras.</p>
            <div className={styles.featureRow}>
              {highlights.map((title, index) => (
                <div className={styles.feature} key={title}>
                  <span className={styles.featureIcon}><PublicIcon name={(['users', 'chart', 'handshake'] as const)[index]} size={39} /></span>
                  <span><strong>{title}</strong></span>
                </div>
              ))}
            </div>
            <Link href="/formulario" className={styles.primaryButton}>Faça parte dessa história →</Link>
            <div className={styles.aboutLinks}><Link href="/estudante">Sou estudante →</Link><Link href="/empresa">Sou empresa →</Link></div>
          </div>
          <Image className={styles.pageHeroImage} src="/paulo/sobre.png" alt="Estudantes e profissionais reunidos em torno de um computador" width={1536} height={1024} priority />
        </section>
        <section className={styles.secondarySection}>
          <div className={styles.container}>
            <h2 className={styles.secondaryTitle}>O que nos move</h2>
            <div className={styles.secondaryGrid}>
              {values.map(([title, text]) => <article className={styles.secondaryCard} key={title}><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
}
