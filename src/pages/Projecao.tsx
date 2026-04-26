import { Area, AreaChart, Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import { AppState } from '../types/financeiro';
import { Section } from '../components/Section';
import { formatarMoeda } from '../utils/formatadores';
import { mediasMensais, projetarPatrimonio, resumoMensal } from '../utils/calculos';
import { ChartFrame } from '../components/ChartFrame';

export function Projecao({ estado }: { estado: AppState }) {
  const resumo = resumoMensal(estado, new Date().toISOString().slice(0, 7));
  const medias = mediasMensais(estado);
  const aportes = estado.investimentos.reduce((total, item) => total + item.aporteMensal, 0);
  const pontos = [6, 12, 60, 120].map((meses) => {
    const serie = projetarPatrimonio(estado, meses);
    return { periodo: meses === 6 ? '6 meses' : meses === 12 ? '1 ano' : meses === 60 ? '5 anos' : '10 anos', patrimonio: serie[serie.length - 1].patrimonio };
  });
  const serie = projetarPatrimonio(estado, 120).filter((_, index) => index % 6 === 0);

  return (
    <div className="space-y-6">
      <Section titulo="Patrimonio futuro estimado">
        <div className="grid gap-4 md:grid-cols-4">
          {pontos.map((item) => (
            <div key={item.periodo} className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm text-slate-500">{item.periodo}</p>
              <strong className="mt-2 block text-2xl text-slate-950 dark:text-white">{formatarMoeda(item.patrimonio)}</strong>
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100">
          Projecao automatica usando saldo atual de {formatarMoeda(resumo.patrimonioTotal)}, media mensal de receitas de {formatarMoeda(medias.receita)}, media de despesas de {formatarMoeda(medias.despesa)}, aportes de {formatarMoeda(aportes)} e rentabilidade media da carteira.
        </p>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Section titulo="Curva de longo prazo">
          <ChartFrame className="h-[320px]">
            <AreaChart data={serie}>
              <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Area dataKey="patrimonio" stroke="#7C3AED" fill="#7C3AED22" strokeWidth={3} />
            </AreaChart>
          </ChartFrame>
        </Section>
        <Section titulo="Comparativo">
          <ChartFrame className="h-[320px]">
            <BarChart data={pontos}>
              <XAxis dataKey="periodo" /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Bar dataKey="patrimonio" fill="#7C3AED" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartFrame>
        </Section>
      </div>
    </div>
  );
}
