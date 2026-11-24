import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { isStudentAccountEmail } from '../lib/studentAuth';
import { buildStudentInternships, buildStudentInterviews, formatIsoDate, type StudentInternship, type StudentInterview } from '../lib/studentPortal';
import { vacancyLocation, vacancyWhatsAppUrl } from '../lib/publicVacancies';
import { usePublicVacancies } from '../components/PublicVacancies';
import { authService, clientesService, estagiariosService, entrevistaCandidatosService, entrevistasService, vinculacoesService } from '../services/firebase';
import { relatorioAdministrativoService } from '../services/relatorioAdministrativoService';
import { driveStorageService } from '../services/driveStorageService';
import { downloadInternshipCertificate } from '../services/certificadoEstagioService';
import type { Cliente, Entrevista, Estagiario } from '../types/firebase';
import PublicIcon, { type PublicIconName } from '../components/PublicIcon';

type Tab = 'inicio' | 'vagas' | 'candidaturas' | 'estagios' | 'perfil';
type AreaEstudanteProps = { initialTab?: Tab };
type TcePreview = { kind: 'pdf'; url: string } | { kind: 'docx'; blob: Blob };
const tabs: { id: Tab; label: string; icon: PublicIconName; href: string }[] = [
  { id: 'inicio', label: 'Início', icon: 'home', href: '/area-estudante' },
  { id: 'vagas', label: 'Vagas disponíveis', icon: 'briefcase', href: '/vagas-disponiveis' },
  { id: 'candidaturas', label: 'Minhas candidaturas', icon: 'file', href: '/minhas-candidaturas' },
  { id: 'estagios', label: 'Meus estágios', icon: 'briefcase', href: '/meus-estagios' },
  { id: 'perfil', label: 'Meu perfil', icon: 'user', href: '/meu-perfil' },
];


function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-7"><h1 className="text-3xl font-extrabold tracking-tight text-[#0b174c] sm:text-4xl">{title}</h1><p className="mt-1 text-[#71809a]">{subtitle}</p></div>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'rounded-2xl border border-[#e7edf5] bg-white p-6 shadow-[0_9px_30px_#1b41700d] ' + className}>{children}</div>;
}

