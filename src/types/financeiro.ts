export type TipoTransacao = 'receita' | 'despesa';

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
};

export type FrequenciaRecorrencia = 'semanal' | 'mensal' | 'anual';

export type TransacaoRecorrente = {
  id: string;
  tipo: TipoTransacao;
  categoriaId: string;
  descricao: string;
  valor: number;
  dataInicio: string;
  frequencia: FrequenciaRecorrencia;
  ativa: boolean;
};

export type Orcamento = {
  id: string;
  categoriaId: string;
  limite: number;
};

export type TipoInvestimento = 'Renda fixa' | 'Acoes' | 'Fundos' | 'Cripto' | 'Reserva de emergencia' | 'Outros';

export type Investimento = {
  id: string;
  nome: string;
  tipo: TipoInvestimento;
  valorInicial: number;
  aporteMensal: number;
  rentabilidadeEsperada: number;
  rentabilidadeAtual: number;
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
};

export type Toast = {
  id: string;
  tipo: 'sucesso' | 'erro' | 'info';
  mensagem: string;
};
