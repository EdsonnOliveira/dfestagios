import Docxtemplater from 'docxtemplater';
import ImageModuleBase from 'docxtemplater-image-module-free';
import PizZip from 'pizzip';

type ImageModuleCtor = new (opts: {
  centered?: boolean;
  getImage: (tagValue: unknown, tagName: string) => Uint8Array;
  getSize: (
    img: Uint8Array,
    tagValue: unknown,
    tagName: string
  ) => [number, number];
}) => Docxtemplater.DXT.Module;

const ImageModule = ImageModuleBase as ImageModuleCtor;

export interface TceContractPayload {
  empresaRazaoSocial: string;
  empresaNomeFantasia: string;
  empresaCnpj: string;
  empresaCidade: string;
  empresaBairro: string;
  empresaCep: string;
  empresaEndereco: string;
  empresaUf: string;
  empresaTelefone: string;
  empresaEmail: string;
  empresaResponsavel: string;
  empresaRepresentanteCargo: string;
  estagiarioNome: string;
  estagiarioRg: string;
  estagiarioCpf: string;
  estagiarioDataNascimento: string;
  estagiarioEmail: string;
  estagiarioEndereco: string;
  estagiarioBairro: string;
  estagiarioCep: string;
  estagiarioCidade: string;
  estagiarioUf: string;
  estagiarioTelefone: string;
  estagioDataInicio: string;
  estagioHorarioEntrada: string;
  estagioHorarioSaida: string;
  estagioFuncao: string;
  estagioValorBolsa: string;
  estudandoSim: boolean;
  instituicaoCnpj: string;
  instituicaoNome: string;
  instituicaoCep: string;
  instituicaoEndereco: string;
  instituicaoTelefone: string;
  instituicaoReitor: string;
  respNome: string;
  respCpf: string;
  respTelefone: string;
  exigeResponsavel: boolean;
  menorDe18: boolean;
}

function formatDatePtBr(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d).toLocaleDateString('pt-BR');
}

function formatEndDateOneYearAfterStart(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const start = new Date(y, m, d);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return end.toLocaleDateString('pt-BR');
}

function stripCurrencyPrefixBrl(value: string): string {
  return value.replace(/^\s*R\$\s*/i, '').trim();
}

function resolveEmpresaUf(explicitUf: string, cidade: string): string {
  const u = explicitUf.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(u)) return u;
  const c = cidade.trim().toLowerCase();
  if (c.includes('brasília') || c.includes('brasilia')) return 'DF';
  return 'DF';
}

const TCE_IE_DEFAULT_NOME =
  'PLATAFORMA APRENDA MAIS (MEC) – GOVERNO FEDERAL';
const TCE_IE_DEFAULT_RAZAO_SOCIAL = 'Caixa escolar';
const TCE_IE_DEFAULT_TELEFONE = '0800 616161';
const TCE_IE_DEFAULT_CEP = '70047-900';