export default function AreaEstudante({ initialTab = 'inicio' }: AreaEstudanteProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { vacancies, loading: vacanciesLoading, error: vacanciesError } = usePublicVacancies();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<Estagiario | null>(null);
  const [internships, setInternships] = useState<StudentInternship[]>([]);
  const [interviews, setInterviews] = useState<StudentInterview[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedVacancy, setSelectedVacancy] = useState<Entrevista | null>(null);
  const [tcePreview, setTcePreview] = useState<TcePreview | null>(null);
  const [documentError, setDocumentError] = useState('');
  const [generatingCertificate, setGeneratingCertificate] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    const requested = router.query.aba;
    if (typeof requested === 'string' && tabs.some((item) => item.id === requested)) {
      setTab(requested as Tab);
    } else if (!requested) {
      setTab(initialTab);
    }
  }, [initialTab, router.isReady, router.query.aba]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void router.replace('/acesso-estudante');
      return;
    }
    if (!isStudentAccountEmail(user.email)) {
      void router.replace('/painel');
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const ownProfile = await estagiariosService.getById(user.uid);
        if (!ownProfile) throw new Error('Cadastro não encontrado.');
        if (!active) return;
        setProfile(ownProfile);
        const matches = await estagiariosService.getByCpf(ownProfile.cpf ?? '').catch(() => [ownProfile]);
        const records = Array.from(new Map([ownProfile, ...matches].filter((item) => item.id).map((item) => [item.id!, item])).values());
        const histories = await Promise.all(records.map(async (record) => {
          const [links, events] = await Promise.all([
            vinculacoesService.getByEstagiarioId(record.id!),
            relatorioAdministrativoService.getByEstagiarioId(record.id!),
          ]);
          return { record, links, events };
        }));
        const clientIds = [...new Set(histories.flatMap(({ links, events }) => [
          ...links.map((link) => link.clienteId),
          ...events.map((event) => event.clienteId),
        ]))];
        const clients = (await Promise.all(clientIds.map((id) => clientesService.getById(id)))).filter((item): item is Cliente => item !== null);
        const history = histories.flatMap(({ record, links, events }) => buildStudentInternships(record, links, events, clients));
        const candidates = await entrevistaCandidatosService.getByTelefone(ownProfile.telefone1);
        const interviewIds = [...new Set(candidates.map((candidate) => candidate.entrevistaId))];
        const interviewData = (await Promise.all(interviewIds.map((id) => entrevistasService.getById(id)))).filter((item): item is Entrevista => item !== null);
        if (!active) return;
        setInternships(history);
        setInterviews(buildStudentInterviews(candidates, interviewData, ownProfile.telefone1));
      } catch (cause) {
        if (active) setDataError(cause instanceof Error ? cause.message : 'Não foi possível carregar seus dados.');
      } finally {
        if (active) setLoadingData(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user, loading, router]);

  const activeInternships = internships.filter((item) => item.active);
  const pastInternships = internships.filter((item) => !item.active);
  const upcomingInterviews = interviews.filter((item) => !item.past);
  const pastInterviews = interviews.filter((item) => item.past);
  const filteredVacancies = useMemo(() => vacancies.filter((item) => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return !term || [item.tituloVaga, item.bairro, item.cidade, item.atividades, item.requisitos].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term));
  }), [vacancies, search]);

  function selectTab(next: Tab) {
    setTab(next);
    const destination = tabs.find((item) => item.id === next)?.href ?? '/area-estudante';
    void router.push(destination);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function openTce(path: string) {
    setDocumentError('');
    try {
      const blob = await driveStorageService.getFileBlob(path);
      if (path.toLowerCase().endsWith('.docx')) {
        setTcePreview({ kind: 'docx', blob });
      } else {
        setTcePreview({ kind: 'pdf', url: URL.createObjectURL(blob) });
      }
    } catch {
      setDocumentError('Não foi possível abrir o TCE agora.');
    }
  }

  function closeTce() {
    if (tcePreview?.kind === 'pdf') URL.revokeObjectURL(tcePreview.url);
    setTcePreview(null);
  }

  async function issueCertificate(internship: StudentInternship) {
    if (!profile || !internship.client) return;
    setDocumentError('');
    setGeneratingCertificate(internship.id);
    try {
      await downloadInternshipCertificate(profile, internship, internship.client);
    } catch (cause) {
      setDocumentError(cause instanceof Error ? cause.message : 'Não foi possível emitir o certificado.');
    } finally {
      setGeneratingCertificate('');
    }
  }

  if (loading || !user || !isStudentAccountEmail(user.email)) return <div className="grid min-h-screen place-items-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#f4f9ff] text-[#0b174c]">
      <header className="border-b border-[#e6edf6] bg-white">
        <div className="mx-auto flex min-h-[98px] max-w-[1510px] items-center gap-7 px-6">
          <Link href="/" aria-label="DF Estágios — página inicial" className="shrink-0"><Image src="/logo.png" alt="DF Estágios" width={244} height={105} className="h-auto w-[238px]" /></Link>
          <nav aria-label="Painel do estudante" className="mx-auto flex h-full items-stretch gap-1">
            {tabs.map((item) => <button key={item.id} type="button" onClick={() => selectTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={'flex items-center gap-2 border-b-[3px] px-3 text-[15px] font-semibold transition-colors ' + (tab === item.id ? 'border-[#0866e9] text-[#0866e9]' : 'border-transparent text-[#465978] hover:text-[#0866e9]')}><PublicIcon name={item.icon} size={21} />{item.label}</button>)}
          </nav>
          <div className="flex shrink-0 items-center gap-4">
            <button type="button" aria-label="Notificações" className="relative text-[#475d7c]"><PublicIcon name="bell" size={23} /></button>
            <span className="h-10 w-px bg-[#dfe7f1]" />
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0866e9] text-base font-extrabold text-white">{profile?.nome?.trim().slice(0, 2).toUpperCase() || '—'}</span>
            <button type="button" onClick={async () => { await authService.signOut(); await router.push('/acesso-estudante'); }} className="flex items-center gap-2 text-[15px] font-bold text-[#253858]">Olá, {profile?.nome?.split(' ')[0] || 'estudante'}<PublicIcon name="chevronDown" size={17} /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1510px] px-6 py-8">
        {dataError && <p role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">{dataError}</p>}
        {documentError && <p role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">{documentError}</p>}

        {tab === 'inicio' && <>
          <SectionTitle title={'Olá, ' + (profile?.nome?.split(' ')[0] || 'estudante') + '!'} subtitle="Acompanhe suas oportunidades, entrevistas e estágios em um só lugar." />
          <div className="grid gap-5 md:grid-cols-3">
            <Card className="p-6"><p className="text-sm text-[#6a7b96]">Vagas disponíveis</p><strong className="mt-2 block text-4xl text-[#0866e9]">{vacancies.length}</strong><button onClick={() => selectTab('vagas')} className="mt-4 font-bold text-[#0866e9]">Explorar vagas <span aria-hidden>→</span></button></Card>
            <Card className="p-6"><p className="text-sm text-[#6a7b96]">Entrevistas agendadas</p><strong className="mt-2 block text-4xl text-[#0866e9]">{upcomingInterviews.length}</strong><button onClick={() => selectTab('candidaturas')} className="mt-4 font-bold text-[#0866e9]">Ver candidaturas <span aria-hidden>→</span></button></Card>
            <Card className="p-6"><p className="text-sm text-[#6a7b96]">Estágios ativos</p><strong className="mt-2 block text-4xl text-[#0866e9]">{activeInternships.length}</strong><button onClick={() => selectTab('estagios')} className="mt-4 font-bold text-[#0866e9]">Meus estágios <span aria-hidden>→</span></button></Card>
          </div>
          <Card className="mt-6 !overflow-hidden !bg-[#0754c9] !p-0 text-white"><div className="grid min-h-[245px] items-center gap-6 px-8 py-8 md:grid-cols-[1fr_350px]"><div><h2 className="text-3xl font-extrabold">Seu futuro começa com uma oportunidade.</h2><p className="mt-3 max-w-xl text-lg text-blue-100">Mantenha seu perfil atualizado e aumente suas chances de encontrar uma vaga compatível.</p><button onClick={() => selectTab('perfil')} className="mt-6 rounded-lg bg-white px-6 py-3 font-bold text-[#0754c9]">Atualizar meu perfil <span aria-hidden>→</span></button></div><Image src="/panel-future.png" alt="" width={420} height={275} className="hidden w-full md:block" /></div></Card>
        </>}

        {tab === 'vagas' && <>
          <SectionTitle title="Encontre sua próxima oportunidade" subtitle="Explore as vagas disponíveis e candidate-se às que combinam com você." />
          <div className="mb-3 flex gap-3"><div className="flex flex-1 items-center gap-3 rounded-xl border border-[#dce7f3] bg-white px-5 py-3 shadow-sm"><PublicIcon name="search" size={23} className="text-[#50698d]" /><input aria-label="Buscar vagas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cargo, área ou palavra-chave" className="w-full outline-none placeholder:text-[#9aa7b9]" /></div><button className="rounded-xl bg-[#0866e9] px-8 font-bold text-white shadow-sm">Buscar vagas</button></div>
          <div className="mb-7 grid gap-3 rounded-xl border border-[#e2eaf3] bg-white p-3 shadow-sm md:grid-cols-4"><Filter label="Cidade" icon="mapPin" /><Filter label="Área de atuação" icon="briefcase" /><Filter label="Turno" icon="clock" /><Filter label="Modalidade" icon="monitor" /></div>
          {vacanciesLoading ? <p>Carregando vagas...</p> : vacanciesError ? <p>Não foi possível carregar as vagas agora.</p> : filteredVacancies.length === 0 ? <Card>Nenhuma vaga disponível no momento.</Card> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_445px]">
            <section><h2 className="text-3xl font-extrabold">Vagas disponíveis</h2><p className="mb-4 text-lg text-[#71809a]">Oportunidades para você</p>{filteredVacancies.map((vacancy, index) => <VacancyCard key={vacancy.id} vacancy={vacancy} isNew={index === 0} onDetails={() => setSelectedVacancy(vacancy)} />)}</section>
            <aside className="space-y-5"><Image src="/panel-future.png" alt="Seu futuro começa com uma oportunidade" width={560} height={365} className="-ml-12 w-[560px] max-w-none rounded-2xl" /><Card className="p-6"><div className="flex gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#edf6ff] text-[#0866e9]"><PublicIcon name="file" size={28} /></span><div><h3 className="text-xl font-extrabold">Minhas candidaturas</h3><p className="mt-1 text-[#71809a]">Acompanhe suas inscrições em um só lugar.</p><button onClick={() => selectTab('candidaturas')} className="mt-4 font-bold text-[#0866e9]">Ver candidaturas <span aria-hidden>→</span></button></div></div></Card></aside>
          </div>}
        </>}

        {tab === 'candidaturas' && <>
          <SectionTitle title="Minhas candidaturas" subtitle="Acompanhe suas inscrições, entrevistas agendadas e oportunidades anteriores." />
          <div className="mb-6 grid gap-4 md:grid-cols-3"><Stat icon="calendar" value={upcomingInterviews.length} label="Entrevistas agendadas" /><Stat icon="users" value={pastInterviews.length} label="Entrevistas realizadas" /><Stat icon="file" value={interviews.length} label="Candidaturas enviadas" /></div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_445px]"><section>
            <h2 className="mb-4 text-2xl font-extrabold">Próximas entrevistas</h2>
            {loadingData ? <p>Carregando...</p> : upcomingInterviews.length === 0 ? <Card>Nenhuma entrevista futura encontrada para seu telefone.</Card> : upcomingInterviews.map((item) => <InterviewCard key={item.candidate.id} item={item} />)}
            <h2 className="mb-4 mt-8 text-2xl font-extrabold">Histórico de entrevistas</h2>
            {pastInterviews.length === 0 ? <Card>Nenhuma entrevista passada.</Card> : pastInterviews.map((item) => <InterviewCard key={item.candidate.id} item={item} />)}
          </section><aside className="space-y-5"><Image src="/panel-interview.png" alt="Prepare-se para sua entrevista" width={500} height={453} className="-ml-6 w-[500px] max-w-none rounded-2xl" /><Card className="p-6"><h3 className="text-xl font-extrabold">Precisa de ajuda?</h3><p className="mt-2 text-[#71809a]">Fale com a equipe DF Estágios pelo WhatsApp.</p><a href="https://wa.me/5561998109169" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block font-bold text-[#0866e9]">Falar com a equipe <span aria-hidden>→</span></a></Card></aside></div>
        </>}

        {tab === 'estagios' && <>
          <SectionTitle title="Meus estágios" subtitle="Acompanhe os detalhes do seu estágio atual e consulte seu histórico." />
          {loadingData ? <p>Carregando...</p> : activeInternships.length === 0 ? <Card>Nenhum estágio ativo encontrado para seu CPF.</Card> : activeInternships.map((item) => <InternshipCard key={item.id} item={item} profile={profile} onTce={openTce} onCertificate={issueCertificate} generating={generatingCertificate === item.id} variant="active" />)}
          <div className="mb-4 mt-8 flex items-end justify-between"><div><h2 className="text-2xl font-extrabold">Histórico de estágios</h2><p className="text-[#71809a]">Consulte suas experiências anteriores.</p></div><span className="hidden items-center gap-2 text-sm text-[#71809a] sm:flex"><PublicIcon name="info" size={18} /> Estágios encerrados não estão mais ativos.</span></div>
          {pastInternships.length === 0 ? <Card>Nenhum estágio encerrado encontrado.</Card> : pastInternships.map((item) => <InternshipCard key={item.id} item={item} profile={profile} onTce={openTce} onCertificate={issueCertificate} generating={generatingCertificate === item.id} variant="past" />)}
        </>}

        {tab === 'perfil' && <>
          <SectionTitle title="Meu perfil" subtitle="Confira os dados informados no seu cadastro." />
          {profile ? <Card className="grid gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"><ProfileField label="Nome completo" value={profile.nome} /><ProfileField label="CPF" value={profile.cpf} /><ProfileField label="E-mail" value={profile.email} /><ProfileField label="Celular" value={profile.telefone1} /><ProfileField label="Cidade / UF" value={[profile.cidade, profile.uf].filter(Boolean).join(' / ')} /><ProfileField label="Endereço" value={[profile.endereco, profile.complemento].filter(Boolean).join(', ')} /><ProfileField label="Escolaridade" value={profile.grauInstrucao} /><ProfileField label="Curso" value={profile.curso || '—'} /><ProfileField label="Currículo" value={profile.curriculoNome || 'Não enviado'} /></Card> : <Card>Carregando perfil...</Card>}
        </>}
      </main>

      {selectedVacancy && <div role="dialog" aria-modal="true" aria-label="Detalhes da vaga" className="fixed inset-0 z-50 grid place-items-center bg-[#071c43a8] p-4" onClick={() => setSelectedVacancy(null)}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-between gap-4"><h2 className="text-2xl font-extrabold">{selectedVacancy.tituloVaga}</h2><button onClick={() => setSelectedVacancy(null)} aria-label="Fechar detalhes" className="text-2xl">×</button></div>
        <p className="mt-2 text-[#61718d]">{vacancyLocation(selectedVacancy)}</p>
        <div className="mt-5 space-y-4 text-[#334563]">
          <p><strong>Horário:</strong> {selectedVacancy.horarioTrabalho || 'A combinar'}</p>
          <p><strong>Bolsa:</strong> {selectedVacancy.valorBolsa || 'A combinar'}</p>
          {selectedVacancy.beneficios && <p><strong>Benefícios:</strong> {selectedVacancy.beneficios}</p>}
          <div><strong>Atividades</strong><p className="mt-1 whitespace-pre-line">{selectedVacancy.atividades}</p></div>
          <div><strong>Requisitos</strong><p className="mt-1 whitespace-pre-line">{selectedVacancy.requisitos}</p></div>
        </div>
        <a href={vacancyWhatsAppUrl(selectedVacancy)} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block rounded-lg bg-[#0866e9] px-5 py-3 font-bold text-white">Candidatar-se no WhatsApp →</a>
      </div></div>}

      {tcePreview && <div role="dialog" aria-modal="true" aria-label="Visualizar TCE" className="fixed inset-0 z-50 grid place-items-center bg-[#071c43cc] p-3" onClick={closeTce}><div className="flex h-[92vh] w-full max-w-5xl flex-col rounded-xl bg-white p-3" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between px-2 pb-2"><h2 className="font-bold">Visualizar TCE</h2><button onClick={closeTce} className="text-xl" aria-label="Fechar TCE">×</button></div>{tcePreview.kind === 'pdf' ? <iframe title="TCE do estágio" src={tcePreview.url + '#toolbar=0&navpanes=0'} referrerPolicy="no-referrer" className="min-h-0 flex-1 rounded-lg border border-[#dce7f3]" /> : <DocxPreview blob={tcePreview.blob} />}</div></div>}
    </div>
  );
}

function DocxPreview({ blob }: { blob: Blob }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const render = async () => {
      if (!container.current) return;
      try {
        const { renderAsync } = await import('docx-preview');
        if (active && container.current) await renderAsync(blob, container.current, container.current, { breakPages: true, renderHeaders: true, renderFooters: true });
      } catch {
        if (active) setError('Não foi possível visualizar este TCE.');
      }
    };
    void render();
    return () => { active = false; };
  }, [blob]);
  return <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#dce7f3] bg-[#e8eef5] p-4">{error ? <p role="alert" className="rounded-lg bg-white p-4 text-red-700">{error}</p> : <div ref={container} />}</div>;
}

