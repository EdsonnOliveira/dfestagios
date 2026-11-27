import Head from 'next/head';
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { formsService } from '../services/formsService';
import { DynamicForm, FormField } from '../types/firebase';
import styles from '../styles/Escritorios.module.css';

const WHATSAPP_BASE =
  'https://wa.me/5561999629819?text=Ol%C3%A1%2C%20gostaria%20de%20contratar%20estagi%C3%A1rios%20para%20minha%20empresa.';

export default function EscritoriosPage() {
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [whatsappHref, setWhatsappHref] = useState(WHATSAPP_BASE);
  const [error, setError] = useState('');

  const fields = useMemo(
    () =>
      [...(form?.fields ?? [])].sort((a, b) => a.order - b.order),
    [form]
  );

  const loadForm = useCallback(async () => {
    try {
      setLoading(true);
      const ensured = await formsService.ensureEscritoriosForm();
      setForm(ensured);
      const initial: Record<string, string> = {};
      ensured.fields.forEach((field) => {
        initial[field.name] = '';
      });
      setAnswers(initial);
    } catch (err) {
      console.error('Erro ao carregar formulário escritorios:', err);
      setError('Não foi possível carregar o formulário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const handleChange = (field: FormField, value: string) => {
    setAnswers((prev) => ({ ...prev, [field.name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    try {
      setSubmitting(true);
      setError('');
      await formsService.submitResponse(form, answers);

      const company = answers.company || '';
      const contact = answers.contact || '';
      const position = answers.position || '';
      const city = answers.city || '';
      const message = `Olá, gostaria de contratar estagiários para minha empresa. Empresa: ${company}. Contato: ${contact}. Perfil da vaga: ${position}. Cidade: ${city}.`;
      setWhatsappHref(
        `https://wa.me/5561999629819?text=${encodeURIComponent(message)}`
      );
      setSuccess(true);
    } catch (err) {
      console.error('Erro ao enviar formulário:', err);
      setError('Não foi possível enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      required: field.required,
      placeholder: field.placeholder || '',
      value: answers[field.name] || '',
      onChange: (
        event: ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
      ) => handleChange(field, event.target.value),
    };

    if (field.type === 'textarea') {
      return <textarea {...commonProps} />;
    }

    if (field.type === 'select') {
      return (
        <select {...commonProps}>
          <option value="">Selecione</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return <input type={field.type} {...commonProps} />;
  };

  return (
    <>
      <Head>
        <title>DF Estágios para Empresas | Contrate estagiários</title>
        <meta
          name="description"
          content="Encontre estagiários para sua empresa, reduza custos de contratação e fortaleça sua equipe com apoio especializado."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={`${styles.container} ${styles.nav}`}>
            <a
              className={styles.brand}
              href="#inicio"
              aria-label="DF Estágios para empresas - início"
            >
              <img
                className={styles.brandLogo}
                src="/logo.png"
                alt="DF Estágios"
              />
            </a>
            <nav className={styles.navLinks} aria-label="Navegação principal">
              <a href="#beneficios">Benefícios</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#segmentos">Segmentos</a>
              <a href="#contato">Contato</a>
            </nav>
            <a className={`${styles.button} ${styles.buttonBlue}`} href="#contato">
              Quero contratar
            </a>
          </div>
        </header>

        <main>
          <section className={styles.hero} id="inicio">
            <div className={`${styles.container} ${styles.heroGrid}`}>
              <div>
                <div className={styles.eyebrow}>Para empresas</div>
                <h1 className={styles.heroTitle}>
                  Sua empresa cresce. <em>Seus custos diminuem.</em>
                </h1>
                <p className={styles.heroCopy}>
                  Encontre novos talentos, fortaleça sua equipe e reduza os custos
                  de contratação com um programa de estágio acompanhado de ponta a
                  ponta.
                </p>
                <div className={styles.heroActions}>
                  <a
                    className={`${styles.button} ${styles.buttonBlue}`}
                    href={WHATSAPP_BASE}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Quero contratar estagiários
                  </a>
                  <a
                    className={`${styles.button} ${styles.buttonOutline}`}
                    href="#como-funciona"
                  >
                    Como funciona
                  </a>
                </div>
                <p className={styles.heroNote}>
                  Atendimento especializado para empresas de Brasília e entorno.
                </p>
              </div>
              <div className={styles.heroVisual}>
                <div className={styles.heroPhotoWrap}>
                  <img
                    className={styles.heroPhoto}
                    src="/escritorios/escritorio-hero.png"
                    alt="Equipe de empresa trabalhando em conjunto em um escritório"
                  />
                </div>
                <div className={styles.heroCard}>
                  <strong>Talentos para sua equipe</strong>
                  <span>Estudantes alinhados às necessidades do seu negócio.</span>
                </div>
                <div className={styles.heroBadge}>
                  <strong>Até 70% de economia</strong>
                  <span>em comparação à contratação CLT*</span>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.benefitStrip} id="beneficios">
            <div className={`${styles.container} ${styles.benefitGrid}`}>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>◉</span>
                <div>
                  <strong>Economia de até 70%</strong>
                  <span>
                    Uma alternativa mais enxuta em comparação à contratação CLT.
                  </span>
                </div>
              </div>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>♙</span>
                <div>
                  <strong>Talentos para sua equipe</strong>
                  <span>
                    Encontre estudantes alinhados ao momento da sua empresa.
                  </span>
                </div>
              </div>
              <div className={styles.benefit}>
                <span className={styles.benefitIcon}>▣</span>
                <div>
                  <strong>Contratação sem burocracia</strong>
                  <span>
                    Seleção, documentação e seguro obrigatório com apoio
                    especializado.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section className={`${styles.section} ${styles.why}`}>
            <div className={`${styles.container} ${styles.whyGrid}`}>
              <aside className={styles.whyAside}>
                <div className={styles.eyebrow}>Por que contratar estagiários?</div>
                <h2>Mais agilidade para formar a equipe que sua empresa precisa.</h2>
                <p>
                  Você encontra pessoas em desenvolvimento, prepara novos talentos
                  e mantém o foco no crescimento do negócio.
                </p>
                <a
                  className={styles.button}
                  href="https://wa.me/5561999629819?text=Ol%C3%A1%2C%20quero%20entender%20como%20contratar%20estagi%C3%A1rios."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar com a equipe
                </a>
              </aside>
              <div>
                <div className={styles.sectionIntro}>
                  <div className={`${styles.eyebrow} ${styles.eyebrowBlue}`}>
                    Uma solução para o dia a dia
                  </div>
                  <h2>Contratar estágio pode ser simples, seguro e estratégico.</h2>
                  <p>
                    Da primeira necessidade de contratação até a documentação, sua
                    empresa conta com suporte para avançar com mais segurança.
                  </p>
                </div>
                <div className={styles.reasonGrid}>
                  <article className={styles.reasonCard}>
                    <div className={styles.reasonNumber}>01</div>
                    <h3>Reduza o custo da contratação</h3>
                    <p>
                      Monte uma equipe mais eficiente com uma estrutura de
                      investimento compatível com o momento do negócio.
                    </p>
                  </article>
                  <article className={styles.reasonCard}>
                    <div className={styles.reasonNumber}>02</div>
                    <h3>Encontre novos talentos</h3>
                    <p>
                      Tenha acesso a estudantes de áreas administrativas,
                      atendimento, marketing e outras funções.
                    </p>
                  </article>
                  <article className={styles.reasonCard}>
                    <div className={styles.reasonNumber}>03</div>
                    <h3>Forme profissionais</h3>
                    <p>
                      Desenvolva pessoas dentro da cultura da empresa e crie uma
                      base para futuras contratações.
                    </p>
                  </article>
                  <article className={styles.reasonCard}>
                    <div className={styles.reasonNumber}>04</div>
                    <h3>Conte com acompanhamento</h3>
                    <p>
                      Receba apoio na seleção, nos documentos e nas etapas
                      necessárias para formalizar o estágio.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </section>

          <section
            className={`${styles.section} ${styles.process}`}
            id="como-funciona"
          >
            <div className={`${styles.container} ${styles.processGrid}`}>
              <div>
                <div className={`${styles.eyebrow} ${styles.eyebrowBlue}`}>
                  Como funciona
                </div>
                <h2>
                  Você informa o perfil. A gente ajuda a encontrar a pessoa certa.
                </h2>
                <p className={styles.processCopy}>
                  Um processo pensado para economizar tempo da sua equipe e deixar
                  a contratação mais organizada.
                </p>
                <ol className={styles.steps}>
                  <li className={styles.step}>
                    <span className={styles.stepNumber}>01</span>
                    <div>
                      <strong>Conte o que sua empresa precisa</strong>
                      <span>Área, rotina, horário, bolsa e perfil da vaga.</span>
                    </div>
                  </li>
                  <li className={styles.step}>
                    <span className={styles.stepNumber}>02</span>
                    <div>
                      <strong>Receba candidatos alinhados</strong>
                      <span>
                        Divulgação e triagem para aproximar você dos talentos.
                      </span>
                    </div>
                  </li>
                  <li className={styles.step}>
                    <span className={styles.stepNumber}>03</span>
                    <div>
                      <strong>Formalize com apoio</strong>
                      <span>
                        Documentação, seguro obrigatório e acompanhamento do
                        estágio.
                      </span>
                    </div>
                  </li>
                </ol>
              </div>
              <div className={styles.processPhoto}>
                <img
                  src="/escritorios/escritorio-lideranca.png"
                  alt="Empresária conversando com uma pessoa em um escritório"
                />
                <div className={styles.processCaption}>
                  <strong>Uma equipe preparada para crescer.</strong>
                  <span>
                    Contrate com mais clareza e cuide do desenvolvimento do próximo
                    talento.
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.economy}>
            <div className={`${styles.container} ${styles.economyGrid}`}>
              <div>
                <div className={`${styles.eyebrow} ${styles.eyebrowGold}`}>
                  Custo mais inteligente
                </div>
                <h2>Invista em talentos e preserve o caixa da sua empresa.</h2>
                <p className={styles.economyCopy}>
                  O estágio pode representar uma redução relevante no custo total
                  da contratação, quando comparado a uma vaga CLT, de acordo com a
                  jornada, a bolsa e os benefícios definidos.
                </p>
              </div>
              <div className={styles.economyCard}>
                <strong>Economia de até 70%*</strong>
                <p>
                  Uma referência de potencial de economia para empresas que
                  estruturam o estágio de forma adequada.
                </p>
                <div
                  className={styles.economyBar}
                  aria-label="Indicador visual de economia potencial"
                >
                  <span />
                </div>
                <div className={styles.economyFootnote}>
                  *A economia varia conforme cargo, jornada, bolsa, benefícios e
                  configuração da vaga.
                </div>
              </div>
            </div>
          </section>

          <section
            className={`${styles.section} ${styles.segments}`}
            id="segmentos"
          >
            <div className={styles.container}>
              <div className={styles.sectionIntro}>
                <div className={`${styles.eyebrow} ${styles.eyebrowBlue}`}>
                  Para diferentes negócios
                </div>
                <h2>
                  Encontre apoio para as áreas que fazem sua empresa acontecer.
                </h2>
                <p>
                  Do primeiro atendimento ao suporte administrativo, há estudantes
                  buscando uma oportunidade para contribuir e aprender.
                </p>
              </div>
              <div className={styles.segmentGrid}>
                <div className={styles.segment}>
                  <span className={styles.segmentIcon}>▦</span>
                  <strong>Administrativo</strong>
                </div>
                <div className={styles.segment}>
                  <span className={styles.segmentIcon}>◌</span>
                  <strong>Atendimento</strong>
                </div>
                <div className={styles.segment}>
                  <span className={styles.segmentIcon}>✦</span>
                  <strong>Marketing</strong>
                </div>
                <div className={styles.segment}>
                  <span className={styles.segmentIcon}>▣</span>
                  <strong>Comercial</strong>
                </div>
                <div className={styles.segment}>
                  <span className={styles.segmentIcon}>⌘</span>
                  <strong>Tecnologia</strong>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.cta} id="contato">
            <div className={`${styles.container} ${styles.ctaGrid}`}>
              <div>
                <div className={`${styles.eyebrow} ${styles.eyebrowGold}`}>
                  Próximo passo
                </div>
                <h2>Pronto para contratar seu próximo estagiário?</h2>
                <p>
                  Conte o que sua empresa precisa e receba orientação para abrir
                  uma vaga de estágio com mais rapidez e segurança.
                </p>
                <a
                  className={`${styles.button} ${styles.buttonGold}`}
                  href={WHATSAPP_BASE}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quero falar com a equipe
                </a>
              </div>

              <form className={styles.leadForm} onSubmit={handleSubmit}>
                <h3>Solicite atendimento</h3>
                {loading ? (
                  <p className={styles.formNote}>Carregando formulário...</p>
                ) : (
                  fields.map((field) => (
                    <div className={styles.field} key={field.id}>
                      <label htmlFor={field.name}>{field.label}</label>
                      {renderField(field)}
                    </div>
                  ))
                )}
                <button
                  className={`${styles.button} ${styles.formSubmit}`}
                  type="submit"
                  disabled={loading || submitting || !form}
                >
                  {submitting ? 'Enviando...' : 'Quero contratar'}
                </button>
                <div
                  className={`${styles.success} ${success ? styles.successShow : ''}`}
                  role="status"
                >
                  Seu pedido foi enviado.{' '}
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    Continuar pelo WhatsApp
                  </a>
                </div>
                {error ? <div className={styles.formError}>{error}</div> : null}
                <p className={styles.formNote}>
                  Atendimento para empresas de Brasília e entorno.
                </p>
              </form>
            </div>
            <p className={styles.legalNote}>
              *O estágio deve observar os requisitos da Lei nº 11.788/2008,
              incluindo termo de compromisso, compatibilidade das atividades e
              acompanhamento adequado. A economia varia conforme a configuração da
              vaga.
            </p>
          </section>
        </main>

        <footer className={styles.footer}>
          <div className={`${styles.container} ${styles.footerRow}`}>
            <a className={`${styles.brand} ${styles.footerBrand}`} href="#inicio">
              <img
                className={styles.brandLogo}
                src="/logo.png"
                alt="DF Estágios"
              />
            </a>
            <p>Conectando empresas a novos talentos.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
