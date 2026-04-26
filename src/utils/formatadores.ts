export const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const percentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatarMoeda(valor: number) {
  return moeda.format(valor);
}

export function formatarPercentual(valor: number) {
  return percentual.format(valor / 100);
}

export function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}

export function nomeMes(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(ano, mes - 1, 1));
}