function ProfileField({ label, value }: { label: string; value: string | undefined }) {
  return <div><span className="block text-sm text-[#6b7b95]">{label}</span><strong className="block break-words">{value || '—'}</strong></div>;
}

function Filter({ label, icon }: { label: string; icon: PublicIconName }) {
  return <button type="button" className="flex items-center justify-between gap-3 rounded-lg border border-[#e2eaf3] bg-white px-4 py-3 text-left text-[#405575]"><span className="flex items-center gap-3"><PublicIcon name={icon} size={21} className="text-[#50698d]" />{label}</span><PublicIcon name="chevronDown" size={17} /></button>;
}

function Stat({ icon, value, label }: { icon: PublicIconName; value: number; label: string }) {
  return <Card className="flex items-center gap-4 p-5"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#edf6ff] text-[#0866e9]"><PublicIcon name={icon} size={29} /></span><div><strong className="block text-3xl text-[#0866e9]">{value}</strong><p className="text-sm text-[#20365d]">{label}</p></div></Card>;
}

function VacancyCard({ vacancy, isNew, onDetails }: { vacancy: Entrevista; isNew: boolean; onDetails: () => void }) {
  return <Card className="mb-3 p-5"><div className="flex flex-wrap items-center gap-4"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#edf6ff] text-[#0866e9]"><PublicIcon name="briefcase" size={32} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-3">{isNew && <span className="rounded-md bg-[#f6d36c] px-3 py-1 text-xs font-extrabold uppercase text-[#101d35]">Nova</span>}<h3 className="truncate text-xl font-extrabold">{vacancy.tituloVaga}</h3></div><p className="mt-1 text-[#536680]">{vacancyLocation(vacancy)}</p><div className="mt-3 flex flex-wrap gap-2 text-sm text-[#415777]"><span className="rounded-lg bg-[#f0f6fd] px-3 py-2">{vacancy.valorBolsa || 'Bolsa a combinar'}</span><span className="rounded-lg bg-[#f0f6fd] px-3 py-2"><PublicIcon name="sun" size={15} className="mr-1 inline" />{vacancy.horarioTrabalho || 'A combinar'}</span><span className="rounded-lg bg-[#f0f6fd] px-3 py-2"><PublicIcon name="mapPin" size={15} className="mr-1 inline" />Presencial</span></div></div><div className="flex shrink-0 gap-3"><button onClick={onDetails} className="rounded-lg border border-[#0866e9] px-5 py-3 font-bold text-[#0866e9]">Ver detalhes</button><a href={vacancyWhatsAppUrl(vacancy)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#0866e9] px-5 py-3 font-bold text-white">Candidatar-se</a></div></div></Card>;
}

