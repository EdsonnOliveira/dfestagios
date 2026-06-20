import { Cliente } from '../types/firebase';
import { CreateNfseDpsDto, FiscalSettings } from '../types/fisqal';
import { onlyDigits } from '../services/fiscalSettingsService';

export function parseValorServico(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getDefaultCompetencia(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function buildEmitNfsePayload(
  settings: FiscalSettings,
  cliente: Cliente,
  input: {
    dataCompetencia: string;
    valorServico: number;
    codigoServico: string;
    discriminacao: string;
    numeroDps: string;
    serieDps: string;
    idDps: string;
    companyId: string;
  }
): CreateNfseDpsDto {
  return {
    companyId: input.companyId,
    idDps: input.idDps,
    serieDps: input.serieDps,
    numeroDps: input.numeroDps,
    codigoMunicipioEmissor: onlyDigits(settings.codigoMunicipioEmissor),
    tipoInscricaoPrestador: '2',
    inscricaoFederalPrestador: onlyDigits(settings.cnpjPrestador),
    ...(settings.inscricaoMunicipalPrestador?.trim()
      ? {
          inscricaoMunicipalPrestador: settings.inscricaoMunicipalPrestador.trim(),
        }
      : {}),
    dataCompetencia: input.dataCompetencia,
    tomador: {
      tipoInscricao: '2',
      inscricaoFederal: onlyDigits(cliente.cnpj),
      razaoSocial: cliente.razaoSocial,
      email: cliente.email,
    },
    servico: {
      codigoServico: input.codigoServico,
      municipioIncidencia: onlyDigits(settings.codigoMunicipioEmissor),
      discriminacao: input.discriminacao,
    },
    valores: {
      valorServico: input.valorServico,
    },
  };
}

export function nfseStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Processando';
    case 'authorized':
      return 'Autorizada';
    case 'rejected':
      return 'Rejeitada';
    case 'cancelled':
      return 'Cancelada';
    case 'cancel_pending':
      return 'Cancelamento pendente';
    default:
      return status;
  }
}

export function nfseStatusClass(status: string): string {
  switch (status) {
    case 'authorized':
      return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    case 'pending':
    case 'cancel_pending':
      return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    case 'rejected':
      return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
    case 'cancelled':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    default:
      return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
  }
}
