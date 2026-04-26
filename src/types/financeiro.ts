export type TipoTransacao = 'receita' | 'despesa';
export type StatusTransacao = 'realizado' | 'previsto';

export type Categoria = {
  id: string;
  nome: string;
  tipo: TipoTransacao;
  cor: string;
};

export type Transacao = {
  id: string;
  tipo: TipoTransacao;
  categoriaId: string;
  descricao: string;
  valor: number;
  data: string;
  recorrenciaId?: string;
  importada?: boolean;
  recorrente?: boolean;
  status?: StatusTransacao;
};

export type FrequenciaRecorrencia = 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
export type StatusRecorrencia = 'ativa' | 'inativa' | 'pausada' | 'encerrada';
export type TipoRecorrencia = 'receita' | 'despesa' | 'aporte';

export type TransacaoRecorrente = {
  id: string;
  tipo: TipoTransacao;
  tipoRecorrencia?: TipoRecorrencia;
  categoriaId: string;
  descricao: string;
  valor: number;
  dataInicio: string;
  dataFinal?: string;
  proximaData?: string;
  diaExecucao?: number;
  frequencia: FrequenciaRecorrencia;
  status?: StatusRecorrencia;
  ativa: boolean;
  gerarAutomatico?: boolean;
};

export type TipoSessaoTrabalho = 'normal' | 'falta' | 'extra';
export type TipoPagamento = 'vale' | 'salario';

export type SessaoTrabalho = {
  id: string;
  data: string;
  horasTrabalhadas: number;
  valorHora: number;
  totalGanho: number;
  tipo?: TipoSessaoTrabalho;
  transacaoId?: string;
};

export type ConfiguracaoRendaVariavel = {
  valorHoraPadrao: number;
  horasPadraoDia: number;
  multiplicadorHoraExtra: number;
};

export type Pagamento = {
  id: string;
  tipo: TipoPagamento;
  valor: number;
  data: string;
  transacaoId?: string;
};

export type Orcamento = {
  id: string;
  categoriaId: string;
  limite: number;
};

export type TipoInvestimento = 'CDB' | 'Tesouro Direto' | 'LCI/LCA' | 'FII' | 'Acao' | 'ETF' | 'Cripto' | 'Reserva de emergencia' | 'Outro' | 'Renda fixa' | 'Acoes' | 'Fundos' | 'Outros';

export type DetalhesInvestimento = {
  emissor?: string;
  percentualCdi?: number;
  vencimento?: string;
  liquidez?: 'diaria' | 'vencimento';
  ticker?: string;
  quantidade?: number;
  precoMedio?: number;
  precoAtual?: number;
  dividendosMensais?: number;
  dividendYield?: number;
  moeda?: string;
};

export type Investimento = {
  id: string;
  nome: string;
  tipo: TipoInvestimento;
  valorInicial: number;
  aporteMensal: number;
  rentabilidadeEsperada: number;
  rentabilidadeAtual: number;
  detalhes?: DetalhesInvestimento;
};

export type MetaFinanceira = {
  id: string;
  nome: string;
  valorAlvo: number;
  valorAtual: number;
  prazo: string;
};

export type HistoricoMensal = {
  mes: string;
  receita: number;
  despesa: number;
  patrimonio: number;
  investimentos: number;
};

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  avatar: string;
  metaEconomia: number;
  tema: 'light' | 'dark';
};

export type AuthUser = {
  id: string;
  nome: string;
  email: string;
  avatar: string;
  tema: 'light' | 'dark';
};

export type ContaLocal = AuthUser & {
  senha: string;
  criadoEm: string;
};

export type AppState = {
  usuario: Usuario;
  categorias: Categoria[];
  transacoes: Transacao[];
  recorrentes: TransacaoRecorrente[];
  orcamentos: Orcamento[];
  investimentos: Investimento[];
  metas: MetaFinanceira[];
  historicoMensal: HistoricoMensal[];
  sessoesTrabalho: SessaoTrabalho[];
  pagamentos: Pagamento[];
  configuracaoRendaVariavel: ConfiguracaoRendaVariavel;
};

export type Toast = {
  id: string;
  tipo: 'sucesso' | 'erro' | 'info';
  mensagem: string;
};