function InterviewCard({ item }: { item: StudentInterview }) {
  const { interview, past, daysRemaining } = item;
  return <Card className={'mb-3 p-5 ' + (!past ? 'border-l-[6px] border-l-[#0866e9]' : '')}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#edf6ff] text-[#0866e9]"><PublicIcon name="building" size={28} /></span><div><span className={'rounded-full px-3 py-1 text-xs font-bold ' + (past ? 'bg-[#eef1f4] text-[#61718d]' : 'bg-[#dff3ff] text-[#0866e9]')}>{interview.status === 'cancelada' ? 'Cancelada' : past ? 'Realizada' : 'Agendada'}</span><h3 className="mt-2 text-xl font-extrabold">{interview.tituloVaga}</h3><p className="text-[#60718d]">{interview.empresaNome}</p></div></div>{!past && daysRemaining !== null && <strong className="text-[#0866e9]">{daysRemaining === 0 ? 'É hoje' : 'Faltam ' + daysRemaining + ' dias'}</strong>}<button type="button" className="rounded-lg border border-[#0866e9] px-4 py-2 font-bold text-[#0866e9]"><PublicIcon name="eye" size={18} className="mr-2 inline" />Ver detalhes</button></div>
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#e9eef5] pt-4 text-sm text-[#4f6282]"><span><PublicIcon name="calendar" size={17} className="mr-1 inline text-[#0866e9]" />{formatIsoDate(interview.dataEntrevista)}</span><span><PublicIcon name="clock" size={17} className="mr-1 inline text-[#0866e9]" />{interview.horarioEntrevista}</span><span><PublicIcon name="mapPin" size={17} className="mr-1 inline text-[#0866e9]" />{interview.bairro}, {interview.cidade}/DF</span><span><PublicIcon name={interview.tipoEntrevista === 'online' ? 'monitor' : 'building'} size={17} className="mr-1 inline text-[#0866e9]" />{interview.tipoEntrevista === 'online' ? 'Online' : 'Presencial'}</span></div>
    {!past && <p className="mt-4 border-t border-[#e9eef5] pt-3 text-sm text-[#5d6f8a]"><PublicIcon name="info" size={17} className="mr-2 inline text-[#0866e9]" />Compareça com 10 minutos de antecedência.</p>}
  </Card>;
}

