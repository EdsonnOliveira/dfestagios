import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import HomeHeader from '../components/HomeHeader';
import HomeFooter from '../components/HomeFooter';
import PublicIcon from '../components/PublicIcon';
import { VacancyCard, usePublicVacancies } from '../components/PublicVacancies';
import { gruposService } from '../services/firebase';
import type { Grupo } from '../types/firebase';
import heroStyles from '../styles/HomeHero.module.css';
import styles from '../styles/PublicMarketing.module.css';

export default function Home() {
  const { vacancies, loading: vacanciesLoading, error: vacanciesError } = usePublicVacancies();
  const [groups, setGroups] = useState<Grupo[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showAllVacancies, setShowAllVacancies] = useState(false);
  const [vacancyCategory, setVacancyCategory] = useState('Todas as vagas');
  const [vacancyOffset, setVacancyOffset] = useState(0);
  const [groupOffset, setGroupOffset] = useState(0);
  const filteredVacancies = vacancyCategory === 'Todas as vagas' ? vacancies : vacancies.filter((vacancy) => vacancy.tituloVaga.toLocaleLowerCase('pt-BR').includes(vacancyCategory.toLocaleLowerCase('pt-BR')));
  const visibleVacancies = showAllVacancies ? filteredVacancies : filteredVacancies.slice(vacancyOffset, vacancyOffset + 3);

  useEffect(() => {
    let active = true;
    void gruposService.getAll().then((data) => {
      if (active) setGroups([...data].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true })));
    }).catch((error) => {
      console.error('Erro ao carregar grupos:', error);
    }).finally(() => {
      if (active) setGroupsLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader />

      <section className={heroStyles.hero} aria-labelledby="home-hero-title">
        <Image
          src="/home-hero-background.png"
          alt="Estudante em Brasília com o Congresso Nacional ao fundo"
          fill
          priority
          sizes="100vw"
          className={heroStyles.background}
        />
        <div className={heroStyles.shade} aria-hidden="true" />

        <div className={heroStyles.content}>
          <div className={heroStyles.intro}>
            <h1 id="home-hero-title" className={heroStyles.title}>
              Conectando<br /><span>talentos</span> a grandes<br />oportunidades
            </h1>
            <p className={heroStyles.description}>
              A DF Estágios é a sua ponte entre o futuro e o mercado de trabalho. Ajudamos estudantes a conquistarem estágios e apoiamos empresas a encontrarem os melhores talentos.
            </p>

            <div className={heroStyles.actions}>
              <Link href="/formulario" className={heroStyles.actionCard}>
                <span className={heroStyles.studentIcon} aria-hidden="true">
                  <PublicIcon name="graduation" size={60} />
                </span>
                <span className={heroStyles.actionCopy}>
                  <strong>Sou Estudante</strong>
                  <small>Cadastre-se, encontre vagas e acompanhe suas candidaturas.</small>
                </span>
                <span className={heroStyles.arrow} aria-hidden="true">
                  <Image src="/home-hero-icons/arrow-right.svg" alt="" width={19} height={19} />
                </span>
              </Link>

              <Link href="/empresa" className={heroStyles.actionCard}>
                <span className={heroStyles.companyIcon} aria-hidden="true">
                  <PublicIcon name="building" size={55} />
                </span>
                <span className={heroStyles.actionCopy}>
                  <strong>Sou Empresa</strong>
                  <small>Contrate estagiários e fortaleça sua equipe.</small>
                </span>
                <span className={`${heroStyles.arrow} ${heroStyles.companyArrow}`} aria-hidden="true">
                  <Image src="/home-hero-icons/arrow-right.svg" alt="" width={19} height={19} />
                </span>
              </Link>
            </div>
          </div>

          <div className={heroStyles.quote}>
            O estágio de hoje constrói o seu <strong>amanhã</strong>
            <span aria-hidden="true" />
          </div>

          <div className={heroStyles.benefits} aria-label="Vantagens da DF Estágios">
            <div className={heroStyles.benefit}>
              <Image src="/home-hero-icons/users-round.svg" alt="" width={36} height={36} />
              <span>Vagas em<br />diversas áreas</span>
            </div>
            <div className={heroStyles.benefit}>
              <Image src="/home-hero-icons/file-text.svg" alt="" width={36} height={36} />
              <span>Processo simples<br />e sem burocracia</span>
            </div>
            <div className={heroStyles.benefit}>
              <Image src="/home-hero-icons/shield-check.svg" alt="" width={36} height={36} />
              <span>Segurança e suporte<br />em todo o processo</span>
            </div>
          </div>

          <div className={heroStyles.stats}>
            <div className={heroStyles.stat}>
              <Image src="/home-hero-icons/briefcase-business.svg" alt="" width={35} height={35} />
              <span><strong>+ de 1.000</strong><small>empresas parceiras</small></span>
            </div>
            <div className={heroStyles.stat}>
              <Image src="/home-hero-icons/users-round.svg" alt="" width={38} height={38} />
              <span><strong>Milhares</strong><small>de estudantes conectados</small></span>
            </div>
            <div className={heroStyles.stat}>
              <Image src="/home-hero-icons/map-pin.svg" alt="" width={38} height={38} />
              <span><strong>Brasília e entorno</strong><small>Atendemos todo o DF e cidades satélites</small></span>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.whyIntro}>
        <span>POR QUE ESCOLHER A DF ESTÁGIOS?</span>
        <h2>Mais oportunidades para o seu futuro</h2>
        <p>Trabalhamos para aproximar estudantes e empresas, oferecendo um processo seguro,<br /> ágil e de acordo com a Lei do Estágio (Lei 11.788/2008).</p>
      </div>

      <section className={styles.section} aria-labelledby="vagas-home-title">
        <div className={`${styles.container} ${styles.jobsLayout}`}>
          <div className={styles.jobsVisual}>
            <Image src="/paulo/vagas-illustration.png" alt="Estudante em Brasília" width={1254} height={1254} />
            <h2>Seu futuro começa aqui</h2>
            <p>Encontre oportunidades de estágio em Brasília e entorno.</p>
            <a href="#vagas-home-title">Explorar vagas →</a>
          </div>
          <div>
            <div className={styles.jobsHeader}>
              <div>
                <h2 id="vagas-home-title" className={styles.sectionTitle}>Vagas de Estágio <em>Disponíveis</em></h2>
                <p className={styles.lead}>Escolha a oportunidade que combina com você.</p>
              </div>
            </div>
            <div className={styles.jobFilters} aria-label="Filtrar vagas por área">
              {['Todas as vagas', 'Administrativo', 'Atendimento', 'Marketing'].map((category) => <button key={category} type="button" className={vacancyCategory === category ? styles.selectedFilter : ''} onClick={() => { setVacancyCategory(category); setVacancyOffset(0); setShowAllVacancies(false); }}>{category}</button>)}
            </div>
            <div className={styles.jobGrid}>
              {vacanciesLoading ? <div className={styles.empty}>Carregando vagas...</div> :
                vacanciesError ? <div className={styles.empty}>Não foi possível carregar as vagas agora.</div> :
                filteredVacancies.length ? visibleVacancies.map((vacancy) => <VacancyCard key={vacancy.id} vacancy={vacancy} />) :
                <div className={styles.empty}>Nenhuma vaga disponível no momento.</div>}
            </div>
            {filteredVacancies.length > 3 && <div className={styles.allVacancies}>
              <button type="button" aria-label="Vagas anteriores" disabled={showAllVacancies || vacancyOffset === 0} onClick={() => setVacancyOffset((value) => Math.max(0, value - 1))}>‹</button>
              <button type="button" aria-label="Próximas vagas" disabled={showAllVacancies || vacancyOffset + 3 >= filteredVacancies.length} onClick={() => setVacancyOffset((value) => value + 1)}>›</button>
              <button type="button" onClick={() => { setShowAllVacancies((value) => !value); setVacancyOffset(0); }}>{showAllVacancies ? 'Ver menos vagas' : 'Ver todas as vagas →'}</button>
            </div>}
          </div>
        </div>
      </section>

      <section className={styles.groupsSection} aria-labelledby="groups-home-title">
        <div className={styles.container}>
          <div className={styles.groupsHeader}>
            <Image src="/logo.png" alt="DF Estágios" width={275} height={118} />
            <h2 id="groups-home-title">Receba vagas direto no seu <span>WhatsApp</span></h2>
            <p>Entre em nossos grupos gratuitos e fique por dentro das novas oportunidades de estágio em Brasília e entorno.</p>
          </div>
          <div className={styles.groupGrid}>
            {groupsLoading ? <div className={styles.empty}>Carregando grupos...</div> :
              groups.length ? groups.slice(groupOffset, groupOffset + 5).map((group) => (
                <article className={styles.groupCard} key={group.id}>
                  <span className={styles.groupIcon}><span className={styles.groupIconInner}><PublicIcon name="users" size={50} /></span><span className={styles.groupWhatsapp}><PublicIcon name="phone" size={24} /></span></span>
                  <strong>{/^grupo de vagas\s*\d+$/i.test(group.titulo.trim()) ? `Grupo de Vagas ${String(Number(group.titulo.match(/\d+/)?.[0])).padStart(2, '0')}` : group.titulo}</strong>
                  <p>Oportunidades de estágio<br />Vagas divulgadas regularmente</p>
                  <a href={group.link} target="_blank" rel="noopener noreferrer"><PublicIcon name="phone" size={24} />Entrar no grupo <span>→</span></a>
                </article>
              )) : <div className={styles.empty}>Nenhum grupo disponível no momento.</div>}
          </div>
          {groups.length > 5 && <div className={styles.groupControls}><span>{groups.map((group, index) => <button type="button" key={group.id} className={index === groupOffset ? styles.currentDot : ''} aria-label={`Mostrar grupo ${index + 1}`} onClick={() => setGroupOffset(Math.min(index, Math.max(0, groups.length - 5)))} />)}</span><div><button type="button" aria-label="Grupos anteriores" disabled={groupOffset === 0} onClick={() => setGroupOffset((value) => Math.max(0, value - 1))}>‹</button><button type="button" aria-label="Próximos grupos" disabled={groupOffset + 5 >= groups.length} onClick={() => setGroupOffset((value) => value + 1)}>›</button></div></div>}
          <p className={styles.groupsFoot}>♢ &nbsp;Participação gratuita · Sem cobrança de taxas</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="instagram-home-title">
        <div className={`${styles.container} ${styles.instagramLayout}`}>
          <div className={styles.instagramCopy}>
            <span className={styles.eyebrow}>Acompanhe a DF Estágios</span>
            <h2 id="instagram-home-title" className={styles.sectionTitle}>Não perca nenhuma <em>oportunidade!</em></h2>
            <p className={styles.lead}>Siga nosso Instagram e acompanhe vagas, dicas e novidades para sua carreira.</p>
            <a className={styles.primaryButton} href="https://www.instagram.com/estagiosdf/" target="_blank" rel="noopener noreferrer"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/></svg>Seguir @estagiosdf <span>↗</span></a>
          </div>
          <div className={styles.instagramCards} aria-label="Publicações da DF Estágios">
            <Image src="/paulo/instagram-vagas.png" alt="Publicação: vagas da semana" width={1086} height={1448} />
            <Image src="/paulo/instagram-futuro.png" alt="Publicação: seu futuro começa aqui" width={1086} height={1448} />
            <Image src="/paulo/instagram-dicas.png" alt="Publicação: dicas para entrevistas" width={1086} height={1448} />
          </div>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}
