import Image from 'next/image';
import HomeHeader from '../components/HomeHeader';
import HomeFooter from '../components/HomeFooter';
import PublicIcon from '../components/PublicIcon';
import styles from '../styles/PublicMarketing.module.css';
import { whatsapp } from '../constants/var';

const contactUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá, gostaria de contratar estagiários para minha empresa.')}`;
const benefits = [
  ['Economia de até 70%', 'Reduza custos em comparação à contratação CLT.'],
  ['Talentos para sua equipe', 'Encontre estudantes alinhados às necessidades da empresa.'],
  ['Contratação sem burocracia', 'Cuidamos da seleção, documentação e seguro obrigatório.'],
];

export default function Empresa() {
  return (
    <div className={`${styles.page} ${styles.companyPage}`}>
      <HomeHeader />
      <main>
        <section className={styles.pageHero}>
          <div className={styles.pageHeroCopy}>
            <span className={styles.eyebrow}>Para empresas</span>
            <h1 className={styles.pageTitle}>Sua empresa cresce. <em>Seus custos diminuem.</em></h1>
            <p>Encontre novos talentos, fortaleça sua equipe e reduza os custos de contratação com o programa de estágio.</p>
            <div className={styles.featureRow}>
              {benefits.map(([title, text], index) => (
                <div className={styles.feature} key={title}>
                  <span className={styles.featureIcon}><PublicIcon name={(['coins', 'users', 'briefcase'] as const)[index]} size={29} /></span>
                  <span><strong>{title}</strong><small>{text}</small></span>
                </div>
              ))}
            </div>
            <a href={contactUrl} target="_blank" rel="noopener noreferrer" className={styles.primaryButton}>Quero contratar estagiários para minha empresa →</a>
            <p style={{ marginTop: 13, fontSize: 13 }}>Atendimento especializado para empresas de Brasília e entorno.</p>
          </div>
          <Image className={styles.pageHeroImage} src="/paulo/empresas.png" alt="Equipe trabalhando em conjunto" width={1384} height={1136} priority />
        </section>
      </main>
      <HomeFooter />
    </div>
  );
}
