import { AppState, AuthUser } from '../types/financeiro';

const mesAtual = new Date().toISOString().slice(0, 7);

export const usuarioTeste: AuthUser = {
  id: 'user-demo',
  nome: 'Marina Costa',
  email: 'demo@finanzen.com',
  avatar: 'MC',
  tema: 'light',
};

export function criarDadosExemplo(usuario: AuthUser = usuarioTeste): AppState {
  return {
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatar: usuario.avatar,
      tema: usuario.tema,
      metaEconomia: 25,
    },
    categorias: [
      { id: 'salario', nome: 'Salario', tipo: 'receita', cor: '#10b981' },
      { id: 'freelas', nome: 'Freelas', tipo: 'receita', cor: '#06b6d4' },
      { id: 'moradia', nome: 'Moradia', tipo: 'despesa', cor: '#f97316' },
      { id: 'alimentacao', nome: 'Alimentacao', tipo: 'despesa', cor: '#ef4444' },
      { id: 'transporte', nome: 'Transporte', tipo: 'despesa', cor: '#8b5cf6' },
      { id: 'lazer', nome: 'Lazer', tipo: 'despesa', cor: '#ec4899' },
      { id: 'assinaturas', nome: 'Assinaturas', tipo: 'despesa', cor: '#6366f1' },
      { id: 'saude', nome: 'Saude', tipo: 'despesa', cor: '#14b8a6' },
      { id: 'educacao', nome: 'Educacao', tipo: 'despesa', cor: '#f59e0b' },
    ],
    transacoes: [
      { id: 't1', tipo: 'receita', categoriaId: 'salario', descricao: 'Salario CLT', valor: 9200, data: `${mesAtual}-05` },
      { id: 't2', tipo: 'receita', categoriaId: 'freelas', descricao: 'Projeto freelance', valor: 1800, data: `${mesAtual}-12` },
      { id: 't3', tipo: 'despesa', categoriaId: 'moradia', descricao: 'Aluguel e condominio', valor: 2850, data: `${mesAtual}-06` },
      { id: 't4', tipo: 'despesa', categoriaId: 'alimentacao', descricao: 'Supermercado', valor: 920, data: `${mesAtual}-09` },
      { id: 't5', tipo: 'despesa', categoriaId: 'transporte', descricao: 'Transporte do mes', valor: 510, data: `${mesAtual}-14` },
      { id: 't6', tipo: 'despesa', categoriaId: 'lazer', descricao: 'Restaurantes e cinema', valor: 640, data: `${mesAtual}-18` },
    ],
    recorrentes: [
      { id: 'r1', tipo: 'receita', categoriaId: 'salario', descricao: 'Salario CLT', valor: 9200, dataInicio: `${mesAtual}-05`, frequencia: 'mensal', ativa: true },
      { id: 'r2', tipo: 'despesa', categoriaId: 'moradia', descricao: 'Aluguel e condominio', valor: 2850, dataInicio: `${mesAtual}-06`, frequencia: 'mensal', ativa: true },
      { id: 'r3', tipo: 'despesa', categoriaId: 'assinaturas', descricao: 'Netflix e Spotify', valor: 82, dataInicio: `${mesAtual}-10`, frequencia: 'mensal', ativa: true },
    ],
    orcamentos: [
      { id: 'o1', categoriaId: 'moradia', limite: 3200 },
      { id: 'o2', categoriaId: 'alimentacao', limite: 1200 },
      { id: 'o3', categoriaId: 'transporte', limite: 700 },
      { id: 'o4', categoriaId: 'lazer', limite: 800 },
    ],
    investimentos: [
      { id: 'i1', nome: 'Tesouro Selic', tipo: 'Reserva de emergencia', valorInicial: 24000, aporteMensal: 1200, rentabilidadeEsperada: 0.85, rentabilidadeAtual: 0.78 },
      { id: 'i2', nome: 'CDB liquidez diaria', tipo: 'Renda fixa', valorInicial: 18500, aporteMensal: 800, rentabilidadeEsperada: 0.95, rentabilidadeAtual: 0.88 },
      { id: 'i3', nome: 'ETF Brasil', tipo: 'Fundos', valorInicial: 12600, aporteMensal: 600, rentabilidadeEsperada: 1.05, rentabilidadeAtual: 1.22 },
    ],
    metas: [
      { id: 'm1', nome: 'Reserva de emergencia', valorAlvo: 50000, valorAtual: 24000, prazo: `${new Date().getFullYear()}-12-31` },
      { id: 'm2', nome: 'Entrada do apartamento', valorAlvo: 120000, valorAtual: 36000, prazo: `${new Date().getFullYear() + 3}-06-30` },
    ],
    historicoMensal: [
      { mes: 'Nov', receita: 9650, despesa: 5980, patrimonio: 82500, investimentos: 61800 },
      { mes: 'Dez', receita: 11200, despesa: 7220, patrimonio: 86900, investimentos: 65100 },
      { mes: 'Jan', receita: 10100, despesa: 6410, patrimonio: 91200, investimentos: 68800 },
      { mes: 'Fev', receita: 10750, despesa: 6280, patrimonio: 96200, investimentos: 72700 },
      { mes: 'Mar', receita: 9900, despesa: 6120, patrimonio: 100900, investimentos: 76100 },
      { mes: 'Abr', receita: 11000, despesa: 5640, patrimonio: 106750, investimentos: 80120 },
    ],
  };
}

export const dadosIniciais = criarDadosExemplo(usuarioTeste);
