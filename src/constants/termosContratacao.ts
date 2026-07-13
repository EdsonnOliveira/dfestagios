export const VERSAO_TERMOS = '2026-07-13';

export const TERMOS_TITULO =
  'REGRAS GERAIS E TERMOS DE CONTRATAÇÃO — DF ESTÁGIOS – AGÊNCIA DE INTEGRAÇÃO';

export type TermoClausula = {
  numero: number;
  titulo: string;
  paragrafos: string[];
};

export const TERMOS_CLAUSULAS: TermoClausula[] = [
  {
    numero: 1,
    titulo: 'Carga Horária do Estagiário',
    paragrafos: [
      'A carga horária do estágio deverá respeitar os limites estabelecidos pela Lei nº 11.788/2008, sendo de até 30 (trinta) horas semanais, não podendo ser ultrapassada em nenhuma hipótese.',
    ],
  },
  {
    numero: 2,
    titulo: 'Reposição de Estagiários',
    paragrafos: [
      'Em caso de desligamento do estagiário, a DF Estágios terá o prazo de até 48 (quarenta e oito) horas úteis, contadas a partir da solicitação formal da empresa, para encaminhar novos candidatos para processo seletivo.',
    ],
  },
  {
    numero: 3,
    titulo: 'Taxa Administrativa Mensal',
    paragrafos: [
      'A taxa administrativa possui caráter mensal, fixo e recorrente, permanecendo devida enquanto a vaga estiver ativa em nosso sistema e houver prestação dos serviços de recrutamento, seleção e reposição de candidatos.',
    ],
  },
  {
    numero: 4,
    titulo: 'Inadimplência',
    paragrafos: [
      'O atraso no pagamento das mensalidades sujeitará o contratante à incidência de multa de 10% sobre o valor em aberto, acrescida dos encargos legais cabíveis.',
      'Além disso, após 5 dias de vencimento, a cobertura do seguro de vida do estagiário poderá ser suspensa em razão da inadimplência, tornando necessária a interrupção imediata das atividades do estagiário até a regularização dos pagamentos.',
    ],
  },
  {
    numero: 5,
    titulo: 'Comunicação de Desligamento',
    paragrafos: [
      'Sempre que ocorrer o desligamento de um estagiário, a empresa deverá comunicar imediatamente a DF Estágios para que sejam realizados os procedimentos administrativos necessários, incluindo cálculos de encerramento e o agendamento de novo processo seletivo para reposição da vaga, quando solicitado.',
    ],
  },
  {
    numero: 6,
    titulo: 'Cancelamento da Contratação dos Serviços',
    paragrafos: [
      'A DF Estágios não exige fidelidade, período mínimo de permanência ou multa rescisória. O contratante poderá solicitar o encerramento da contratação dos serviços a qualquer momento.',
      'Caso a solicitação de cancelamento seja realizada após o vencimento de uma mensalidade já faturada, o respectivo valor permanecerá devido e deverá ser quitado para a efetivação do encerramento dos serviços.',
    ],
  },
  {
    numero: 7,
    titulo: 'Disposições Gerais',
    paragrafos: [
      'Ao manter o vínculo contratual ativo com a DF Estágios, o contratante declara estar ciente e de acordo com as condições acima descritas, comprometendo-se a cumprir as normas previstas na legislação de estágio vigente.',
    ],
  },
  {
    numero: 8,
    titulo: 'Responsabilidades Financeiras e Documentais',
    paragrafos: [
      'A DF Estágios atua exclusivamente como agente de integração, sendo responsável pelo suporte administrativo e pela elaboração da documentação relacionada ao programa de estágio, quando devidamente solicitada pela empresa contratante.',
      'O pagamento da bolsa-auxílio, auxílio-transporte, recesso remunerado, verbas rescisórias e quaisquer outros valores devidos ao estagiário constitui obrigação exclusiva da empresa contratante, não cabendo à DF Estágios realizar repasses financeiros, efetuar pagamentos em nome da contratante ou assumir qualquer responsabilidade pelas obrigações financeiras decorrentes da relação de estágio.',
    ],
  },
];
