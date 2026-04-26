import { AppState, HistoricoMensal, Investimento, Transacao } from '../types/financeiro';
import { recorrenciasFuturas } from './automacoes';

export function uid(prefixo = 'id') {
  return `${prefixo}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

export function filtrarPorMes(transacoes: Transacao[], mesIso: string) {
  return transacoes.filter((transacao) => transacao.data.startsWith(mesIso));
}

export function realizadas(transacoes: Transacao[]) {
  return transacoes.filter((transacao) => (transacao.status ?? 'realizado') === 'realizado');
}

export function previstas(transacoes: Transacao[]) {
  return transacoes.filter((transacao) => (transacao.status ?? 'realizado') === 'previsto');
}

export function soma(transacoes: Transacao[], tipo?: 'receita' | 'despesa') {
  return transacoes
    .filter((transacao) => !tipo || transacao.tipo === tipo)
    .reduce((total, transacao) => total + transacao.valor, 0);
}

export function resumoMensal(estado: AppState, mesIso: string) {
  const transacoesRealizadas = realizadas(estado.transacoes);
  const transacoesMes = filtrarPorMes(transacoesRealizadas, mesIso);
  const receita = soma(transacoesMes, 'receita');
  const despesa = soma(transacoesMes, 'despesa');
  const economia = receita - despesa;
  const saldoAtual = soma(transacoesRealizadas, 'receita') - soma(transacoesRealizadas, 'despesa');
  const futurasMes = recorrenciasFuturas(estado, 45).filter((item) => item.data.startsWith(mesIso) && !estado.transacoes.some((transacao) => transacao.recorrenciaId === item.recorrente.id && transacao.data === item.data));
  const previstasMes = filtrarPorMes(previstas(estado.transacoes), mesIso);
  const receitaPrevista = soma(previstasMes, 'receita') + futurasMes.filter((item) => item.recorrente.tipo === 'receita').reduce((total, item) => total + item.recorrente.valor, 0);
  const despesaPrevista = soma(previstasMes, 'despesa') + futurasMes.filter((item) => item.recorrente.tipo === 'despesa').reduce((total, item) => total + item.recorrente.valor, 0);
  const saldoPrevisto = saldoAtual + receitaPrevista - despesaPrevista;
  const totalInvestido = estado.investimentos.reduce((total, item) => total + item.valorInicial, 0);
  const metasAcumuladas = estado.metas.reduce((total, item) => total + item.valorAtual, 0);
  const patrimonioTotal = saldoAtual + totalInvestido + metasAcumuladas;
  const rendaVariavelMes = estado.sessoesTrabalho.filter((sessao) => sessao.data.startsWith(mesIso)).reduce((total, sessao) => total + sessao.totalGanho, 0);
  return {
    saldoAtual,
    receita,
    despesa,
    economia,
    saldoPrevisto,
    receitaPrevista,
    despesaPrevista,
    rendaVariavelMes,
    patrimonioTotal,
    taxaEconomia: receita ? (economia / receita) * 100 : 0,
  };
}

export function gastosPorCategoria(estado: AppState, mesIso: string) {
  const transacoes = filtrarPorMes(realizadas(estado.transacoes), mesIso).filter((item) => item.tipo === 'despesa');
  return estado.categorias
    .filter((categoria) => categoria.tipo === 'despesa')
    .map((categoria) => ({
      name: categoria.nome,
      value: transacoes.filter((item) => item.categoriaId === categoria.id).reduce((total, item) => total + item.valor, 0),
      fill: categoria.cor,
    }))
    .filter((item) => item.value > 0);
}

export function evolucaoComAtual(estado: AppState, mesIso: string): HistoricoMensal[] {
  const meses = new Map<string, { receita: number; despesa: number }>();
  realizadas(estado.transacoes).forEach((transacao) => {
    const chave = transacao.data.slice(0, 7);
    const atual = meses.get(chave) ?? { receita: 0, despesa: 0 };
    atual[transacao.tipo] += transacao.valor;
    meses.set(chave, atual);
  });

  const totalInvestimentos = estado.investimentos.reduce((total, item) => total + item.valorInicial, 0);
  let saldoAcumulado = 0;
  const calculado = [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, valores]) => {
      saldoAcumulado += valores.receita - valores.despesa;
      return {
        mes: rotuloMes(chave),
        receita: valores.receita,
        despesa: valores.despesa,
        patrimonio: saldoAcumulado + totalInvestimentos,
        investimentos: totalInvestimentos,
      };
    });

  if (calculado.length > 0) return calculado.slice(-8);
  return estado.historicoMensal.slice(-6).map((item) => ({ ...item, mes: item.mes || rotuloMes(mesIso) }));
}

export function projetarInvestimento(investimento: Investimento, meses: number) {
  const taxa = investimento.rentabilidadeEsperada / 100;
  let saldo = investimento.valorInicial;
  return Array.from({ length: meses + 1 }, (_, mes) => {
    if (mes > 0) saldo = saldo * (1 + taxa) + investimento.aporteMensal;
    return { mes, valor: Math.round(saldo) };
  });
}

export function simularCompostos(valorInicial: number, aporteMensal: number, taxaPercentual: number, meses: number) {
  const taxa = taxaPercentual / 100;
  let saldo = valorInicial;
  const serie = Array.from({ length: meses + 1 }, (_, mes) => {
    if (mes > 0) saldo = saldo * (1 + taxa) + aporteMensal;
    return {
      mes,
      saldo: Math.round(saldo),
      investido: valorInicial + aporteMensal * mes,
      juros: Math.round(saldo - (valorInicial + aporteMensal * mes)),
    };
  });
  const ultimo = serie[serie.length - 1];
  return { serie, final: ultimo.saldo, investido: ultimo.investido, juros: ultimo.juros };
}

export function projetarPatrimonio(estado: AppState, meses: number) {
  const saldoAtual = resumoMensal(estado, new Date().toISOString().slice(0, 7)).patrimonioTotal;
  const medias = mediasMensais(estado);
  const aportes = estado.investimentos.reduce((total, item) => total + item.aporteMensal, 0);
  const taxaMedia = estado.investimentos.length
    ? estado.investimentos.reduce((total, item) => total + item.rentabilidadeEsperada, 0) / estado.investimentos.length / 100
    : 0;
  let patrimonio = saldoAtual;
  return Array.from({ length: meses + 1 }, (_, mes) => {
    if (mes > 0) patrimonio = patrimonio * (1 + taxaMedia) + (medias.receita - medias.despesa) + aportes;
    return { mes, patrimonio: Math.round(patrimonio) };
  });
}

export function mediasMensais(estado: AppState) {
  const porMes = new Map<string, { receita: number; despesa: number }>();
  realizadas(estado.transacoes).forEach((transacao) => {
    const chave = transacao.data.slice(0, 7);
    const atual = porMes.get(chave) ?? { receita: 0, despesa: 0 };
    atual[transacao.tipo] += transacao.valor;
    porMes.set(chave, atual);
  });
  const valores = [...porMes.values()];
  if (valores.length === 0) return { receita: 0, despesa: 0 };
  return {
    receita: valores.reduce((total, item) => total + item.receita, 0) / valores.length,
    despesa: valores.reduce((total, item) => total + item.despesa, 0) / valores.length,
  };
}

function rotuloMes(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(ano, mes - 1, 1));
}
