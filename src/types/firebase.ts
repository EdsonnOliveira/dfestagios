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
  createdAt: Date;
  updatedAt: Date;
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
  dataVencimento: string; // Dia do mês (1-31) ou formato antigo (YYYY-MM-DD) para compatibilidade
  valor: string;
  servico?: string; // Serviço prestado ao cliente
  status: 'ativo' | 'em-andamento' | 'bloqueado' | 'inativo';
  motivoStatus?: string; // Motivo da alteração de status
  estagiariosVinculados?: string[]; // Array de IDs dos estagiários vinculados
  createdAt: Date;
  updatedAt: Date;
}

export interface VinculacaoEstagiario {
  id?: string;
  clienteId: string;
  estagiarioId: string;
  dataVinculacao: Date;
  status: 'ativo' | 'inativo';
  createdAt: Date;
  updatedAt: Date;
}
