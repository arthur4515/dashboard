import { Download, FileText, PieChart as PieIcon } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { AppState } from '../types/financeiro';
import { Section } from '../components/Section';
import { EmptyState } from '../components/EmptyState';
import { evolucaoComAtual, gastosPorCategoria, resumoMensal } from '../utils/calculos';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';
import { ChartFrame } from '../components/ChartFrame';

export function Relatorios({ estado, avisar }: { estado: AppState; avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void }) {
  const evolucao = evolucaoComAtual(estado, mesAtualISO());
  const resumo = resumoMensal(estado, mesAtualISO());
  const categorias = gastosPorCategoria(estado, mesAtualISO());
  const mesAtual = evolucao[evolucao.length - 1];
  const mesAnterior = evolucao[evolucao.length - 2];
  const variacao = mesAtual && mesAnterior ? (mesAtual.receita - mesAtual.despesa) - (mesAnterior.receita - mesAnterior.despesa) : 0;

  function exportarCSV() {
    if (estado.transacoes.length === 0) return avisar('Nao ha transacoes para exportar.', 'info');
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

  if (estado.transacoes.length === 0) {
    return (
      <Section titulo="Relatorios" acao={<button className="btn-secondary" onClick={() => avisar('PDF em desenvolvimento.', 'info')}><FileText size={18} />PDF</button>}>
        <EmptyState icon={PieIcon} titulo="Sem dados para relatorio" texto="Cadastre receitas, despesas ou importe um CSV para gerar relatorios mensais e anuais." />
      </Section>
    );
  }

  return (
    <div className="space-y-6">
      <Section titulo="Relatorios" acao={<div className="flex gap-2"><button className="btn-secondary" onClick={exportarCSV}><Download size={18} />CSV</button><button className="btn-secondary" onClick={() => avisar('PDF em desenvolvimento.', 'info')}><FileText size={18} />PDF</button></div>}>
        <div className="grid gap-4 md:grid-cols-4">
          <Card titulo="Relatorio mensal" valor={formatarMoeda(resumo.economia)} texto="Economia do mes" />
          <Card titulo="Relatorio anual" valor={formatarMoeda(evolucao.reduce((t, i) => t + i.receita - i.despesa, 0))} texto="Saldo acumulado" />
          <Card titulo="Mes atual vs anterior" valor={formatarMoeda(variacao)} texto={variacao >= 0 ? 'Melhora no saldo' : 'Queda no saldo'} />
          <Card titulo="Patrimonio" valor={formatarMoeda(resumo.patrimonioTotal)} texto="Saldo + carteira + metas" />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Section titulo="Receitas, despesas e economia por mes">
          <ChartFrame className="h-[340px]">
            <BarChart data={evolucao}>
              <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Bar dataKey="receita" fill="#10B981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="despesa" fill="#EF4444" radius={[6, 6, 0, 0]} />
              <Bar dataKey={(item) => item.receita - item.despesa} name="economia" fill="#7C3AED" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </Section>

        <Section titulo="Categorias que mais gastaram">
          {categorias.length === 0 ? <EmptyState icon={PieIcon} titulo="Sem gastos no mes" texto="As categorias aparecem quando houver despesas." /> : (
            <ChartFrame className="h-[340px]">
              <PieChart>
                <Pie data={categorias} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={4}>{categorias.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie>
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              </PieChart>
            </ChartFrame>
          )}
        </Section>
      </div>

      <Section titulo="Comparativo entre meses">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-3">Mes</th><th>Receita</th><th>Despesa</th><th>Economia</th><th>Patrimonio</th></tr></thead>
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

function Card({ titulo, valor, texto }: { titulo: string; valor: string; texto: string }) {
  return <div className="rounded-lg bg-violet-50 p-4 dark:bg-violet-950"><p className="text-sm text-slate-500">{titulo}</p><strong className="mt-2 block text-2xl text-violet-950 dark:text-white">{valor}</strong><span className="text-sm text-slate-500">{texto}</span></div>;
}
