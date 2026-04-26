import { AppState, Categoria, FrequenciaRecorrencia, TipoTransacao, Transacao, TransacaoRecorrente } from '../types/financeiro';
import { filtrarPorMes, resumoMensal, soma, uid } from './calculos';

export type ImportacaoCSV = Omit<Transacao, 'id'> & {
  idTemp: string;
  duplicada: boolean;
};

const palavrasCategoria: Record<string, string[]> = {
  alimentacao: ['mercado', 'supermercado', 'padaria', 'restaurante', 'ifood', 'hortifruti'],
  transporte: ['uber', '99', 'onibus', 'metro', 'combustivel', 'posto', 'gasolina'],
  assinaturas: ['netflix', 'spotify', 'prime', 'disney', 'hbo', 'assinatura'],
  saude: ['farmacia', 'drogaria', 'medico', 'consulta', 'exame', 'plano de saude'],
  moradia: ['aluguel', 'condominio', 'luz', 'energia', 'internet', 'agua'],
  lazer: ['cinema', 'bar', 'show', 'viagem', 'restaurantes'],
  educacao: ['curso', 'faculdade', 'livro', 'escola'],
  salario: ['salario', 'pagamento', 'provento'],
  freelas: ['freela', 'freelance', 'projeto'],
};

export function sugerirCategoria(descricao: string, categorias: Categoria[], tipo: TipoTransacao) {
  const texto = normalizar(descricao);
  const candidatos = categorias.filter((categoria) => categoria.tipo === tipo);
  const porPalavra = Object.entries(palavrasCategoria).find(([, palavras]) => palavras.some((palavra) => texto.includes(normalizar(palavra))));
  if (porPalavra) {
    const [id] = porPalavra;
    const categoria = candidatos.find((item) => item.id === id || normalizar(item.nome).includes(id));
    if (categoria) return categoria.id;
  }
  return candidatos[0]?.id ?? '';
}

export function gerarRecorrenciasDoMes(estado: AppState, mesIso: string) {
  const novas: Transacao[] = [];
  estado.recorrentes.filter((item) => item.ativa).forEach((recorrente) => {
    datasDaRecorrencia(recorrente, mesIso).forEach((data) => {
      const existe = estado.transacoes.some((transacao) => transacao.recorrenciaId === recorrente.id && transacao.data === data);
      if (!existe) {
        novas.push({
          id: uid('auto'),
          tipo: recorrente.tipo,
          categoriaId: recorrente.categoriaId,
          descricao: recorrente.descricao,
          valor: recorrente.valor,
          data,
          recorrenciaId: recorrente.id,
        });
      }
    });
  });
  return novas;
}

export function sugerirOrcamentos(estado: AppState) {
  const meses = ultimosMesesComDados(estado.transacoes, 4);
  return estado.categorias.filter((categoria) => categoria.tipo === 'despesa').map((categoria) => {
    const valores = meses.map((mes) => filtrarPorMes(estado.transacoes, mes)
      .filter((transacao) => transacao.tipo === 'despesa' && transacao.categoriaId === categoria.id)
      .reduce((total, transacao) => total + transacao.valor, 0));
    const media = valores.length ? valores.reduce((total, valor) => total + valor, 0) / valores.length : 0;
    return { categoriaId: categoria.id, limiteSugerido: Math.ceil(media * 1.12) };
  }).filter((item) => item.limiteSugerido > 0);
}

export function insightsFinanceiros(estado: AppState, mesIso: string) {
  const transacoesMes = filtrarPorMes(estado.transacoes, mesIso);
  const despesas = transacoesMes.filter((item) => item.tipo === 'despesa');
  const maiorGasto = despesas.reduce<Transacao | null>((maior, item) => (!maior || item.valor > maior.valor ? item : maior), null);
  const porCategoria = estado.categorias.filter((categoria) => categoria.tipo === 'despesa').map((categoria) => ({
    categoria,
    atual: despesas.filter((item) => item.categoriaId === categoria.id).reduce((total, item) => total + item.valor, 0),
    anterior: gastosCategoriaMes(estado, categoria.id, mesAnterior(mesIso)),
  }));
  const maiorAumento = porCategoria.reduce<typeof porCategoria[number] | null>((maior, item) => {
    const aumento = item.atual - item.anterior;
    if (aumento <= 0) return maior;
    return !maior || aumento > maior.atual - maior.anterior ? item : maior;
  }, null);
  const orcamentoTotal = estado.orcamentos.reduce((total, item) => total + item.limite, 0);
  const gastoAtual = soma(despesas);
  const resumo = resumoMensal(estado, mesIso);
  const dia = new Date().getDate();
  const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const previsaoDespesa = dia > 0 ? gastoAtual / dia * diasMes : gastoAtual;
  return {
    maiorGasto,
    maiorAumento,
    quantoPodeGastar: Math.max(orcamentoTotal - gastoAtual, 0),
    previsaoFechamento: resumo.receita - previsaoDespesa,
    economiaEstimada: resumo.receita - previsaoDespesa,
  };
}

