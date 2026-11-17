import Image from 'next/image';
import Link from 'next/link';
import HomeHeader from '../components/HomeHeader';
import HomeFooter from '../components/HomeFooter';
import PublicIcon from '../components/PublicIcon';
import styles from '../styles/PublicMarketing.module.css';

const benefits = [
  ['Acesso a vagas de estágio', 'Encontre oportunidades para seu perfil.'],
  ['Experiência para sua carreira', 'Aprenda na prática e desenvolva habilidades.'],
  ['Tudo em um só lugar', 'Acompanhe suas candidaturas com facilidade.'],
];

export default function Estudante() {
  return (
    <div className={`${styles.page} ${styles.studentPage}`}>
      <HomeHeader />
      <main>
        <section className={styles.pageHero}>
          <div className={styles.pageHeroCopy}>
            <span className={styles.eyebrow}>Para estudantes</span>
            <h1 className={styles.pageTitle}>Seu futuro profissional <em>começa aqui.</em></h1>
            <p>Cadastre-se gratuitamente, encontre oportunidades de estágio e dê o primeiro passo na sua carreira.</p>
            <div className={styles.featureList}>
              {benefits.map(([title, text], index) => (
                <div className={styles.feature} key={title}>
                  <span className={styles.featureIcon}><PublicIcon name={(['briefcase', 'chart', 'users'] as const)[index]} size={29} /></span>
                  <span><strong>{title}</strong><small>{text}</small></span>
                </div>
              ))}
            </div>
            <Link href="/formulario" className={styles.primaryButton}>Inscreva-se gratuitamente →</Link>
            <p style={{ marginTop: 13, fontSize: 13 }}>Cadastro 100% gratuito para estudantes.</p>
          </div>
          <Image className={styles.pageHeroImage} src="/paulo/estudantes.png" alt="Dois estudantes consultando oportunidades em um computador" width={1536} height={1024} priority />
        </section>
      </main>
      <HomeFooter />
    </div>
  );
}
