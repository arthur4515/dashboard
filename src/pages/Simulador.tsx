import { useMemo, useState } from 'react';
import { Calculator, CircleDollarSign, Percent, Wallet } from 'lucide-react';
import { Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { MetricCard } from '../components/MetricCard';
import { Section } from '../components/Section';
import { formatarMoeda } from '../utils/formatadores';
import { simularCompostos } from '../utils/calculos';
import { ChartFrame } from '../components/ChartFrame';

export function Simulador() {
  const [valorInicial, setValorInicial] = useState(10000);
  const [aporteMensal, setAporteMensal] = useState(1000);
  const [taxa, setTaxa] = useState(0.9);
  const [periodo, setPeriodo] = useState(5);
  const [unidade, setUnidade] = useState<'meses' | 'anos'>('anos');
  const [tipoTaxa, setTipoTaxa] = useState<'mensal' | 'anual'>('mensal');
  const meses = unidade === 'anos' ? periodo * 12 : periodo;
  const taxaMensal = tipoTaxa === 'anual' ? (Math.pow(1 + taxa / 100, 1 / 12) - 1) * 100 : taxa;
  const resultado = useMemo(() => simularCompostos(valorInicial, aporteMensal, taxaMensal, meses), [valorInicial, aporteMensal, taxaMensal, meses]);
  const cenarios = [
    { nome: 'Conservador', ...simularCompostos(valorInicial, aporteMensal, 0.55, meses) },
    { nome: 'Moderado', ...simularCompostos(valorInicial, aporteMensal, 0.9, meses) },
    { nome: 'Otimista', ...simularCompostos(valorInicial, aporteMensal, 1.25, meses) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard titulo="Resultado final" valor={formatarMoeda(resultado.final)} variacao={`${meses} meses simulados`} icon={Wallet} />
        <MetricCard titulo="Total investido" valor={formatarMoeda(resultado.investido)} variacao="Inicial + aportes" icon={CircleDollarSign} tom="azul" />
        <MetricCard titulo="Juros acumulados" valor={formatarMoeda(resultado.juros)} variacao={`${taxaMensal.toFixed(2)}% ao mês`} icon={Percent} tom="ambar" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Section titulo="Parâmetros">
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Valor inicial<input className="input mt-1" type="number" value={valorInicial} onChange={(e) => setValorInicial(Number(e.target.value))} /></label>
            <label className="block text-sm font-semibold">Aporte mensal<input className="input mt-1" type="number" value={aporteMensal} onChange={(e) => setAporteMensal(Number(e.target.value))} /></label>
            <label className="block text-sm font-semibold">Taxa<input className="input mt-1" type="number" step="0.01" value={taxa} onChange={(e) => setTaxa(Number(e.target.value))} /></label>
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={tipoTaxa} onChange={(e) => setTipoTaxa(e.target.value as 'mensal' | 'anual')}><option value="mensal">Mensal</option><option value="anual">Anual</option></select>
              <input className="input" type="number" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))} />
            </div>
            <select className="input" value={unidade} onChange={(e) => setUnidade(e.target.value as 'meses' | 'anos')}><option value="anos">Anos</option><option value="meses">Meses</option></select>
          </div>
        </Section>

        <Section titulo="Evolução mês a mês">
          <ChartFrame className="h-[320px]">
            <LineChart data={resultado.serie}>
              <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Line dataKey="saldo" stroke="#7C3AED" strokeWidth={3} dot={false} />
              <Line dataKey="investido" stroke="#A78BFA" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartFrame>
        </Section>
      </div>

      <Section titulo="Comparação de cenários">
        <div className="grid gap-4 md:grid-cols-3">
          {cenarios.map((cenario) => (
            <div key={cenario.nome} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-bold text-slate-950 dark:text-white">{cenario.nome}</h3>
              <p className="mt-2 text-2xl font-bold text-violet-700 dark:text-violet-200">{formatarMoeda(cenario.final)}</p>
              <p className="mt-1 text-sm text-slate-500">Juros: {formatarMoeda(cenario.juros)}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
