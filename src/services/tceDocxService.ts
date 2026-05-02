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

function cnpjFormattedForDocx(value: string): string {
  if (!value) return '';
  return value
    .replace(/-/g, '\u2011')
    .replace(/\//g, '/\u2060');
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

const IE_ASSINATURA_PNG = '/templates/ie-assinatura-plataforma-aprenda.png';
const IE_ASSINATURA_FALLBACK_PNG = '/images/aprenda-mais-carimbo.png';

function zTrim(s: string | undefined): string {
  if (s === undefined || s === null) return '';
  return String(s).trim();
}

function resolveIeNomeContrato(p: TceContractPayload): string {
  return p.estudandoSim
    ? zTrim(p.instituicaoNome)
    : TCE_IE_DEFAULT_NOME;
}

function nomeMatchesPlataformaAprendaMaisMec(nome: string): boolean {
  const n = zTrim(nome)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/–/g, '-');
  return (
    n.includes('plataforma') &&
    n.includes('aprenda') &&
    n.includes('mec')
  );
}

function shouldShowIeAssinaturaCarimboAprenda(p: TceContractPayload): boolean {
  if (p.estudandoSim) return false;
  return nomeMatchesPlataformaAprendaMaisMec(resolveIeNomeContrato(p));
}

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
    empresa_cnpj_a: cnpjFormattedForDocx(ecnpj),
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
    ie_cnpj: cnpjFormattedForDocx(ieCnpj),
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
    est_uf: z(p.estagiarioUf),
    est_email: z(p.estagiarioEmail),
    est_rg_line_pad: '',
    est_cidade_pad_a: '',
    est_bairro_pad: ''
  };
}

function wordParagraphPlainText(paraXml: string): string {
  const parts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paraXml)) !== null) {
    parts.push(m[1]);
  }
  return parts.join('');
}

function wordRunPlainText(runXml: string): string {
  const parts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(runXml)) !== null) {
    parts.push(m[1]);
  }
  return parts.join('');
}

function stripIeCnpjRunsWhenNotStudying(documentXml: string): string {
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    if (
      !para.includes('Instituição de Ensino') ||
      !para.includes('CNPJ:')
    ) {
      return para;
    }
    return para.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
      const plain = wordRunPlainText(run);
      return plain.includes('CNPJ:') ? '' : run;
    });
  });
}

function stripIeReitorRunsWhenNotStudying(documentXml: string): string {
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (para) => {
    if (!para.includes('Reitor(a):')) {
      return para;
    }
    const runRe = /<w:r\b[\s\S]*?<\/w:r>/g;
    const runs = para.match(runRe);
    if (!runs?.length) {
      return para;
    }
    const keep = runs.map(() => true);
    for (let i = 0; i < runs.length; i++) {
      const plain = wordRunPlainText(runs[i]);
      if (!plain.includes('Reitor(a):')) {
        continue;
      }
      keep[i] = false;
      const nextPlain =
        i + 1 < runs.length ? wordRunPlainText(runs[i + 1]) : '';
      if (
        nextPlain.length > 0 &&
        nextPlain.length <= 6 &&
        /^\s*$/.test(nextPlain)
      ) {
        keep[i + 1] = false;
      }
      if (
        i > 0 &&
        /<w:br\b/.test(runs[i - 1]) &&
        wordRunPlainText(runs[i - 1]).trim() === ''
      ) {
        keep[i - 1] = false;
      }
    }
    let ri = 0;
    return para.replace(runRe, () => {
      const out = keep[ri] ? runs[ri] : '';
      ri += 1;
      return out;
    });
  });
}

function zeroSupervisorHeadingParagraphAfterSpacing(documentXml: string): string {
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (block) => {
    const text = wordParagraphPlainText(block).trim();
    if (text === 'Supervisor de Estágio' || text.startsWith('Nome: ')) {
      return block.replace(
        /(w:after=")\d+(")/,
        (_m, a: string, b: string) => `${a}0${b}`
      );
    }
    return block;
  });
}

const IE_ANCHOR_DOC_NAME = 'IE Assinatura';

function stripIeAssinaturaPlaceholderParagraph(documentXml: string): string {
  const token = '{%ie_assinatura}';
  const pos = documentXml.indexOf(token);
  if (pos < 0) {
    return documentXml;
  }
  const pStart = documentXml.lastIndexOf('<w:p ', pos);
  if (pStart < 0) {
    return documentXml;
  }
  const closeIdx = documentXml.indexOf('</w:p>', pos);
  if (closeIdx < 0) {
    return documentXml;
  }
  const pEnd = closeIdx + '</w:p>'.length;
  let next = pEnd;
  while (next < documentXml.length && /\s/.test(documentXml.charAt(next))) {
    next += 1;
  }
  return documentXml.slice(0, pStart) + documentXml.slice(next);
}