function buildTemplateData(p: TceContractPayload): Record<string, string> {
  const z = (s: string | undefined) =>
    s === undefined || s === null ? '' : String(s).trim();
  const ecnpj = z(p.empresaCnpj);
  const cid = z(p.empresaCidade);
  const empresaUfResolved = resolveEmpresaUf(p.empresaUf, cid);
  const rg = z(p.estagiarioRg);
  const cpf = z(p.estagiarioCpf);
  const periodo =
    p.estagioDataInicio
      ? `${formatDatePtBr(p.estagioDataInicio)} até ${formatEndDateOneYearAfterStart(
          p.estagioDataInicio
        )}`
      : '';
  const dataAssinatura = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
  const ieNomeDisplay = p.estudandoSim
    ? z(p.instituicaoNome)
    : TCE_IE_DEFAULT_NOME;
  const ieRazaoSocial = p.estudandoSim
    ? z(p.instituicaoNome)
    : TCE_IE_DEFAULT_RAZAO_SOCIAL;
  const ieCnpj = p.estudandoSim ? z(p.instituicaoCnpj) : '';
  const ieCep = p.estudandoSim ? z(p.instituicaoCep) : TCE_IE_DEFAULT_CEP;
  const ieTel = p.estudandoSim ? z(p.instituicaoTelefone) : TCE_IE_DEFAULT_TELEFONE;
  const ieReitor = p.estudandoSim ? z(p.instituicaoReitor) : '';
  const respNome = p.menorDe18 ? z(p.respNome) : '';
  const respTelefoneContrato = p.menorDe18 ? z(p.respTelefone) : '';
  const horarioEstagio =
    p.estagioHorarioEntrada && p.estagioHorarioSaida
      ? `${z(p.estagioHorarioEntrada)} às ${z(p.estagioHorarioSaida)}`
      : '';

  return {
    hdr_blank_a: '',
    hdr_blank_b: '',
    empresa_razao: z(p.empresaRazaoSocial),
    empresa_endereco: z(p.empresaEndereco),
    empresa_bairro: z(p.empresaBairro),
    spacer_pre_cidade_row: '',
    empresa_cep: z(p.empresaCep),
    empresa_cnpj_a: ecnpj,
    empresa_cnpj_b: '',
    empresa_telefone: z(p.empresaTelefone),
    empresa_cargo: z(p.empresaRepresentanteCargo) || 'Proprietário(a)',
    empresa_responsavel: z(p.empresaResponsavel),
    empresa_rep_extra: '',
    empresa_uf: empresaUfResolved,
    empresa_cidade_line: cid,
    empresa_cidade_tail: '',
    ie_nome_display: ieNomeDisplay,
    ie_razao_social: ieRazaoSocial,
    ie_razao_extra: '',
    ie_telefone: ieTel,
    ie_reitor: ieReitor,
    ie_cep: ieCep,
    ie_cnpj: ieCnpj,
    est_nome: z(p.estagiarioNome),
    est_row_spacer_17: '',
    est_row_spacer_18: '',
    est_data_nascimento: formatDatePtBr(p.estagiarioDataNascimento),
    est_telefone: z(p.estagiarioTelefone),
    resp_legal_nome: respNome,
    resp_telefone_contrato: respTelefoneContrato,
    resp_cpf_contrato: p.menorDe18 ? z(p.respCpf) : '',
    est_rg: rg,
    est_rg_spacer_23: '',
    est_cpf_spacer_24: '',
    est_cpf: cpf,
    est_endereco: z(p.estagiarioEndereco),
    est_bairro: z(p.estagiarioBairro),
    est_addr_spacer_28: '',
    est_addr_spacer_29: '',
    est_addr_spacer_30: z(p.estagiarioCidade),
    est_addr_spacer_31: '',
    est_cep: z(p.estagiarioCep),
    est_clause_spacer: '',
    estagio_periodo: periodo,
    est_horario_estagio: horarioEstagio,
    est_atividades: z(p.estagioFuncao),
    est_nacionalidade: 'Brasileira',
    bolsa_valor: stripCurrencyPrefixBrl(z(p.estagioValorBolsa)),
    seguro_spacer: '',
    apolice_numero: '',
    supervisor_nome: z(p.empresaResponsavel),
    supervisor_cargo: '',
    sup_spacer_40: '',
    sup_spacer_41: '',
    data_assinatura: dataAssinatura,
    est_uf: z(p.estagiarioUf),
    est_email: z(p.estagiarioEmail),
    est_rg_line_pad: '',
    est_cidade_pad_a: '',
    est_bairro_pad: ''
  };
}

const IE_ASSINATURA_PNG = '/templates/ie-assinatura-plataforma-aprenda.png';

export async function generateTceDocxBlob(
  payload: TceContractPayload
): Promise<Blob> {
  let ieLogoBytes: Uint8Array | null = null;
  if (!payload.estudandoSim) {
    const logoRes = await fetch(IE_ASSINATURA_PNG);
    if (logoRes.ok) {
      ieLogoBytes = new Uint8Array(await logoRes.arrayBuffer());
    }
  }

  const imageModule = new ImageModule({
    centered: true,
    getImage(tagValue: unknown) {
      if (!tagValue || !ieLogoBytes?.length) {
        return new Uint8Array();
      }
      return ieLogoBytes;
    },
    getSize() {
      return [260, 72];
    },
  });

  const res = await fetch('/templates/tce.docx');
  if (!res.ok) {
    throw new Error('Failed to load contract template');
  }
  const arrayBuffer = await res.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => ''
  });
  const textData = buildTemplateData(payload);
  doc.setData({
    ...textData,
    ie_assinatura:
      !payload.estudandoSim && ieLogoBytes && ieLogoBytes.length > 0
        ? true
        : null,
  });
  doc.render();
  const out = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }) as Blob;
  return out;
}
