import { User } from '@supabase/supabase-js';
import { AppState, AuthUser, Categoria, Investimento, MetaFinanceira, Orcamento, Transacao, TransacaoRecorrente, Usuario } from '../types/financeiro';
import { exigirSupabase } from './supabaseClient';

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  theme: 'light' | 'dark';
  savings_goal: number;
};

const SELECTS = {
  profiles: 'id, name, email, avatar, theme, savings_goal',
  categories: 'id, user_id, name, type, color, created_at',
  transactions: 'id, user_id, type, category_id, description, amount, date, recurrence_id, imported, created_at',
  budgets: 'id, user_id, category_id, limit_amount, created_at',
  investments: 'id, user_id, name, type, initial_amount, monthly_contribution, expected_return, current_return, details, created_at',
  goals: 'id, user_id, name, target_amount, current_amount, deadline, created_at',
  recurringTransactions: 'id, user_id, type, category_id, description, amount, start_date, frequency, active, kind, end_date, status, next_date, created_at',
} as const;

function iniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join('') || 'U';
}

export async function loginSupabase(email: string, senha: string) {
  const supabase = exigirSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Login nao retornou usuario.');
  await garantirPerfil(data.user);
  return authUserFromSupabase(data.user);
}

export async function cadastrarSupabase(nome: string, email: string, senha: string) {
  const supabase = exigirSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: senha,
    options: { data: { name: nome.trim(), avatar: iniciais(nome) } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Cadastro nao retornou usuario.');
  await garantirPerfil(data.user, nome);
  return authUserFromSupabase(data.user, nome);
}

export async function logoutSupabase() {
  const supabase = exigirSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function garantirPerfil(user: User, nomeFallback?: string) {
  const supabase = exigirSupabase();
  const nome = nomeFallback || String(user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario');
  const avatar = String(user.user_metadata?.avatar || iniciais(nome));
  const email = user.email ?? '';
  const { data: existente, error: buscaErro } = await supabase.from('profiles').select(SELECTS.profiles).eq('id', user.id).maybeSingle<ProfileRow>();
  if (buscaErro) throw new Error(buscaErro.message);
  if (existente) return existente;
  const perfil: ProfileRow = { id: user.id, name: nome, email, avatar, theme: 'light', savings_goal: 25 };
  const { error } = await supabase.from('profiles').upsert(perfil, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return perfil;
}

export async function carregarEstadoSupabase(usuario: AuthUser): Promise<AppState> {
  const supabase = exigirSupabase();
  const [profile, categories, transactions, budgets, investments, goals, recurring] = await Promise.all([
    supabase.from('profiles').select(SELECTS.profiles).eq('id', usuario.id).maybeSingle<ProfileRow>(),
    supabase.from('categories').select(SELECTS.categories).eq('user_id', usuario.id),
    supabase.from('transactions').select(SELECTS.transactions).eq('user_id', usuario.id),
    supabase.from('budgets').select(SELECTS.budgets).eq('user_id', usuario.id),
    supabase.from('investments').select(SELECTS.investments).eq('user_id', usuario.id),
    supabase.from('goals').select(SELECTS.goals).eq('user_id', usuario.id),
    supabase.from('recurring_transactions').select(SELECTS.recurringTransactions).eq('user_id', usuario.id),
  ]);
  const erro = [profile.error, categories.error, transactions.error, budgets.error, investments.error, goals.error, recurring.error].find(Boolean);
  if (erro) throw new Error(erro.message);

  const perfil = profile.data ?? {
    id: usuario.id,
    name: usuario.nome,
    email: usuario.email,
    avatar: usuario.avatar,
    theme: usuario.tema,
    savings_goal: 25,
  };

  return {
    usuario: {
      id: usuario.id,
      nome: perfil.name,
      email: perfil.email,
      avatar: perfil.avatar,
      tema: perfil.theme,
      metaEconomia: Number(perfil.savings_goal),
    },
    categorias: (categories.data ?? []).map((item) => ({ id: item.id, nome: item.name, tipo: item.type, cor: item.color })) as Categoria[],
    transacoes: (transactions.data ?? []).map((item) => ({ id: item.id, tipo: item.type, categoriaId: item.category_id ?? '', descricao: item.description, valor: Number(item.amount), data: item.date, recorrenciaId: item.recurrence_id ?? undefined, importada: item.imported })) as Transacao[],
    recorrentes: (recurring.data ?? []).map((item) => ({ id: item.id, tipo: item.type, tipoRecorrencia: item.kind ?? item.type, categoriaId: item.category_id ?? '', descricao: item.description, valor: Number(item.amount), dataInicio: item.start_date, dataFinal: item.end_date ?? undefined, proximaData: item.next_date ?? undefined, frequencia: item.frequency, status: item.status ?? (item.active ? 'ativa' : 'pausada'), ativa: item.active })) as TransacaoRecorrente[],
    orcamentos: (budgets.data ?? []).map((item) => ({ id: item.id, categoriaId: item.category_id, limite: Number(item.limit_amount) })) as Orcamento[],
    investimentos: (investments.data ?? []).map((item) => ({ id: item.id, nome: item.name, tipo: item.type, valorInicial: Number(item.initial_amount), aporteMensal: Number(item.monthly_contribution), rentabilidadeEsperada: Number(item.expected_return), rentabilidadeAtual: Number(item.current_return), detalhes: item.details ?? {} })) as Investimento[],
    metas: (goals.data ?? []).map((item) => ({ id: item.id, nome: item.name, valorAlvo: Number(item.target_amount), valorAtual: Number(item.current_amount), prazo: item.deadline })) as MetaFinanceira[],
    historicoMensal: [],
  };
}

export async function salvarEstadoSupabase(userId: string, estado: AppState) {
  const supabase = exigirSupabase();
  await atualizarPerfilSupabase(userId, estado.usuario);
  await Promise.all([
    supabase.from('transactions').delete().eq('user_id', userId),
    supabase.from('budgets').delete().eq('user_id', userId),
    supabase.from('recurring_transactions').delete().eq('user_id', userId),
  ]).then(verificarErros);

  await Promise.all([
    supabase.from('categories').delete().eq('user_id', userId),
    supabase.from('investments').delete().eq('user_id', userId),
    supabase.from('goals').delete().eq('user_id', userId),
  ]).then(verificarErros);

  await inserirLinhas('categories', estado.categorias.map((item) => ({ id: item.id, user_id: userId, name: item.nome, type: item.tipo, color: item.cor })));
  await Promise.all([
    inserirLinhas('transactions', estado.transacoes.map((item) => ({ id: item.id, user_id: userId, type: item.tipo, category_id: item.categoriaId || null, description: item.descricao, amount: item.valor, date: item.data, recurrence_id: item.recorrenciaId ?? null, imported: item.importada ?? false }))),
    inserirLinhas('budgets', estado.orcamentos.map((item) => ({ id: item.id, user_id: userId, category_id: item.categoriaId, limit_amount: item.limite }))),
    inserirLinhas('investments', estado.investimentos.map((item) => ({ id: item.id, user_id: userId, name: item.nome, type: item.tipo, initial_amount: item.valorInicial, monthly_contribution: item.aporteMensal, expected_return: item.rentabilidadeEsperada, current_return: item.rentabilidadeAtual, details: item.detalhes ?? {} }))),
    inserirLinhas('goals', estado.metas.map((item) => ({ id: item.id, user_id: userId, name: item.nome, target_amount: item.valorAlvo, current_amount: item.valorAtual, deadline: item.prazo }))),
    inserirLinhas('recurring_transactions', estado.recorrentes.map((item) => ({ id: item.id, user_id: userId, type: item.tipo, category_id: item.categoriaId || null, description: item.descricao, amount: item.valor, start_date: item.dataInicio, frequency: item.frequencia, active: item.status ? item.status === 'ativa' : item.ativa, kind: item.tipoRecorrencia ?? item.tipo, end_date: item.dataFinal ?? null, status: item.status ?? (item.ativa ? 'ativa' : 'pausada'), next_date: item.proximaData ?? item.dataInicio }))),
  ]);
}

export async function resetarDadosSupabase(usuario: AuthUser) {
  const dados = criarEstadoVazio(usuario);
  await salvarEstadoSupabase(usuario.id, dados);
  return dados;
}

export async function atualizarPerfilSupabase(userId: string, perfil: Pick<Usuario, 'nome' | 'email' | 'avatar' | 'tema' | 'metaEconomia'>): Promise<AuthUser> {
  const supabase = exigirSupabase();
  const payload = {
    id: userId,
    name: perfil.nome.trim(),
    email: perfil.email.trim().toLowerCase(),
    avatar: perfil.avatar || iniciais(perfil.nome),
    theme: perfil.tema,
    savings_goal: perfil.metaEconomia,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profiles').upsert(payload);
  if (error) throw new Error(error.message);
  return { id: userId, nome: payload.name, email: payload.email, avatar: payload.avatar, tema: payload.theme };
}

async function inserirLinhas(tabela: string, linhas: Record<string, unknown>[]) {
  const supabase = exigirSupabase();
  if (linhas.length === 0) return;
  const { error } = await supabase.from(tabela).upsert(linhas, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

function verificarErros(resultados: { error: { message: string } | null }[]) {
  const erro = resultados.find((resultado) => resultado.error)?.error;
  if (erro) throw new Error(erro.message);
}

export function authUserFromSupabase(user: User, nomeFallback?: string): AuthUser {
  const nome = nomeFallback || String(user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario');
  return {
    id: user.id,
    nome,
    email: user.email ?? '',
    avatar: String(user.user_metadata?.avatar || iniciais(nome)),
    tema: 'light',
  };
}

function criarEstadoVazio(usuario: AuthUser): AppState {
  return {
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatar: usuario.avatar,
      tema: usuario.tema,
      metaEconomia: 25,
    },
    categorias: [],
    transacoes: [],
    recorrentes: [],
    orcamentos: [],
    investimentos: [],
    metas: [],
    historicoMensal: [],
  };
}
