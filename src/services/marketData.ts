import { Investimento } from '../types/financeiro';

export type CotacaoResultado = {
  precoAtual?: number;
  dividendosMensais?: number;
  erro?: string;
};

export async function buscarCotacaoAtivo(investimento: Investimento): Promise<CotacaoResultado> {
  const ticker = investimento.detalhes?.ticker || investimento.detalhes?.moeda;
  if (!ticker) return { erro: 'Ticker/moeda nao informado.' };

  try {
    // Estrutura preparada para API futura. Sem chave configurada, mantem fallback manual.
    const apiUrl = import.meta.env.VITE_MARKET_DATA_URL as string | undefined;
    const apiKey = import.meta.env.VITE_MARKET_DATA_KEY as string | undefined;
    if (!apiUrl || !apiKey) return { erro: 'API de cotacoes nao configurada. Use preenchimento manual.' };

    const resposta = await fetch(`${apiUrl.replace(/\/$/, '')}/quote?symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(apiKey)}`);
    if (!resposta.ok) return { erro: 'Nao foi possivel atualizar a cotacao.' };
    const dados = await resposta.json() as { price?: number; dividends?: number };
    return { precoAtual: Number(dados.price ?? 0) || undefined, dividendosMensais: Number(dados.dividends ?? 0) || undefined };
  } catch {
    return { erro: 'Falha ao consultar cotacao. Mantenha o valor manual.' };
  }
}
