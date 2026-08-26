export interface Estagiario {
  id?: string;
  nome: string;
  nomeSocial?: string;
  sexo?: string;
  telefone1: string;
  telefone2?: string;
  dataNascimento?: string;
  email: string;
  cpf?: string;
  rg?: string;
  orgaoEmissor?: string;
  uf: string;
  cidade: string;
  bairro: string;
  cep?: string;
  endereco: string;
  complemento?: string;
  grauInstrucao: string;
  curso?: string;
  matricula?: string;
  horarioDisponivel?: string[];
  horarioEstudo?: string[];
  ingles?: string;
  frances?: string;
  espanhol?: string;
  informatica?: string[];
  aperfeicoamento?: string[];
  outrosCursos?: string;
  experiencias?: Array<{
    empresa: string;
    atribuicoes: string;
    entrada: string;
    saida: string;
  }>;
  status: 'ativo' | 'inativo';
  motivoInativacao?: string;
  contratoPdfDrivePath?: string;
  estagioDataInicio?: string;
  estagioValorBolsa?: string;
  estagioHorarioEntrada?: string;
  estagioHorarioSaida?: string;
  instituicaoEnsinoNome?: string;
  instituicaoEnsinoCnpj?: string;
  instituicaoCep?: string;
  instituicaoEndereco?: string;
  instituicaoTelefone?: string;
  instituicaoReitor?: string;
  respLegalNome?: string;
  respLegalCpf?: string;
  respLegalTelefone?: string;
  empresaFilialId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClienteFilial {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  cidade: string;
  bairro: string;
  cep: string;
  endereco?: string;
  uf?: string;
  responsavel: string;
  responsavelCargo?: string;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
}

export interface Grupo {
  id?: string;
  titulo: string;
  link: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cliente {
  id?: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  cidade: string;
  bairro: string;
  cep: string;
  responsavel: string;
  endereco?: string;
  uf?: string;
  responsavelCargo?: string;
  dataVencimento: string; // Dia do mês (1-31) ou formato antigo (YYYY-MM-DD) para compatibilidade
  valor: string;
  servico?: string; // Serviço prestado ao cliente
  status: 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo';
  motivoStatus?: string; // Motivo da alteração de status
  formaCaptacao?: FormaCaptacao | null;
  formaCaptacaoDetalhe?: string;
  estagiariosVinculados?: string[]; // Array de IDs dos estagiários vinculados
  filiais?: ClienteFilial[];
  termosAceite?: ClienteTermosAceite;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClienteTermosAceite {
  aceito: boolean;
  nomeSignatario: string;
  cargoSignatario?: string;
  emailSignatario?: string;
  aceitoEm: Date;
  userAgent?: string;
  pdfDrivePath?: string;
  versaoTermos: string;
}

export type FormaCaptacao =
  | 'instagram'
  | 'linkedin'
  | 'whatsapp'
  | 'trafego-pago'
  | 'site'
  | 'indicacao'
  | 'outro';

export const FORMA_CAPTACAO_OPTIONS: { value: FormaCaptacao; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'trafego-pago', label: 'Tráfego Pago' },
  { value: 'site', label: 'Site' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'outro', label: 'Outro' },
];

export const getFormaCaptacaoLabel = (value?: FormaCaptacao | null): string => {
  if (!value) return '-';
  return FORMA_CAPTACAO_OPTIONS.find((option) => option.value === value)?.label ?? value;
};

export interface VinculacaoEstagiario {
  id?: string;
  clienteId: string;
  estagiarioId: string;
  dataVinculacao: Date;
  status: 'ativo' | 'inativo';
  createdAt: Date;
  updatedAt: Date;
}

export type EstagiarioWithCompanyEntry = Estagiario & {
  companyEntryDate: Date | null;
};

export type EntrevistaTipoVaga = 'nova' | 'reposicao';

export type EntrevistaTipoEntrevista = 'presencial' | 'online' | 'captacao';

export type EntrevistaStatus = 'agendada' | 'realizada' | 'cancelada';

export type EntrevistaCandidatoStatus =
  | 'interessado'
  | 'selecionado'
  | 'contrato_pendente'
  | 'contrato_preenchido';

export interface Entrevista {
  id?: string;
  clienteId: string;
  filialId?: string;
  empresaNome: string;
  quantidadeVagas: number;
  tipoVaga: EntrevistaTipoVaga;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  googleMapsLink?: string;
  pontoReferencia?: string;
  responsavelEntrevista?: string;
  tipoEntrevista?: EntrevistaTipoEntrevista;
  dataCalendario?: string;
  dataEntrevista: string;
  horarioEntrevista: string;
  tituloVaga: string;
  horarioTrabalho: string;
  valorBolsa: string;
  beneficios?: string;
  atividades: string;
  requisitos: string;
  status: EntrevistaStatus;
  duplicatedFromId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntrevistaCandidato {
  id?: string;
  entrevistaId: string;
  clienteId: string;
  nome: string;
  telefone: string;
  status: EntrevistaCandidatoStatus;
  estagiarioId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClienteContratoLink {
  id?: string;
  clienteId: string;
  estagiarioId: string;
  nome: string;
  telefone: string;
  filialId?: string;
  status: EntrevistaCandidatoStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const ENTREVISTA_CANDIDATO_STATUS_LABELS: Record<
  EntrevistaCandidatoStatus,
  string
> = {
  interessado: 'Interessado',
  selecionado: 'Selecionado',
  contrato_pendente: 'Contrato pendente',
  contrato_preenchido: 'Contrato preenchido',
};
