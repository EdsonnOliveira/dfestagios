import {
  useEffect,
  useMemo,
  useState,
  FormEvent,
  useCallback,
  useRef,
  type FocusEvent,
} from 'react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { clientesService, estagiariosService, vinculacoesService } from '../services/firebase';
import {
  generateTceDocxBlob,
  type TceContractPayload
} from '../services/tceDocxService';
import { driveStorageService } from '../services/driveStorageService';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { fetchCnpjInstituicaoEnsino } from '../services/brasilApiCnpj';
import { fetchCepLookup } from '../services/viaCepService';
import type { Cliente, Estagiario } from '../types/firebase';
import {
  ESTAGIO_FUNCAO_OPTIONS,
  ESTAGIO_FUNCAO_OUTRA,
  resolveEstagioFuncao,
  splitEstagioFuncao,
} from '../constants/estagioFuncao';
import { formatBolsaInputFromDigits } from '../services/rescisaoCalcService';

type Studying = 'sim' | 'nao' | '';

type EducationLevel = '' | 'superior' | 'medio' | 'tecnico' | 'fundamental';

type EmpresaContratoDados = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  bairro: string;
  cep: string;
  endereco?: string;
  uf?: string;
  telefone: string;
  email: string;
  responsavel: string;
  responsavelCargo?: string;
};

interface FormState {
  nomeCompleto: string;
  rg: string;
  cpf: string;
  dataNascimento: string;
  email: string;
  enderecoCompleto: string;
  bairro: string;
  cep: string;
  telefone: string;
  dataInicioEstagio: string;
  horarioEntrada: string;
  horarioSaida: string;
  funcaoSelect: string;
  funcaoOutra: string;
  valorBolsa: string;
  estudando: Studying;
  nivelEnsino: EducationLevel;
  uniCnpj: string;
  uniNome: string;
  uniCep: string;
  uniEndereco: string;
  uniTelefone: string;
  uniReitor: string;
  respNome: string;
  respCpf: string;
  respTelefone: string;
  cidade: string;
  uf: string;
}

const initialForm: FormState = {
  nomeCompleto: '',
  rg: '',
  cpf: '',
  dataNascimento: '',
  email: '',
  enderecoCompleto: '',
  bairro: '',
  cep: '',
  telefone: '',
  dataInicioEstagio: '',
  horarioEntrada: '',
  horarioSaida: '',
  funcaoSelect: '',
  funcaoOutra: '',
  valorBolsa: '',
  estudando: '',
  nivelEnsino: '',
  uniCnpj: '',
  uniNome: '',
  uniCep: '',
  uniEndereco: '',
  uniTelefone: '',
  uniReitor: '',
  respNome: '',
  respCpf: '',
  respTelefone: '',
  cidade: '',
  uf: ''
};

function maskCpf(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function maskCep(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 5) return n;
  return `${n.slice(0, 5)}-${n.slice(5)}`;
}