function applyIeAssinaturaAnchorOverlay(documentXml: string): string {
  const lab = '<w:t>Instituição de Ensino</w:t>';
  const labelIdx = documentXml.lastIndexOf(lab);
  if (labelIdx < 0) return documentXml;

  const beforeLabel = documentXml.slice(0, labelIdx);
  const drawingRe =
    /<w:drawing>\s*<wp:inline[^>]*>[\s\S]*?<\/wp:inline>\s*<\/w:drawing>/g;
  let match: RegExpExecArray | null;
  let lastDrawing: RegExpExecArray | null = null;
  while ((match = drawingRe.exec(beforeLabel)) !== null) {
    lastDrawing = match;
  }
  if (!lastDrawing || lastDrawing.index === undefined) return documentXml;

  const fullDrawing = lastDrawing[0];
  const extentM = fullDrawing.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
  if (!extentM) return documentXml;
  const cx = extentM[1];
  const cy = extentM[2];
  const graphicM = fullDrawing.match(/<a:graphic[\s\S]*?<\/a:graphic>/);
  if (!graphicM) return documentXml;
  const graphic = graphicM[0];

  const docPrId = String(Math.floor(Math.random() * 800000000) + 100000000);
  const cyNum = Number(cy);
  const posUp = -Math.min(Math.round(cyNum * 0.72), 980000);

  const anchorDrawing = `<w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251663360" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${String(
    posUp
  )}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${docPrId}" name="${IE_ANCHOR_DOC_NAME}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>${graphic}</wp:anchor></w:drawing>`;

  const out =
    documentXml.slice(0, lastDrawing.index) +
    anchorDrawing +
    documentXml.slice(lastDrawing.index + fullDrawing.length);

  const markIdx = out.indexOf(`name="${IE_ANCHOR_DOC_NAME}"`);
  if (markIdx < 0) return out;
  const pStart = out.lastIndexOf('<w:p ', markIdx);
  if (pStart < 0) return out;
  const pEnd = out.indexOf('</w:p>', markIdx);
  if (pEnd < 0) return out;
  const para = out.slice(pStart, pEnd + 6);
  const pPrM = para.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  if (!pPrM) return out;
  const inner = pPrM[1];
  const tightSpacing =
    '<w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/>';
  let newInner: string;
  if (/<w:spacing\b/.test(inner)) {
    newInner = inner.replace(/<w:spacing[^>]*\/>/, tightSpacing);
  } else {
    newInner = tightSpacing + inner;
  }
  const newPara = para.replace(
    /<w:pPr>[\s\S]*?<\/w:pPr>/,
    `<w:pPr>${newInner}</w:pPr>`
  );
  return out.slice(0, pStart) + newPara + out.slice(pEnd + 6);
}

export async function generateTceDocxBlob(
  payload: TceContractPayload
): Promise<Blob> {
  let ieLogoBytes: Uint8Array | null = null;
  if (shouldShowIeAssinaturaCarimboAprenda(payload)) {
    let logoRes = await fetch(IE_ASSINATURA_PNG);
    if (!logoRes.ok) {
      logoRes = await fetch(IE_ASSINATURA_FALLBACK_PNG);
    }
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
      return [300, 90];
    },
  });

  const res = await fetch('/templates/tce.docx');
  if (!res.ok) {
    throw new Error('Failed to load contract template');
  }
  const arrayBuffer = await res.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const showIeCarimbo =
    shouldShowIeAssinaturaCarimboAprenda(payload) &&
    Boolean(ieLogoBytes?.length);
  const docXmlEntry = zip.file('word/document.xml');
  if (docXmlEntry && !showIeCarimbo) {
    let preXml = docXmlEntry.asText();
    preXml = stripIeAssinaturaPlaceholderParagraph(preXml);
    zip.file('word/document.xml', preXml);
  }
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => ''
  });
  const textData = buildTemplateData(payload);
  doc.setData(
    showIeCarimbo
      ? { ...textData, ie_assinatura: true }
      : { ...textData }
  );
  doc.render();
  const outZip = doc.getZip();
  const docFile = outZip.file('word/document.xml');
  if (docFile) {
    let xml = docFile.asText();
    if (!payload.estudandoSim) {
      xml = stripIeCnpjRunsWhenNotStudying(xml);
      xml = stripIeReitorRunsWhenNotStudying(xml);
    }
    if (showIeCarimbo) {
      xml = applyIeAssinaturaAnchorOverlay(xml);
    }
    xml = zeroSupervisorHeadingParagraphAfterSpacing(xml);
    outZip.file('word/document.xml', xml);
  }
  const out = outZip.generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }) as Blob;
  return out;
}
