import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FiscalAmbiente, FiscalSettings } from '../types/fisqal';
import { DEFAULT_NFSE_SERVICO_CODE } from '../constants/nfseServicos';

const SETTINGS_DOC_ID = 'df-estagios';

const DEFAULT_SETTINGS: Omit<FiscalSettings, 'id' | 'updatedAt'> = {
  cnpjPrestador: '',
  codigoMunicipioEmissor: '',
  inscricaoMunicipalPrestador: '',
  defaultCodigoServico: DEFAULT_NFSE_SERVICO_CODE,
  serieDps: '900',
  nextNumeroDps: 1,
  fiscalAmbiente: 'producao',
};

function mapDoc(data: Record<string, unknown>): FiscalSettings {
  const updatedAtRaw = data.updatedAt;
  let updatedAt = new Date();
  if (
    updatedAtRaw &&
    typeof updatedAtRaw === 'object' &&
    'toDate' in updatedAtRaw &&
    typeof (updatedAtRaw as { toDate: () => Date }).toDate === 'function'
  ) {
    updatedAt = (updatedAtRaw as { toDate: () => Date }).toDate();
  }
  return {
    id: SETTINGS_DOC_ID,
    cnpjPrestador: String(data.cnpjPrestador ?? ''),
    codigoMunicipioEmissor: String(data.codigoMunicipioEmissor ?? ''),
    inscricaoMunicipalPrestador: data.inscricaoMunicipalPrestador
      ? String(data.inscricaoMunicipalPrestador)
      : undefined,
    defaultCodigoServico: String(
      data.defaultCodigoServico ?? DEFAULT_SETTINGS.defaultCodigoServico
    ),
    serieDps: String(data.serieDps ?? DEFAULT_SETTINGS.serieDps),
    nextNumeroDps: Number(data.nextNumeroDps ?? DEFAULT_SETTINGS.nextNumeroDps),
    fiscalAmbiente: (data.fiscalAmbiente as FiscalAmbiente) ?? 'producao',
    updatedAt,
  };
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function buildIdDps(
  codigoMunicipioEmissor: string,
  cnpjPrestador: string,
  serieDps: string,
  numeroDps: number
): string {
  const municipio = onlyDigits(codigoMunicipioEmissor).padStart(7, '0');
  const cnpj = onlyDigits(cnpjPrestador).padStart(14, '0');
  const serie = onlyDigits(serieDps).padStart(3, '0');
  const numero = String(numeroDps).padStart(11, '0');
  return `DPS${municipio}${cnpj}${serie}${numero}`;
}

export const fiscalSettingsService = {
  async get(): Promise<FiscalSettings> {
    const ref = doc(db, 'fiscalSettings', SETTINGS_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return {
        id: SETTINGS_DOC_ID,
        ...DEFAULT_SETTINGS,
        updatedAt: new Date(),
      };
    }
    return mapDoc(snap.data() as Record<string, unknown>);
  },

  async save(
    data: Omit<FiscalSettings, 'id' | 'updatedAt' | 'nextNumeroDps'> & {
      nextNumeroDps?: number;
    }
  ): Promise<void> {
    const ref = doc(db, 'fiscalSettings', SETTINGS_DOC_ID);
    const current = await this.get();
    await setDoc(
      ref,
      {
        cnpjPrestador: onlyDigits(data.cnpjPrestador),
        codigoMunicipioEmissor: onlyDigits(data.codigoMunicipioEmissor),
        inscricaoMunicipalPrestador: data.inscricaoMunicipalPrestador?.trim() || null,
        defaultCodigoServico: data.defaultCodigoServico.trim(),
        serieDps: data.serieDps.trim(),
        nextNumeroDps: data.nextNumeroDps ?? current.nextNumeroDps,
        fiscalAmbiente: data.fiscalAmbiente,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  },

  async reserveNextDps(): Promise<{
    numeroDps: string;
    serieDps: string;
    idDps: string;
    settings: FiscalSettings;
  }> {
    const ref = doc(db, 'fiscalSettings', SETTINGS_DOC_ID);
    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const data = snap.exists()
        ? mapDoc(snap.data() as Record<string, unknown>)
        : {
            id: SETTINGS_DOC_ID,
            ...DEFAULT_SETTINGS,
            updatedAt: new Date(),
          };

      const numero = data.nextNumeroDps;
      const numeroDps = String(numero);
      const idDps = buildIdDps(
        data.codigoMunicipioEmissor,
        data.cnpjPrestador,
        data.serieDps,
        numero
      );

      transaction.set(
        ref,
        {
          cnpjPrestador: data.cnpjPrestador || DEFAULT_SETTINGS.cnpjPrestador,
          codigoMunicipioEmissor:
            data.codigoMunicipioEmissor ||
            DEFAULT_SETTINGS.codigoMunicipioEmissor,
          defaultCodigoServico: data.defaultCodigoServico,
          serieDps: data.serieDps,
          nextNumeroDps: numero + 1,
          fiscalAmbiente: data.fiscalAmbiente,
          inscricaoMunicipalPrestador: data.inscricaoMunicipalPrestador ?? null,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

      return {
        numeroDps,
        serieDps: data.serieDps,
        idDps,
        settings: { ...data, nextNumeroDps: numero + 1 },
      };
    });
  },

  isComplete(settings: FiscalSettings): boolean {
    return (
      onlyDigits(settings.cnpjPrestador).length === 14 &&
      onlyDigits(settings.codigoMunicipioEmissor).length === 7 &&
      settings.defaultCodigoServico.trim().length > 0 &&
      settings.serieDps.trim().length > 0
    );
  },
};
