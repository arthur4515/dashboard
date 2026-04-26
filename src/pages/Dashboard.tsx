import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { AppState } from '../types/financeiro';
import { evolucaoComAtual, gastosPorCategoria, resumoMensal } from '../utils/calculos';
import { formatarMoeda, formatarPercentual, mesAtualISO } from '../utils/formatadores';
import { MetricCard } from '../components/MetricCard';
import { Section } from '../components/Section';
import { EmptyState } from '../components/EmptyState';
import { insightsFinanceiros } from '../utils/automacoes';

export function Dashboard({ estado }: { estado: AppState }) {
  const mes = mesAtualISO();
  const resumo = resumoMensal(estado, mes);
  const evolucao = evolucaoComAtual(estado, mes);
  const categorias = gastosPorCategoria(estado, mes);
  const insights = insightsFinanceiros(estado, mes);
  const ultimas = [...estado.transacoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard titulo="Saldo atual" valor={formatarMoeda(resumo.saldoAtual)} variacao="Calculado com todas as transacoes" icon={Wallet} tom="azul" />
        <MetricCard titulo="Receita mensal" valor={formatarMoeda(resumo.receita)} variacao="Atualiza ao adicionar receitas" icon={ArrowUpRight} />
        <MetricCard titulo="Despesas mensais" valor={formatarMoeda(resumo.despesa)} variacao="Atualiza ao adicionar despesas" icon={ArrowDownRight} tom="vermelho" />
        <MetricCard titulo="Economia do mes" valor={formatarMoeda(resumo.economia)} variacao="Receitas menos despesas do mes" icon={PiggyBank} tom="ambar" />
        <MetricCard titulo="Patrimonio total" valor={formatarMoeda(resumo.patrimonioTotal)} variacao="Saldo, metas e investimentos" icon={Landmark} tom="azul" />
        <MetricCard titulo="Taxa de economia" valor={formatarPercentual(resumo.taxaEconomia)} variacao={`Meta: ${estado.usuario.metaEconomia}%`} icon={TrendingUp} />
      </div>

      <Section titulo="Resumo inteligente">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Insight titulo="Maior gasto" valor={insights.maiorGasto ? formatarMoeda(insights.maiorGasto.valor) : 'Sem dados'} texto={insights.maiorGasto?.descricao ?? 'Cadastre despesas para analisar'} />
          <Insight titulo="Maior aumento" valor={insights.maiorAumento ? insights.maiorAumento.categoria.nome : 'Estavel'} texto={insights.maiorAumento ? `${formatarMoeda(insights.maiorAumento.atual - insights.maiorAumento.anterior)} acima do mes anterior` : 'Nenhuma categoria subiu'} />
          <Insight titulo="Pode gastar" valor={formatarMoeda(insights.quantoPodeGastar)} texto="Dentro dos orcamentos do mes" />
          <Insight titulo="Fechamento previsto" valor={formatarMoeda(insights.previsaoFechamento)} texto="Estimativa pelo ritmo atual" />
          <Insight titulo="Economia estimada" valor={formatarMoeda(insights.economiaEstimada)} texto="Previsao ate o fim do mes" />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Section titulo="Evolucao financeira">
          {evolucao.length === 0 ? <EmptyState icon={TrendingUp} titulo="Sem historico suficiente" texto="Adicione transacoes para montar a evolucao financeira." /> : (
            <div className="h-80">
              <ResponsiveContainer>
                <AreaChart data={evolucao}>
                  <defs><linearGradient id="patrimonio" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  <Area dataKey="patrimonio" stroke="#10b981" fill="url(#patrimonio)" strokeWidth={3} />
                  <Area dataKey="investimentos" stroke="#0ea5e9" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section titulo="Gastos por categoria">
          {categorias.length === 0 ? <EmptyState icon={AlertTriangle} titulo="Sem despesas no mes" texto="Quando houver despesas, o grafico aparece aqui." /> : (
            <div className="h-80">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categorias} dataKey="value" nameKey="name" innerRadius={70} outerRadius={112} paddingAngle={4}>{categorias.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie>
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section titulo="Receitas x despesas">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Bar dataKey="receita" fill="#10b981" radius={[6, 6, 0, 0]} /><Bar dataKey="despesa" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section titulo="Ultimas transacoes">
          {ultimas.length === 0 ? <EmptyState icon={Wallet} titulo="Nenhuma transacao ainda" texto="Crie uma receita, despesa ou importe seu extrato CSV." /> : (
            <div className="space-y-3">
              {ultimas.map((transacao) => {
                const categoria = estado.categorias.find((item) => item.id === transacao.categoriaId);
                return (
                  <div key={transacao.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                    <div className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: categoria?.cor }} /><div><p className="font-semibold text-slate-900 dark:text-white">{transacao.descricao}</p><p className="text-sm text-slate-500">{categoria?.nome ?? 'Sem categoria'} - {new Date(transacao.data).toLocaleDateString('pt-BR')}</p></div></div>
                    <strong className={transacao.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'}>{transacao.tipo === 'receita' ? '+' : '-'}{formatarMoeda(transacao.valor)}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Insight({ titulo, valor, texto }: { titulo: string; valor: string; texto: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm font-semibold text-slate-500">{titulo}</p>
      <strong className="mt-2 block text-lg text-slate-950 dark:text-white">{valor}</strong>
      <p className="mt-1 text-sm text-slate-500">{texto}</p>
    </div>
  );
}