function formatInternshipSchedule(profile: Estagiario | null): string {
  const start = profile?.estagioHorarioEntrada?.trim();
  const end = profile?.estagioHorarioSaida?.trim();
  if (start && end) return start + ' às ' + end;
  return start || end || '—';
}

function InternshipCard({ item, profile, onTce, onCertificate, generating, variant }: { item: StudentInternship; profile: Estagiario | null; onTce: (path: string) => void; onCertificate: (item: StudentInternship) => void; generating: boolean; variant: 'active' | 'past' }) {
  const company = item.client;
  const role = profile?.curso?.trim() || 'Estágio';
  const scholarship = profile?.estagioValorBolsa?.trim() || '—';
  const schedule = formatInternshipSchedule(profile);
  if (variant === 'past') return <Card className="mb-3 !flex flex-wrap items-center gap-3 !p-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf6ff] text-[#0866e9]"><PublicIcon name="building" size={25} /></span><div className="min-w-[220px] flex-1"><h3 className="font-extrabold">{company?.nomeFantasia || company?.razaoSocial || 'Empresa não identificada'}</h3><p className="text-sm text-[#60718d]">{role}</p></div><div className="min-w-[220px] text-sm text-[#60718d]"><span>Período</span><strong className="ml-2 text-[#263b5f]">{formatIsoDate(item.startDate)} a {item.endDate ? formatIsoDate(item.endDate) : '—'}</strong></div><span className="rounded-full bg-[#eef1f4] px-4 py-2 text-xs font-bold text-[#66758d]">ENCERRADO</span>{item.tcePath && <button type="button" onClick={() => onTce(item.tcePath!)} className="rounded-lg border border-[#0866e9] px-4 py-2 font-bold text-[#0866e9]"><PublicIcon name="eye" size={18} className="mr-2 inline" />Visualizar TCE</button>}</Card>;
  return <Card className="mb-5 p-6"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_493px]"><div><span className="inline-flex items-center gap-2 rounded-full bg-[#dff7e7] px-4 py-2 text-xs font-bold text-[#187b3f]"><span className="h-2.5 w-2.5 rounded-full bg-[#1caf5c]" />ESTÁGIO ATIVO</span><h3 className="mt-4 text-2xl font-extrabold">Estágio atual</h3><div className="mt-5 flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-xl bg-[#edf6ff] text-[#0866e9]"><PublicIcon name="building" size={33} /></span><div><h4 className="text-2xl font-extrabold">{company?.nomeFantasia || company?.razaoSocial || 'Empresa não identificada'}</h4><p className="text-lg text-[#64738d]">{role}</p></div></div><div className="mt-6 grid gap-5 border-t border-[#e6edf5] pt-5 sm:grid-cols-2"><Detail icon="building" label="Empresa" value={company?.nomeFantasia || company?.razaoSocial || '—'} /><Detail icon="briefcase" label="Área / curso" value={role} /><Detail icon="clock" label="Horário" value={schedule} /><Detail icon="calendar" label="Início" value={formatIsoDate(item.startDate)} /><Detail icon="coins" label="Bolsa-auxílio" value={scholarship} /><Detail icon="chart" label="Situação" value="Ativo" accent /></div></div><div className="rounded-2xl bg-[#eaf5ff] p-6"><h3 className="flex items-center gap-3 text-xl font-extrabold"><PublicIcon name="file" size={27} className="text-[#0866e9]" />Documentos do estágio</h3>{item.tcePath ? <button type="button" onClick={() => onTce(item.tcePath!)} className="mt-5 w-full rounded-lg border-2 border-[#0866e9] bg-white px-4 py-3 font-bold text-[#0866e9]"><PublicIcon name="eye" size={19} className="mr-2 inline" />Visualizar TCE</button> : <p className="mt-5 text-sm text-[#78859b]">TCE ainda não disponível</p>}<div className="my-5 h-px bg-[#d2e4f4]" /><h3 className="flex items-center gap-3 text-xl font-extrabold"><PublicIcon name="file" size={27} className="text-[#0866e9]" />Certificado de estágio</h3>{item.certificateEligible ? <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#d8f7df] px-3 py-2 text-sm font-bold text-[#17803c]"><PublicIcon name="check" size={17} />Disponível após 6 meses</span> : <p className="mt-3 text-sm text-[#71809a]">Disponível após 6 meses de duração.</p>}<button type="button" disabled={!item.certificateEligible || !company || generating} onClick={() => onCertificate(item)} className="mt-4 w-full rounded-lg bg-[#0866e9] px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-[#a9b9cf]"><PublicIcon name="file" size={19} className="mr-2 inline" />{generating ? 'Emitindo...' : 'Emitir certificado'}</button><p className="mt-3 text-sm text-[#71809a]">Disponível para estágios com pelo menos 6 meses de duração.</p></div></div></Card>;
}

function Detail({ icon, label, value, accent = false }: { icon: PublicIconName; label: string; value: string; accent?: boolean }) {
  return <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf6ff] text-[#0866e9]"><PublicIcon name={icon} size={21} /></span><div><span className="block text-sm text-[#71809a]">{label}</span><strong className={accent ? 'text-[#17803c]' : ''}>{value}</strong></div></div>;
}
