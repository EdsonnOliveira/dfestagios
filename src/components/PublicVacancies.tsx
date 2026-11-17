import { useEffect, useState } from 'react';
import PublicIcon from './PublicIcon';
import { entrevistasService } from '../services/firebase';
import type { Entrevista } from '../types/firebase';
import { getAvailableVacancies, vacancyAudience, vacancyLocation, vacancyWhatsAppUrl } from '../lib/publicVacancies';
import styles from '../styles/PublicMarketing.module.css';

export function usePublicVacancies() {
  const [all, setAll] = useState<Entrevista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await entrevistasService.getAll();
        if (active) {
          setAll(data);
          setError(false);
        }
      } catch (cause) {
        console.error('Erro ao carregar vagas públicas:', cause);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => {
      setNow(new Date());
      void load();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return { vacancies: getAvailableVacancies(all, now), loading, error };
}

export function VacancyCard({ vacancy }: { vacancy: Entrevista }) {
  const audience = vacancyAudience(vacancy);
  const title = vacancy.tituloVaga.toLocaleLowerCase('pt-BR');
  const iconName = title.includes('atendimento') || title.includes('recepcion') ? 'headset' : title.includes('marketing') ? 'megaphone' : 'briefcase';
  return (
    <article className={styles.vacancyCard}>
      <div className={styles.vacancyIcon} aria-hidden="true">
        <PublicIcon name={iconName} size={35} />
      </div>
      <div className={styles.vacancyBody}>
        <h3>{vacancy.tituloVaga}</h3>
        <p>{vacancyLocation(vacancy)}</p>
        <div className={styles.vacancyFacts}>
          {vacancy.valorBolsa && <span>Bolsa: {vacancy.valorBolsa}</span>}
          {vacancy.horarioTrabalho && <span>Horário: {vacancy.horarioTrabalho}</span>}
          {audience && <span>{audience === 'ambos' ? 'Moças e rapazes' : `Somente ${audience === 'mocas' ? 'moças' : 'rapazes'}`}</span>}
        </div>
        <a href={vacancyWhatsAppUrl(vacancy)} target="_blank" rel="noopener noreferrer" className={styles.applyButton}>
          Candidatar-se <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}
