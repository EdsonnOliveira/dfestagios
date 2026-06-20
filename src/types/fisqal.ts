export type FiscalAmbiente = 'homologacao' | 'producao';

export type NfseStatus =
  | 'pending'
  | 'authorized'
  | 'rejected'
  | 'cancelled'
  | 'cancel_pending'
  | string;

export interface FisqalCertificate {
  id: string;
  nome: string;
  certificado_tipo?: string;
  thumbprint?: string;
  valido_de?: string;
  valido_ate?: string;
  status: string;
  created_at?: string;
}

export interface CertificateUploadResponse {
  id: string;
  nome: string;
  status: string;
}

export interface CertificateTestResponse {
  valid: boolean;
  message: string;
  signatureTestPassed: boolean;
  communicationTestPassed: boolean;
}

export interface NfseTomadorDto {
  tipoInscricao: string;
  inscricaoFederal: string;
  razaoSocial: string;
  email: string;
}

export interface NfseServicoDto {
  codigoServico: string;
  municipioIncidencia: string;
  discriminacao: string;
}

export interface NfseValoresDto {
  valorServico: number;
}

export interface CreateNfseDpsDto {
  companyId: string;
  idDps: string;
  serieDps: string;
  numeroDps: string;
  codigoMunicipioEmissor: string;
  tipoInscricaoPrestador: string;
  inscricaoFederalPrestador: string;
  inscricaoMunicipalPrestador?: string;
  dataCompetencia: string;
  tomador: NfseTomadorDto;
  servico: NfseServicoDto;
  valores: NfseValoresDto;
}

export interface EmitNfseResponse {
  dpsId: string;
  status: string;
  fiscalRequestId?: string;
}

export interface NfseStatusTimeline {
  dpsId: string;
  status: NfseStatus;
  chaveAcesso?: string;
  logs: {
    level: string;
    message: string;
    context?: Record<string, string>;
    createdAt: string;
  }[];
}

export interface MunicipioCobertura {
  codigoMunicipioIbge: string;
  municipio: string;
  uf: string;
  provedor?: string;
  ambiente?: string;
  nacionalAderido?: boolean;
  nacionalEmissorNacional?: boolean;
  nacionalParametrizado?: boolean;
  podeEmitir: boolean;
  syncedAt?: string;
}

export interface NfseServiceStatus {
  online: boolean;
  message: string;
  durationMs?: number;
}

export interface CancelNfseDto {
  motivoCancelamento: string;
}

export interface CancelNfseResponse {
  cancelamentoId: string;
  status: string;
}

export interface FiscalSettings {
  id: string;
  cnpjPrestador: string;
  codigoMunicipioEmissor: string;
  inscricaoMunicipalPrestador?: string;
  defaultCodigoServico: string;
  serieDps: string;
  nextNumeroDps: number;
  fiscalAmbiente: FiscalAmbiente;
  updatedAt: Date;
}

export interface NfseEmission {
  id?: string;
  clienteId: string;
  dpsId: string;
  status: NfseStatus;
  numeroDps: string;
  serieDps: string;
  dataCompetencia: string;
  valorServico: number;
  chaveAcesso?: string;
  discriminacao?: string;
  createdAt: Date;
  updatedAt: Date;
}
