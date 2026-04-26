import { Download, FileText } from 'lucide-react';
import { AppState } from '../types/financeiro';
import { Section } from '../components/Section';
import { evolucaoComAtual, resumoMensal } from '../utils/calculos';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';

export function Relatorios({ estado, avisar }: { estado: AppState; avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void }) {
  const evolucao = evolucaoComAtual(estado, mesAtualISO());
  const resumo = resumoMensal(estado, mesAtualISO());

  function exportarCSV() {
    const linhas = ['data,tipo,categoria,descricao,valor', ...estado.transacoes.map((item) => {
      const categoria = estado.categorias.find((cat) => cat.id === item.categoriaId)?.nome ?? '';
      return `${item.data},${item.tipo},${categoria},"${item.descricao.replaceAll('"', '""')}",${item.valor}`;
    })];
    const blob = new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio-financeiro.csv';
    link.click();
    URL.revokeObjectURL(url);
    avisar('CSV exportado.');
  }

  return (
    <div className="space-y-6">
      <Section titulo="Relatórios" acao={<div className="flex gap-2"><button className="btn-secondary" onClick={exportarCSV}><Download size={18} />CSV</button><button className="btn-secondary" onClick={() => avisar('PDF em desenvolvimento.', 'info')}><FileText size={18} />PDF</button></div>}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Relatório mensal</p><strong className="mt-2 block text-2xl">{formatarMoeda(resumo.economia)}</strong><span className="text-sm text-slate-500">Economia do mês</span></div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Relatório anual</p><strong className="mt-2 block text-2xl">{formatarMoeda(evolucao.reduce((t, i) => t + i.receita - i.despesa, 0))}</strong><span className="text-sm text-slate-500">Saldo acumulado</span></div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm text-slate-500">Melhor mês</p><strong className="mt-2 block text-2xl">{evolucao.reduce((a, b) => (a.receita - a.despesa > b.receita - b.despesa ? a : b)).mes}</strong><span className="text-sm text-slate-500">Maior sobra mensal</span></div>
        </div>
      </Section>

      <Section titulo="Comparativo entre meses">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-3">Mês</th><th>Receita</th><th>Despesa</th><th>Economia</th><th>Patrimônio</th></tr></thead>
            <tbody>
              {evolucao.map((item) => (
                <tr key={item.mes} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-3 font-semibold">{item.mes}</td><td>{formatarMoeda(item.receita)}</td><td>{formatarMoeda(item.despesa)}</td><td>{formatarMoeda(item.receita - item.despesa)}</td><td>{formatarMoeda(item.patrimonio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