function maskCnpj(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 14);
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`;
}

function maskPhone(value: string): string {
  const n = value.replace(/\D/g, '').slice(0, 11);
  if (n.length === 0) return '';
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function safeContractFileBaseName(fullName: string): string {
  const base = fullName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 72);
  return base || 'Contrato';
}

function formatBolsaBrlFromDigits(digits: string): string {
  if (!digits) return '';
  const numberValue = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numberValue);
}

const BOLSA_MAX_DIGITS = 12;

function parseBolsaToFormDisplay(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  const trimmed = raw.trim();
  const withoutCurrency = trimmed.replace(/^R\$\s?/i, '');
  if (/[a-zA-Z+]/.test(withoutCurrency)) {
    return '';
  }
  const digits = trimmed.replace(/\D/g, '').slice(0, BOLSA_MAX_DIGITS);
  if (digits.length > 0) {
    return formatBolsaBrlFromDigits(digits);
  }
  return '';
}

function isFreshContractLinkEstagiario(estagiario: Estagiario): boolean {
  return (
    !estagiario.cpf?.trim() &&
    !estagiario.rg?.trim() &&
    !estagiario.contratoPdfDrivePath?.trim() &&
    !estagiario.estagioDataInicio?.trim()
  );
}

function estagiarioToFormState(estagiario: Estagiario): FormState {
  if (isFreshContractLinkEstagiario(estagiario)) {
    return { ...initialForm };
  }
  const hasFuncao = Boolean(estagiario.curso?.trim());
  const { funcaoSelect, funcaoOutra } = hasFuncao
    ? splitEstagioFuncao(estagiario.curso ?? '')
    : { funcaoSelect: '', funcaoOutra: '' };
  const hasInstituicao = Boolean(
    estagiario.instituicaoEnsinoNome?.trim() ||
      estagiario.instituicaoEnsinoCnpj?.trim()
  );
  let estudando: Studying = '';
  let nivelEnsino: EducationLevel = '';
  if (hasInstituicao) {
    estudando = 'sim';
    const grau = estagiario.grauInstrucao?.toLowerCase() ?? '';
    if (
      grau === 'superior' ||
      grau === 'medio' ||
      grau === 'tecnico' ||
      grau === 'fundamental'
    ) {
      nivelEnsino = grau;
    }
  }

  return {
    ...initialForm,
    nomeCompleto: estagiario.nome ?? '',
    rg: estagiario.rg ?? '',
    cpf: estagiario.cpf ? maskCpf(estagiario.cpf) : '',
    dataNascimento: estagiario.dataNascimento ?? '',
    email: estagiario.email ?? '',
    enderecoCompleto: estagiario.endereco ?? '',
    bairro: estagiario.bairro ?? '',
    cep: estagiario.cep ? maskCep(estagiario.cep) : '',
    telefone: estagiario.telefone1 ? maskPhone(estagiario.telefone1) : '',
    dataInicioEstagio: estagiario.estagioDataInicio ?? '',
    horarioEntrada: estagiario.estagioHorarioEntrada ?? '',
    horarioSaida: estagiario.estagioHorarioSaida ?? '',
    funcaoSelect,
    funcaoOutra,
    valorBolsa: parseBolsaToFormDisplay(estagiario.estagioValorBolsa),
    estudando,
    nivelEnsino,
    uniCnpj: estagiario.instituicaoEnsinoCnpj
      ? maskCnpj(estagiario.instituicaoEnsinoCnpj)
      : '',
    uniNome: estagiario.instituicaoEnsinoNome ?? '',
    uniCep: estagiario.instituicaoCep ? maskCep(estagiario.instituicaoCep) : '',
    uniEndereco: estagiario.instituicaoEndereco ?? '',
    uniTelefone: estagiario.instituicaoTelefone
      ? maskPhone(estagiario.instituicaoTelefone)
      : '',
    uniReitor: estagiario.instituicaoReitor ?? '',
    respNome: estagiario.respLegalNome ?? '',
    respCpf: estagiario.respLegalCpf ? maskCpf(estagiario.respLegalCpf) : '',
    respTelefone: estagiario.respLegalTelefone
      ? maskPhone(estagiario.respLegalTelefone)
      : '',
    cidade: estagiario.cidade ?? '',
    uf: estagiario.uf ?? '',
  };
}

function grauInstrucaoFromForm(
  estudando: Studying,
  nivel: EducationLevel
): string {
  if (estudando !== 'sim') return 'medio';
  switch (nivel) {
    case 'superior':
      return 'superior';
    case 'medio':
      return 'medio';
    case 'tecnico':
      return 'tecnico';
    case 'fundamental':
      return 'fundamental';
    default:
      return 'medio';
  }
}

function calcularIdade(dataNascimento: string): number | null {
  if (!dataNascimento) return null;
  const partes = dataNascimento.split('-');
  if (partes.length !== 3) return null;
  const y = parseInt(partes[0], 10);
  const m = parseInt(partes[1], 10) - 1;
  const d = parseInt(partes[2], 10);
  const birth = new Date(y, m, d);
  const hoje = new Date();
  let idade = hoje.getFullYear() - birth.getFullYear();
  const md = hoje.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && hoje.getDate() < birth.getDate())) idade--;
  return idade;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#004085] dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100';

const readonlyFieldClass =
  'w-full min-h-[42px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-slate-600/50 text-gray-900 dark:text-gray-100 select-text whitespace-pre-wrap break-words';

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const reqMark = (
  <span className="text-red-600 dark:text-red-400" aria-hidden="true">
    *
  </span>
);

export default function FormularioContratoEstagio() {
  const router = useRouter();
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<Cliente | null>(null);
  const [selectedFilialId, setSelectedFilialId] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [loadingUniCnpj, setLoadingUniCnpj] = useState(false);
  const lastUniCnpjFetched = useRef<string>('');
  const [loadingCep, setLoadingCep] = useState(false);
  const lastCepFetched = useRef<string>('');

  useEffect(() => {
    if (!router.isReady) return;
    const cId =
      typeof router.query.clienteId === 'string'
        ? router.query.clienteId
        : Array.isArray(router.query.clienteId)
          ? router.query.clienteId[0]
          : '';
    const eId =
      typeof router.query.estagiarioId === 'string'
        ? router.query.estagiarioId
        : Array.isArray(router.query.estagiarioId)
          ? router.query.estagiarioId[0]
          : '';
    const fId =
      typeof router.query.filialId === 'string'
        ? router.query.filialId
        : Array.isArray(router.query.filialId)
          ? router.query.filialId[0]
          : '';
    if (!cId && !eId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [c, e] = await Promise.all([
          cId ? clientesService.getById(cId) : Promise.resolve(null),
          eId ? estagiariosService.getById(eId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (c) setEmpresa(c);
        if (e) {
          setForm(estagiarioToFormState(e));
          const savedFilialId = e.empresaFilialId?.trim() ?? '';
          const filialExists = Boolean(
            savedFilialId &&
              c?.filiais?.some((f) => f.id === savedFilialId)
          );
          setSelectedFilialId(filialExists ? savedFilialId : '');
        } else {
          const queryFilialExists = Boolean(
            fId && c?.filiais?.some((f) => f.id === fId)
          );
          setSelectedFilialId(queryFilialExists ? fId : '');
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.clienteId, router.query.estagiarioId, router.query.filialId]);

  const empresaContrato: EmpresaContratoDados | null = useMemo(() => {
    if (!empresa) return null;
    if (selectedFilialId) {
      const filial = empresa.filiais?.find((f) => f.id === selectedFilialId);
      if (filial) {
        return {
          razaoSocial: filial.razaoSocial,
          nomeFantasia: filial.nomeFantasia,
          cnpj: filial.cnpj,
          cidade: filial.cidade,
          bairro: filial.bairro,
          cep: filial.cep,
          endereco: filial.endereco,
          uf: filial.uf,
          telefone: filial.telefone,
          email: filial.email,
          responsavel: filial.responsavel,
          responsavelCargo: filial.responsavelCargo,
        };
      }
    }
    return {
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      cnpj: empresa.cnpj,
      cidade: empresa.cidade,
      bairro: empresa.bairro,
      cep: empresa.cep,
      endereco: empresa.endereco,
      uf: empresa.uf,
      telefone: empresa.telefone,
      email: empresa.email,
      responsavel: empresa.responsavel,
      responsavelCargo: empresa.responsavelCargo,
    };
  }, [empresa, selectedFilialId]);

  const idade = useMemo(() => calcularIdade(form.dataNascimento), [form.dataNascimento]);
  const formRef = useRef(form);
  formRef.current = form;

  const showUniFields = form.estudando === 'sim';
  const exigeReitorSuperior = form.nivelEnsino === 'superior';
  const mostrarCamposResponsavel = idade !== null && idade < 18;
  const obrigaResponsavelMenor16 = idade !== null && idade < 16;

  useEffect(() => {
    if (idade !== null && idade >= 18) {
      setForm((p) => ({ ...p, respNome: '', respCpf: '', respTelefone: '' }));
    }
  }, [idade]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const handleValorBolsaChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, BOLSA_MAX_DIGITS);
    setField('valorBolsa', formatBolsaInputFromDigits(digits));
  };

  const handleCepBlur = useCallback(async () => {
    const d = form.cep.replace(/\D/g, '');
    if (d.length !== 8) return;
    if (lastCepFetched.current === d) return;
    setLoadingCep(true);
    try {
      const data = await fetchCepLookup(d);
      if (!data) {
        lastCepFetched.current = '';
        toast.error('CEP não encontrado.');
        return;
      }
      lastCepFetched.current = d;
      setForm((p) => ({
        ...p,
        enderecoCompleto: data.enderecoCompleto,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf
      }));
    } catch {
      lastCepFetched.current = '';
      toast.error('Não foi possível consultar o CEP.');
    } finally {
      setLoadingCep(false);
    }
  }, [form.cep]);

  const handleUniCnpjBlur = useCallback(async (e: FocusEvent<HTMLInputElement>) => {
    const masked = maskCnpj(e.currentTarget.value);
    const digits = masked.replace(/\D/g, '');
    setForm((p) => ({ ...p, uniCnpj: masked }));
    if (digits.length !== 14) return;
    if (lastUniCnpjFetched.current === digits && formRef.current.uniNome.trim()) return;
    setLoadingUniCnpj(true);
    try {
      const data = await fetchCnpjInstituicaoEnsino(digits);
      if (!data) {
        lastUniCnpjFetched.current = '';
        setForm((p) => ({ ...p, uniNome: '', uniCep: '', uniEndereco: '' }));
        toast.error('CNPJ não encontrado. Verifique o número.');
        return;
      }
      lastUniCnpjFetched.current = digits;
      setForm((p) => ({
        ...p,
        uniNome: data.nome,
        uniCep: data.cep,
        uniEndereco: data.endereco
      }));
    } catch {
      lastUniCnpjFetched.current = '';
      setForm((p) => ({ ...p, uniNome: '', uniCep: '', uniEndereco: '' }));
      toast.error('Não foi possível consultar o CNPJ. Tente novamente.');
    } finally {
      setLoadingUniCnpj(false);
    }
  }, []);

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const missing: string[] = [];
    if (!form.nomeCompleto.trim()) missing.push('Nome completo');
    if (!form.rg.trim()) missing.push('RG');
    if (!form.cpf.trim()) missing.push('CPF');
    if (!form.dataNascimento) missing.push('Data de nascimento');
    if (!form.email.trim()) missing.push('E-mail');
    if (!form.enderecoCompleto.trim()) missing.push('Endereço completo');
    if (!form.bairro.trim()) missing.push('Bairro');
    if (!form.cep.trim()) missing.push('CEP');
    if (!form.telefone.trim()) missing.push('Telefone');
    if (!form.dataInicioEstagio) missing.push('Data de início do estágio');
    if (!form.horarioEntrada) missing.push('Horário de entrada');
    if (!form.horarioSaida) missing.push('Horário de saída');
    if (!form.funcaoSelect) missing.push('Função');
    else if (
      form.funcaoSelect === ESTAGIO_FUNCAO_OUTRA &&
      !form.funcaoOutra.trim()
    ) {
      missing.push('Função (descreva a função)');
    }
    if (!form.valorBolsa.trim()) missing.push('Valor da bolsa');
    if (!form.estudando) missing.push('Está estudando?');
    if (form.estudando === 'sim') {
      if (!form.nivelEnsino) missing.push('Nível de ensino');
      const uniTelDigits = form.uniTelefone.replace(/\D/g, '');
      if (uniTelDigits.length < 10) missing.push('Telefone da instituição de ensino');
      const cnpjDigits = form.uniCnpj.replace(/\D/g, '');
      if (cnpjDigits.length !== 14) missing.push('CNPJ da instituição de ensino');
      else if (!form.uniNome.trim())
        missing.push('Consulte o CNPJ da instituição (sair do campo para buscar)');
      if (form.nivelEnsino === 'superior' && !form.uniReitor.trim()) {
        missing.push('Nome do(a) reitor(a)');
    }
    }
    if (obrigaResponsavelMenor16) {
      if (!form.respNome.trim()) missing.push('Nome do responsável');
      if (!form.respCpf.trim()) missing.push('CPF do responsável');
      if (!form.respTelefone.trim()) missing.push('Telefone do responsável');
    }
    if (missing.length > 0) {
      toast.error(`Preencha: ${missing.join(', ')}.`);
      return;
    }

    const clienteIdRaw =
      typeof router.query.clienteId === 'string'
        ? router.query.clienteId
        : Array.isArray(router.query.clienteId)
          ? router.query.clienteId[0]
          : '';
    if (!clienteIdRaw || !empresa || !empresaContrato) {
      toast.error('Abra este formulário pelo link enviado pela empresa.');
      return;
    }

    const estagiarioIdEdit =
      typeof router.query.estagiarioId === 'string'
        ? router.query.estagiarioId
        : Array.isArray(router.query.estagiarioId)
          ? router.query.estagiarioId[0]
          : '';

    setSubmitting(true);
    try {
      const funcaoFinal = resolveEstagioFuncao(form.funcaoSelect, form.funcaoOutra);
      const cpfDigits = form.cpf.replace(/\D/g, '');
      const telDigits = form.telefone.replace(/\D/g, '');
      const cepDigits = form.cep.replace(/\D/g, '');
      const cidadeFinal = form.cidade.trim() || 'Brasília';
      const ufFinal = form.uf.trim() || 'DF';

      let empresaEnderecoContrato = empresaContrato.endereco?.trim() ?? '';
      if (!empresaEnderecoContrato) {
        const empresaCepDigits = empresaContrato.cep.replace(/\D/g, '');
        if (empresaCepDigits.length === 8) {
          const viaEmpresa = await fetchCepLookup(empresaCepDigits);
          if (viaEmpresa?.enderecoCompleto?.trim()) {
            empresaEnderecoContrato = viaEmpresa.enderecoCompleto.trim();
          }
        }
      }

      const contractPayload: TceContractPayload = {
        empresaRazaoSocial: empresaContrato.razaoSocial,
        empresaNomeFantasia: empresaContrato.nomeFantasia,
        empresaCnpj: empresaContrato.cnpj,
        empresaCidade: empresaContrato.cidade,
        empresaBairro: empresaContrato.bairro,
        empresaCep: empresaContrato.cep,
        empresaEndereco: empresaEnderecoContrato,
        empresaUf: empresaContrato.uf?.trim() ?? '',
        empresaTelefone: empresaContrato.telefone,
        empresaEmail: empresaContrato.email,
        empresaResponsavel: empresaContrato.responsavel,
        empresaRepresentanteCargo: empresaContrato.responsavelCargo?.trim() ?? '',
        estagiarioNome: form.nomeCompleto.trim(),
        estagiarioRg: form.rg.trim(),
        estagiarioCpf: form.cpf.trim(),
        estagiarioDataNascimento: form.dataNascimento,
        estagiarioEmail: form.email.trim(),
        estagiarioEndereco: form.enderecoCompleto.trim(),
        estagiarioBairro: form.bairro.trim(),
        estagiarioCep: form.cep.trim(),
        estagiarioCidade: cidadeFinal,
        estagiarioUf: ufFinal,
        estagiarioTelefone: form.telefone.trim(),
        estagioDataInicio: form.dataInicioEstagio,
        estagioHorarioEntrada: form.horarioEntrada,
        estagioHorarioSaida: form.horarioSaida,
        estagioFuncao: funcaoFinal,
        estagioValorBolsa: form.valorBolsa.trim(),
        estudandoSim: form.estudando === 'sim',
        instituicaoCnpj: form.uniCnpj.trim(),
        instituicaoNome: form.uniNome.trim(),
        instituicaoCep: form.uniCep.trim(),
        instituicaoEndereco: form.uniEndereco.trim(),
        instituicaoTelefone: form.uniTelefone.trim(),
        instituicaoReitor: exigeReitorSuperior ? form.uniReitor.trim() : '',
        respNome: form.respNome.trim(),
        respCpf: form.respCpf.trim(),
        respTelefone: form.respTelefone.trim(),
        exigeResponsavel: obrigaResponsavelMenor16,
        menorDe18: mostrarCamposResponsavel
      };

      const dadosEstagiario = {
        nome: form.nomeCompleto.trim(),
        rg: form.rg.trim(),
        cpf: cpfDigits,
        telefone1: telDigits,
        email: form.email.trim(),
        dataNascimento: form.dataNascimento,
        endereco: form.enderecoCompleto.trim(),
        bairro: form.bairro.trim(),
        cidade: cidadeFinal,
        uf: ufFinal,
        cep: cepDigits,
        grauInstrucao: grauInstrucaoFromForm(form.estudando, form.nivelEnsino),
        curso: funcaoFinal,
        status: 'ativo' as const,
        estagioDataInicio: form.dataInicioEstagio,
        estagioValorBolsa: form.valorBolsa.trim(),
        estagioHorarioEntrada: form.horarioEntrada.trim(),
        estagioHorarioSaida: form.horarioSaida.trim(),
        instituicaoEnsinoNome:
          form.estudando === 'sim' ? form.uniNome.trim() : '',
        instituicaoEnsinoCnpj:
          form.estudando === 'sim' ? form.uniCnpj.replace(/\D/g, '') : '',
        instituicaoCep:
          form.estudando === 'sim' ? form.uniCep.replace(/\D/g, '') : '',
        instituicaoEndereco:
          form.estudando === 'sim' ? form.uniEndereco.trim() : '',
        instituicaoTelefone:
          form.estudando === 'sim'
            ? form.uniTelefone.replace(/\D/g, '')
            : '',
        instituicaoReitor:
          form.estudando === 'sim' && exigeReitorSuperior
            ? form.uniReitor.trim()
            : '',
        respLegalNome: mostrarCamposResponsavel ? form.respNome.trim() : '',
        respLegalCpf: mostrarCamposResponsavel
          ? form.respCpf.replace(/\D/g, '')
          : '',
        respLegalTelefone: mostrarCamposResponsavel
          ? form.respTelefone.replace(/\D/g, '')
          : '',
        empresaFilialId: selectedFilialId || ''
      };

      let estagiarioIdResult: string;

      if (estagiarioIdEdit) {
        estagiarioIdResult = estagiarioIdEdit;
        await estagiariosService.update(
          estagiarioIdEdit,
          dadosEstagiario as Partial<Estagiario>
        );
        const clienteDoc = await clientesService.getById(clienteIdRaw);
        const ja =
          clienteDoc?.estagiariosVinculados?.includes(estagiarioIdEdit) ?? false;
        if (!ja) {
          await vinculacoesService.vincularEstagiario(
            clienteIdRaw,
            estagiarioIdEdit
          );
        }
      } else {
        estagiarioIdResult = await estagiariosService.add(
          dadosEstagiario as Omit<Estagiario, 'id' | 'createdAt' | 'updatedAt'>
        );
        await vinculacoesService.vincularEstagiario(
          clienteIdRaw,
          estagiarioIdResult
        );
      }

      const blob = await generateTceDocxBlob(contractPayload);
      const contractBase = safeContractFileBaseName(form.nomeCompleto.trim());
      const contractFile = new File(
        [blob],
        `${contractBase}_Contrato.docx`,
        {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      );

      if (getSupabaseBrowserClient()) {
        const anterior = await estagiariosService.getById(estagiarioIdResult);
        if (anterior?.contratoPdfDrivePath) {
          try {
            await driveStorageService.remove(anterior.contratoPdfDrivePath);
          } catch {
            void 0;
          }
        }
        const caminho = await driveStorageService.upload('contrato', contractFile);
        await estagiariosService.update(estagiarioIdResult, {
          contratoPdfDrivePath: caminho
        });
      }

      toast.success(
        estagiarioIdEdit
          ? 'Contrato atualizado com sucesso.'
          : 'Cadastro concluído com sucesso.'
      );
      if (user) {
        void router.push(
          `/cliente-detalhes?id=${encodeURIComponent(clienteIdRaw)}`
        );
      } else {
        void router.push('/');
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir o cadastro. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Formulário — Contrato de estágio | DF Estágios</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {loadError && (
            <p className="mb-4 text-sm text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
              Não foi possível carregar todos os dados automaticamente. Preencha o formulário manualmente.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-8">
            <header className="text-center space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#004085] dark:text-blue-400">
                📋 DADOS PARA CONTRATO DE ESTÁGIO
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Campos com <span className="text-red-600 dark:text-red-400">*</span> são obrigatórios.
              </p>
            </header>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-[#004085] dark:text-blue-400 border-b border-gray-200 dark:border-gray-600 pb-2">
                🏢 DADOS DA EMPRESA
              </h2>
              {empresa && empresaContrato ? (
                <>
                  <div>
                    <label className={labelClass} htmlFor="empresaUnidade">
                      Unidade / CNPJ do contrato {reqMark}
                    </label>
                    <select
                      id="empresaUnidade"
                      className={inputClass}
                      value={selectedFilialId}
                      onChange={(e) => setSelectedFilialId(e.target.value)}
                    >
                      <option value="">
                        Matriz — {empresa.nomeFantasia} ({empresa.cnpj})
                      </option>
                      {(empresa.filiais ?? []).map((filial) => (
                        <option key={filial.id} value={filial.id}>
                          Filial — {filial.nomeFantasia} ({filial.cnpj})
                        </option>
                      ))}
                    </select>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Razão social</dt>
                      <dd className="font-medium">{empresaContrato.razaoSocial}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Nome fantasia</dt>
                      <dd className="font-medium">{empresaContrato.nomeFantasia}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">CNPJ</dt>
                      <dd className="font-medium">{empresaContrato.cnpj}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Cidade</dt>
                      <dd className="font-medium">{empresaContrato.cidade}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Bairro</dt>
                      <dd className="font-medium">{empresaContrato.bairro}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">CEP</dt>
                      <dd className="font-medium">{empresaContrato.cep}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Telefone</dt>
                      <dd className="font-medium">{empresaContrato.telefone}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">E-mail</dt>
                      <dd className="font-medium break-all">{empresaContrato.email}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500 dark:text-gray-400">Responsável</dt>
                      <dd className="font-medium">{empresaContrato.responsavel}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Dados da empresa não carregados. Confirme o link enviado ou preencha junto à empresa.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-[#004085] dark:text-blue-400 border-b border-gray-200 dark:border-gray-600 pb-2">
                👤 DADOS PESSOAIS
              </h2>
              <div>
                <label className={labelClass} htmlFor="nomeCompleto">
                  Nome completo {reqMark}
                </label>
                <input
                  id="nomeCompleto"
                  className={inputClass}
                  value={form.nomeCompleto}
                  onChange={(e) =>
                    setField('nomeCompleto', e.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="rg">
                    RG {reqMark}
                  </label>
                  <input
                    id="rg"
                    className={inputClass}
                    value={form.rg}
                    onChange={(e) => setField('rg', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="cpf">
                    CPF {reqMark}
                  </label>
                  <input
                    id="cpf"
                    className={inputClass}
                    value={form.cpf}
                    onChange={(e) => setField('cpf', maskCpf(e.target.value))}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="dataNascimento">
                  Data de nascimento {reqMark}
                </label>
                <input
                  id="dataNascimento"
                  type="date"
                  className={inputClass}
                  value={form.dataNascimento}
                  onChange={(e) => setField('dataNascimento', e.target.value)}
                />
              </div>
              {mostrarCamposResponsavel && (
                <div className="space-y-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-4">
                  <p className="text-sm text-amber-900 dark:text-amber-200">
                    Como você é menor de 18 anos, informe abaixo os dados do responsável legal que constarão no
                    contrato. Menores de 16 anos devem preencher todos os campos (obrigatório por lei); de 16 a 17
                    anos o preenchimento é opcional, mas recomendado.
                  </p>
                  <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100 border-b border-amber-300/60 dark:border-amber-700 pb-2">
                    Responsável legal
                  </h3>
                  <div>
                    <label className={labelClass} htmlFor="respNome">
                      Nome completo do responsável {obrigaResponsavelMenor16 ? reqMark : null}
                    </label>
                    <input
                      id="respNome"
                      className={inputClass}
                    value={form.respNome}
                    onChange={(e) =>
                      setField('respNome', e.target.value.toUpperCase())
                    }
                      autoComplete="name"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass} htmlFor="respCpf">
                        CPF do responsável {obrigaResponsavelMenor16 ? reqMark : null}
                      </label>
                      <input
                        id="respCpf"
                        className={inputClass}
                        value={form.respCpf}
                        onChange={(e) => setField('respCpf', maskCpf(e.target.value))}
                        inputMode="numeric"
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor="respTelefone">
                        Telefone do responsável {obrigaResponsavelMenor16 ? reqMark : null}
                      </label>
                      <input
                        id="respTelefone"
                        className={inputClass}
                        value={form.respTelefone}
                        onChange={(e) => setField('respTelefone', maskPhone(e.target.value))}
                        inputMode="tel"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="email">
                  E-mail {reqMark}
                </label>
                <input
                  id="email"
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="cep">
                  CEP {reqMark}
                </label>
                <div className="relative max-w-xs">
                  <input
                    id="cep"
                    className={inputClass}
                    value={form.cep}
                    onChange={(e) => {
                      const masked = maskCep(e.target.value);
                      const digits = masked.replace(/\D/g, '');
                      setForm((p) => {
                        const next = { ...p, cep: masked };
                        if (digits.length < 8) {
                          lastCepFetched.current = '';
                        } else if (lastCepFetched.current && digits !== lastCepFetched.current) {
                          lastCepFetched.current = '';
                        }
                        return next;
                      });
                    }}
                    onBlur={() => void handleCepBlur()}
                    inputMode="numeric"
                    disabled={loadingCep}
                    autoComplete="postal-code"
                  />
                  {loadingCep && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#004085] border-t-transparent dark:border-blue-400" />
                  )}
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="enderecoCompleto">
                  Endereço completo {reqMark}
                </label>
                <input
                  id="enderecoCompleto"
                  className={inputClass}
                  value={form.enderecoCompleto}
                  onChange={(e) => setField('enderecoCompleto', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="bairro">
                  Bairro {reqMark}
                </label>
                <input
                  id="bairro"
                  className={inputClass}
                  value={form.bairro}
                  onChange={(e) => setField('bairro', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="telefone">
                  Telefone {reqMark}
                </label>
                <input
                  id="telefone"
                  className={inputClass}
                  value={form.telefone}
                  onChange={(e) => setField('telefone', maskPhone(e.target.value))}
                  inputMode="tel"
                />
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-[#004085] dark:text-blue-400 border-b border-gray-200 dark:border-gray-600 pb-2">
                💼 INFORMAÇÕES DO ESTÁGIO
              </h2>
              <div>
                <label className={labelClass} htmlFor="dataInicioEstagio">
                  Data de início {reqMark}
                </label>
                <input
                  id="dataInicioEstagio"
                  type="date"
                  className={inputClass}
                  value={form.dataInicioEstagio}
                  onChange={(e) => setField('dataInicioEstagio', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="horarioEntrada">
                    Horário de entrada {reqMark}
                  </label>
                  <input
                    id="horarioEntrada"
                    type="time"
                    className={inputClass}
                    value={form.horarioEntrada}
                    onChange={(e) => setField('horarioEntrada', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="horarioSaida">
                    Horário de saída {reqMark}
                  </label>
                  <input
                    id="horarioSaida"
                    type="time"
                    className={inputClass}
                    value={form.horarioSaida}
                    onChange={(e) => setField('horarioSaida', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="funcaoSelect">
                  Função {reqMark}
                </label>
                <select
                  id="funcaoSelect"
                  className={inputClass}
                  value={form.funcaoSelect}
                  onChange={(e) => {
                    const value = e.target.value;
                    setField('funcaoSelect', value);
                    if (value !== ESTAGIO_FUNCAO_OUTRA) {
                      setField('funcaoOutra', '');
                    }
                  }}
                >
                  <option value="">Selecione</option>
                  {ESTAGIO_FUNCAO_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              {form.funcaoSelect === ESTAGIO_FUNCAO_OUTRA && (
                <div>
                  <label className={labelClass} htmlFor="funcaoOutra">
                    Descreva a função {reqMark}
                  </label>
                  <input
                    id="funcaoOutra"
                    className={inputClass}
                    value={form.funcaoOutra}
                    onChange={(e) =>
                      setField('funcaoOutra', e.target.value.toUpperCase())
                    }
                  />
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="valorBolsa">
                  Valor da bolsa {reqMark}
                </label>
                <input
                  id="valorBolsa"
                  type="text"
                  className={inputClass}
                  value={form.valorBolsa}
                  onChange={(e) => handleValorBolsaChange(e.target.value)}
                  placeholder="Ex: R$ 700,00"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-[#004085] dark:text-blue-400 border-b border-gray-200 dark:border-gray-600 pb-2 flex flex-wrap items-center gap-1">
                <span>📚 ESTÁ ESTUDANDO?</span>
                {reqMark}
              </h2>
              <div
                className="flex flex-wrap gap-6 text-sm pt-2"
                role="radiogroup"
                aria-label="Está estudando? Obrigatório."
              >
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="estudando"
                    checked={form.estudando === 'sim'}
                    onChange={() => {
                      lastUniCnpjFetched.current = '';
                      setField('estudando', 'sim');
                    }}
                    className="text-[#004085] focus:ring-[#004085]"
                  />
                  Sim
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="estudando"
                    checked={form.estudando === 'nao'}
                    onChange={() => {
                      lastUniCnpjFetched.current = '';
                      setField('estudando', 'nao');
                      setField('uniCnpj', '');
                      setField('uniNome', '');
                      setField('uniCep', '');
                      setField('uniEndereco', '');
                      setField('nivelEnsino', '');
                      setField('uniTelefone', '');
                      setField('uniReitor', '');
                    }}
                    className="text-[#004085] focus:ring-[#004085]"
                  />
                  Não
                </label>
              </div>
              {showUniFields && (
                <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <div>
                    <label className={labelClass} htmlFor="nivelEnsino">
                      Nível de ensino {reqMark}
                    </label>
                    <select
                      id="nivelEnsino"
                      className={inputClass}
                      value={form.nivelEnsino}
                      onChange={(e) => {
                        const v = e.target.value as EducationLevel;
                        setForm((p) => ({
                          ...p,
                          nivelEnsino: v,
                          uniReitor: v === 'superior' ? p.uniReitor : ''
                        }));
                      }}
                    >
                      <option value="">Selecione…</option>
                      <option value="superior">Ensino superior</option>
                      <option value="medio">Ensino médio</option>
                      <option value="tecnico">Ensino técnico</option>
                      <option value="fundamental">Ensino fundamental</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Para nível superior, o contrato costuma incluir o nome do(a) reitor(a); nos demais níveis,
                      basta o telefone da instituição e os dados obtidos pelo CNPJ.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Informe o CNPJ com 14 dígitos e saia do campo para buscar. Nome, CEP e endereço vêm
                    formatados da Receita Federal (Brasil API).
                  </p>
                  <div>
                    <label className={labelClass} htmlFor="uniCnpj">
                      CNPJ da instituição de ensino {reqMark}
                    </label>
                    <div className="relative">
                      <input
                        id="uniCnpj"
                        className={inputClass}
                        value={form.uniCnpj}
                        onChange={(e) => {
                          const masked = maskCnpj(e.target.value);
                          const d = masked.replace(/\D/g, '');
                          setForm((p) => {
                            const next = { ...p, uniCnpj: masked };
                            if (d.length < 14) {
                              next.uniNome = '';
                              next.uniCep = '';
                              next.uniEndereco = '';
                              lastUniCnpjFetched.current = '';
                            } else if (lastUniCnpjFetched.current && d !== lastUniCnpjFetched.current) {
                              next.uniNome = '';
                              next.uniCep = '';
                              next.uniEndereco = '';
                              lastUniCnpjFetched.current = '';
                            }
                            return next;
                          });
                        }}
                        onBlur={(ev) => void handleUniCnpjBlur(ev)}
                        inputMode="numeric"
                        disabled={loadingUniCnpj}
                      />
                      {loadingUniCnpj && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#004085] border-t-transparent dark:border-blue-400" />
                      )}
                    </div>
                  </div>
                  <div>
                    <div className={labelClass} id="uniNome-label">
                      Nome da instituição {reqMark}
                    </div>
                    <div
                      id="uniNome"
                      role="status"
                      aria-labelledby="uniNome-label"
                      className={readonlyFieldClass}
                    >
                      {form.uniNome ? (
                        form.uniNome
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Aguardando consulta do CNPJ</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className={labelClass} id="uniCep-label">
                        CEP da instituição {reqMark}
                      </div>
                      <div
                        id="uniCep"
                        role="status"
                        aria-labelledby="uniCep-label"
                        className={readonlyFieldClass}
                      >
                        {form.uniCep ? (
                          form.uniCep
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className={labelClass} id="uniEndereco-label">
                        Endereço da instituição {reqMark}
                      </div>
                      <div
                        id="uniEndereco"
                        role="status"
                        aria-labelledby="uniEndereco-label"
                        className={readonlyFieldClass}
                      >
                        {form.uniEndereco ? (
                          form.uniEndereco
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="uniTelefone">
                      Telefone da instituição de ensino {reqMark}
                    </label>
                    <input
                      id="uniTelefone"
                      type="tel"
                      className={inputClass}
                      value={form.uniTelefone}
                      onChange={(e) => setField('uniTelefone', maskPhone(e.target.value))}
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                  {exigeReitorSuperior && (
                  <div>
                      <label className={labelClass} htmlFor="uniReitor">
                        Reitor(a) da instituição {reqMark}
                    </label>
                    <input
                        id="uniReitor"
                        type="text"
                      className={inputClass}
                        value={form.uniReitor}
                        onChange={(e) => setField('uniReitor', e.target.value)}
                        autoComplete="off"
                    />
                  </div>
                  )}
                  </div>
            )}
            </section>

            <div className="flex justify-center pb-8">
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 bg-[#004085] dark:bg-blue-600 text-white font-medium rounded-lg hover:bg-[#0056B3] dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Enviando…' : 'Concluir'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
