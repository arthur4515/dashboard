import { FormEvent, useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarDays, CircleDollarSign, Plus } from 'lucide-react';
import { AppState, SessaoTrabalho } from '../types/financeiro';
import { MetricCard } from '../components/MetricCard';
import { Section } from '../components/Section';
import { EmptyState } from '../components/EmptyState';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';
import { uid } from '../utils/calculos';

type Props = {
  estado: AppState;
  setEstado: React.Dispatch<React.SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
};

export function RendaVariavel({ estado, setEstado, avisar }: Props) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState(8);
  const [valorHora, setValorHora] = useState(25);
  const [mes, setMes] = useState(mesAtualISO());
  const total = horas * valorHora;
  const sessoesMes = useMemo(() => estado.sessoesTrabalho.filter((item) => item.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data)), [estado.sessoesTrabalho, mes]);
  const totalMes = sessoesMes.reduce((soma, item) => soma + item.totalGanho, 0);
  const totalHoras = sessoesMes.reduce((soma, item) => soma + item.horasTrabalhadas, 0);
  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  const totalSemana = estado.sessoesTrabalho
    .filter((item) => new Date(`${item.data}T00:00:00`) >= inicioSemana)
    .reduce((soma, item) => soma + item.totalGanho, 0);

  function salvarSessao(event: FormEvent) {
    event.preventDefault();
    if (!data || horas <= 0 || valorHora <= 0) {
      avisar('Preencha data, horas e valor por hora.', 'erro');
      return;
    }
    const sessao: SessaoTrabalho = { id: uid('work'), data, horasTrabalhadas: horas, valorHora, totalGanho: total };
    setEstado((atual) => atual && ({ ...atual, sessoesTrabalho: [sessao, ...atual.sessoesTrabalho] }));
    avisar('Sessao de trabalho registrada.');
  }

  function converterEmReceita(sessao: SessaoTrabalho) {
    if (sessao.transacaoId) return avisar('Esta sessao ja foi convertida em receita.', 'info');
    const categoriaReceita = estado.categorias.find((categoria) => categoria.tipo === 'receita');
    if (!categoriaReceita) return avisar('Crie uma categoria de receita antes de converter.', 'erro');
    const transacaoId = uid('work-income');
    setEstado((atual) => atual && ({
      ...atual,
      sessoesTrabalho: atual.sessoesTrabalho.map((item) => item.id === sessao.id ? { ...item, transacaoId } : item),
      transacoes: [{
        id: transacaoId,
        tipo: 'receita',
        categoriaId: categoriaReceita.id,
        descricao: `Renda variavel - ${sessao.horasTrabalhadas}h`,
        valor: sessao.totalGanho,
        data: sessao.data,
        status: 'realizado',
      }, ...atual.transacoes],
    }));
    avisar('Receita criada a partir da sessao.');
  }

  function excluirSessao(id: string) {
    setEstado((atual) => atual && ({ ...atual, sessoesTrabalho: atual.sessoesTrabalho.filter((item) => item.id !== id) }));
    avisar('Sessao removida.');
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard titulo="Ganhos no mes" valor={formatarMoeda(totalMes)} variacao={`${totalHoras.toFixed(1)} horas registradas`} icon={CircleDollarSign} tom="verde" />
        <MetricCard titulo="Ganhos na semana" valor={formatarMoeda(totalSemana)} variacao="Com base nas sessoes registradas" icon={CalendarDays} />
        <MetricCard titulo="Valor medio/hora" valor={formatarMoeda(totalHoras ? totalMes / totalHoras : 0)} variacao="Media do mes filtrado" icon={BriefcaseBusiness} tom="azul" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Section titulo="Registrar horas">
          <form className="space-y-4" onSubmit={salvarSessao}>
            <label className="block text-sm font-semibold">Data<input className="input mt-1" type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
            <label className="block text-sm font-semibold">Horas trabalhadas<input className="input mt-1" type="number" min="0" step="0.25" value={horas} onChange={(e) => setHoras(Number(e.target.value))} /></label>
            <label className="block text-sm font-semibold">Valor por hora<input className="input mt-1" type="number" min="0" step="0.01" value={valorHora} onChange={(e) => setValorHora(Number(e.target.value))} /></label>
            <div className="rounded-lg bg-violet-50 p-3 text-sm font-bold text-violet-900 dark:bg-violet-950 dark:text-violet-100">Total estimado: {formatarMoeda(total)}</div>
            <button className="btn-primary w-full" type="submit"><Plus size={18} />Salvar horas</button>
          </form>
        </Section>

        <Section titulo="Historico de renda variavel" acao={<input className="input w-40" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />}>
          {sessoesMes.length === 0 ? <EmptyState icon={BriefcaseBusiness} titulo="Nenhuma hora registrada" texto="Registre suas horas para calcular renda semanal e mensal." /> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessoesMes.map((sessao) => (
                <div key={sessao.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold text-slate-950 dark:text-white">{new Date(`${sessao.data}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                    <p className="text-sm text-slate-500">{sessao.horasTrabalhadas}h x {formatarMoeda(sessao.valorHora)}/h</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-emerald-600">{formatarMoeda(sessao.totalGanho)}</strong>
                    <button className="btn-secondary" onClick={() => converterEmReceita(sessao)}>{sessao.transacaoId ? 'Convertida' : 'Converter em receita'}</button>
                    <button className="icon-btn" onClick={() => excluirSessao(sessao.id)} aria-label="Excluir">x</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
