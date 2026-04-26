import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppState } from '../types/financeiro';
import { Section } from '../components/Section';
import { formatarMoeda } from '../utils/formatadores';
import { mediasMensais, projetarPatrimonio, resumoMensal } from '../utils/calculos';

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
        <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Projecao automatica usando saldo atual de {formatarMoeda(resumo.patrimonioTotal)}, media mensal de receitas de {formatarMoeda(medias.receita)}, media de despesas de {formatarMoeda(medias.despesa)}, aportes de {formatarMoeda(aportes)} e rentabilidade media da carteira.
        </p>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Section titulo="Curva de longo prazo">
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={serie}>
                <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Area dataKey="patrimonio" stroke="#10b981" fill="#10b98122" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section titulo="Comparativo">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={pontos}>
                <XAxis dataKey="periodo" /><YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Bar dataKey="patrimonio" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    </div>
  );
}