export function detectarDuplicata(transacao: Omit<Transacao, 'id'>, existentes: Transacao[]) {
  return existentes.some((item) => (
    item.data === transacao.data &&
    Math.abs(item.valor - transacao.valor) < 0.01 &&
    similaridade(normalizar(item.descricao), normalizar(transacao.descricao)) >= 0.72
  ));
}

export function importarCSV(texto: string, estado: AppState): ImportacaoCSV[] {
  const linhas = texto.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean);
  if (linhas.length < 2) return [];
  const cabecalho = dividirCSV(linhas[0]).map(normalizar);
  const indiceData = acharIndice(cabecalho, ['data', 'date', 'dt']);
  const indiceDescricao = acharIndice(cabecalho, ['descricao', 'descrição', 'historico', 'memo', 'description']);
  const indiceValor = acharIndice(cabecalho, ['valor', 'amount', 'quantia']);
  const indiceTipo = acharIndice(cabecalho, ['tipo', 'type', 'debito_credito']);
  if (indiceData < 0 || indiceDescricao < 0 || indiceValor < 0) return [];

  return linhas.slice(1).map((linha) => {
    const colunas = dividirCSV(linha);
    const valorBruto = Number(String(colunas[indiceValor] ?? '0').replace(/\./g, '').replace(',', '.'));
    const tipoTexto = normalizar(colunas[indiceTipo] ?? '');
    const tipo: TipoTransacao = tipoTexto.includes('receita') || tipoTexto.includes('credito') || valorBruto > 0 ? 'receita' : 'despesa';
    const descricao = colunas[indiceDescricao] || 'Lancamento importado';
    const transacao = {
      idTemp: uid('csv'),
      tipo,
      categoriaId: sugerirCategoria(descricao, estado.categorias, tipo),
      descricao,
      valor: Math.abs(valorBruto),
      data: normalizarData(colunas[indiceData]),
      importada: true,
      duplicada: false,
    };
    return { ...transacao, duplicada: detectarDuplicata(transacao, estado.transacoes) };
  });
}

export function ritmoMeta(valorAtual: number, valorAlvo: number, prazo: string) {
  const falta = Math.max(valorAlvo - valorAtual, 0);
  const hoje = new Date();
  const fim = new Date(`${prazo}T00:00:00`);
  const meses = Math.max(1, Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const precisaMes = falta / meses;
  const progresso = valorAlvo > 0 ? Math.min((valorAtual / valorAlvo) * 100, 100) : 0;
  const esperado = Math.min(100, 100 / Math.max(meses, 1));
  return { falta, meses, precisaMes, progresso, noRitmo: progresso >= esperado || falta === 0 };
}

function datasDaRecorrencia(recorrente: TransacaoRecorrente, mesIso: string) {
  const inicio = new Date(`${recorrente.dataInicio}T00:00:00`);
  const [ano, mes] = mesIso.split('-').map(Number);
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0);
  if (inicio > fimMes) return [];
  const datas: string[] = [];
  const cursor = new Date(inicio);
  while (cursor < inicioMes) avancar(cursor, recorrente.frequencia);
  while (cursor <= fimMes) {
    datas.push(cursor.toISOString().slice(0, 10));
    avancar(cursor, recorrente.frequencia);
  }
  return datas;
}

function avancar(data: Date, frequencia: FrequenciaRecorrencia) {
  if (frequencia === 'semanal') data.setDate(data.getDate() + 7);
  if (frequencia === 'mensal') data.setMonth(data.getMonth() + 1);
  if (frequencia === 'anual') data.setFullYear(data.getFullYear() + 1);
}

function ultimosMesesComDados(transacoes: Transacao[], limite: number) {
  return [...new Set(transacoes.map((item) => item.data.slice(0, 7)))].sort().slice(-limite);
}

function gastosCategoriaMes(estado: AppState, categoriaId: string, mesIso: string) {
  return filtrarPorMes(estado.transacoes, mesIso)
    .filter((item) => item.tipo === 'despesa' && item.categoriaId === categoriaId)
    .reduce((total, item) => total + item.valor, 0);
}

function mesAnterior(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const data = new Date(ano, mes - 2, 1);
  return data.toISOString().slice(0, 7);
}

function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function similaridade(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const palavrasA = new Set(a.split(/\s+/));
  const palavrasB = new Set(b.split(/\s+/));
  const comuns = [...palavrasA].filter((palavra) => palavrasB.has(palavra)).length;
  return comuns / Math.max(palavrasA.size, palavrasB.size);
}

function dividirCSV(linha: string) {
  const partes = linha.match(/("([^"]|"")*"|[^,;]+)/g) ?? [];
  return partes.map((parte) => parte.replace(/^"|"$/g, '').replaceAll('""', '"').trim());
}

function acharIndice(cabecalho: string[], nomes: string[]) {
  return cabecalho.findIndex((coluna) => nomes.some((nome) => coluna.includes(normalizar(nome))));
}

function normalizarData(valor: string) {
  const limpo = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return limpo;
  const partes = limpo.split(/[/-]/);
  if (partes.length === 3) {
    const [dia, mes, ano] = partes;
    if (ano.length === 4) return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return new Date().toISOString().slice(0, 10);
}
