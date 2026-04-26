import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { AppState } from '../types/financeiro';
import { evolucaoComAtual, gastosPorCategoria, resumoMensal } from '../utils/calculos';
import { formatarMoeda, formatarPercentual, mesAtualISO } from '../utils/formatadores';
import { MetricCard } from '../components/MetricCard';
import { Section } from '../components/Section';
import { EmptyState } from '../components/EmptyState';
import { insightsFinanceiros, recorrenciasFuturas } from '../utils/automacoes';
import { ChartFrame } from '../components/ChartFrame';

export function Dashboard({ estado }: { estado: AppState }) {
  const mes = mesAtualISO();
  const resumo = resumoMensal(estado, mes);
  const evolucao = evolucaoComAtual(estado, mes);
  const categorias = gastosPorCategoria(estado, mes);
  const insights = insightsFinanceiros(estado, mes);
  const ultimas = [...estado.transacoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
  const futuras = recorrenciasFuturas(estado, 30).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard titulo="Saldo atual" valor={formatarMoeda(resumo.saldoAtual)} variacao="Somente transacoes realizadas" icon={Wallet} tom="azul" />
        <MetricCard titulo="Receita real do mes" valor={formatarMoeda(resumo.receita)} variacao={`Renda variavel: ${formatarMoeda(resumo.rendaVariavelMes)}`} icon={ArrowUpRight} tom="verde" />
        <MetricCard titulo="Despesa real do mes" valor={formatarMoeda(resumo.despesa)} variacao="Somente despesas realizadas" icon={ArrowDownRight} tom="vermelho" />
        <MetricCard titulo="Economia real" valor={formatarMoeda(resumo.economia)} variacao="Receita real menos despesa real" icon={PiggyBank} tom="ambar" />
        <MetricCard titulo="Saldo previsto" valor={formatarMoeda(resumo.saldoPrevisto)} variacao="Saldo atual + previsoes do mes" icon={Landmark} tom="azul" />
        <MetricCard titulo="Receita prevista" valor={formatarMoeda(resumo.receitaPrevista)} variacao="Previstos e recorrencias futuras" icon={TrendingUp} tom="verde" />
        <MetricCard titulo="Despesa prevista" valor={formatarMoeda(resumo.despesaPrevista)} variacao="Previstos e recorrencias futuras" icon={AlertTriangle} tom="vermelho" />
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
            <ChartFrame className="h-[320px]">
              <AreaChart data={evolucao}>
                <defs><linearGradient id="patrimonio" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#7C3AED" stopOpacity={0.35} /><stop offset="95%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Area dataKey="patrimonio" stroke="#7C3AED" fill="url(#patrimonio)" strokeWidth={3} />
                <Area dataKey="investimentos" stroke="#A78BFA" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ChartFrame>
          )}
        </Section>

        <Section titulo="Gastos por categoria">
          {categorias.length === 0 ? <EmptyState icon={AlertTriangle} titulo="Sem despesas no mes" texto="Quando houver despesas, o grafico aparece aqui." /> : (
            <ChartFrame className="h-[320px]">
              <PieChart>
                <Pie data={categorias} dataKey="value" nameKey="name" innerRadius={70} outerRadius={112} paddingAngle={4}>{categorias.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie>
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              </PieChart>
            </ChartFrame>
          )}
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section titulo="Receitas x despesas">
          <ChartFrame className="h-[300px]">
            <BarChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Bar dataKey="receita" fill="#10B981" radius={[6, 6, 0, 0]} /><Bar dataKey="despesa" fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartFrame>
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

      <Section titulo="Proximos lancamentos recorrentes">
        {futuras.length === 0 ? <EmptyState icon={Wallet} titulo="Sem recorrencias futuras" texto="Cadastre recorrencias para visualizar previsoes dos proximos dias." /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {futuras.map((item) => (
              <div key={`${item.recorrente.id}-${item.data}`} className="rounded-lg border border-violet-100 p-3 dark:border-violet-950">
                <p className="text-sm text-slate-500">{new Date(item.data).toLocaleDateString('pt-BR')}</p>
                <strong className="mt-1 block text-slate-950 dark:text-white">{item.recorrente.descricao}</strong>
                <span className={item.recorrente.tipo === 'receita' ? 'text-sm font-bold text-emerald-600' : 'text-sm font-bold text-rose-600'}>{formatarMoeda(item.recorrente.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Insight({ titulo, valor, texto }: { titulo: string; valor: string; texto: string }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-4 dark:border-violet-950 dark:from-[#17102A] dark:to-[#0F0A1F]">
      <p className="text-sm font-semibold text-slate-500">{titulo}</p>
      <strong className="mt-2 block text-lg text-slate-950 dark:text-white">{valor}</strong>
      <p className="mt-1 text-sm text-slate-500">{texto}</p>
    </div>
  );
}
