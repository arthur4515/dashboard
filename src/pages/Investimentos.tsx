import { FormEvent, useState } from 'react';
import { Edit3, Plus, Trash2, TrendingUp } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppState, Investimento, TipoInvestimento } from '../types/financeiro';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { Section } from '../components/Section';
import { formatarMoeda } from '../utils/formatadores';
import { projetarInvestimento, uid } from '../utils/calculos';

type Props = {
  estado: AppState;
  setEstado: React.Dispatch<React.SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
};

const tipos: TipoInvestimento[] = ['Renda fixa', 'Acoes', 'Fundos', 'Cripto', 'Reserva de emergencia', 'Outros'];
const investimentoBase: Omit<Investimento, 'id'> = { nome: '', tipo: 'Renda fixa', valorInicial: 1000, aporteMensal: 200, rentabilidadeEsperada: 0.9, rentabilidadeAtual: 0.8 };

export function Investimentos({ estado, setEstado, avisar }: Props) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [form, setForm] = useState(investimentoBase);
  const totalInvestido = estado.investimentos.reduce((total, item) => total + item.valorInicial, 0);
  const lucroEstimado = estado.investimentos.reduce((total, item) => total + item.valorInicial * (item.rentabilidadeEsperada / 100) * 12, 0);
  const aporteMensal = estado.investimentos.reduce((total, item) => total + item.aporteMensal, 0);
  const serie = estado.investimentos.reduce((acc, item) => {
    projetarInvestimento(item, 24).forEach((ponto, index) => {
      acc[index] = { mes: ponto.mes, valor: (acc[index]?.valor ?? 0) + ponto.valor };
    });
    return acc;
  }, [] as { mes: number; valor: number }[]);

  function abrir(item?: Investimento) {
    setEditando(item ?? null);
    setForm(item ? { nome: item.nome, tipo: item.tipo, valorInicial: item.valorInicial, aporteMensal: item.aporteMensal, rentabilidadeEsperada: item.rentabilidadeEsperada, rentabilidadeAtual: item.rentabilidadeAtual } : investimentoBase);
    setModal(true);
  }

  function salvar(event: FormEvent) {
    event.preventDefault();
    if (!form.nome.trim() || form.valorInicial < 0) return avisar('Preencha o investimento corretamente.', 'erro');
    setEstado((atual) => atual && ({
      ...atual,
      investimentos: editando
        ? atual.investimentos.map((item) => item.id === editando.id ? { ...form, id: item.id } : item)
        : [...atual.investimentos, { ...form, id: uid('i') }],
    }));
    avisar('Investimento salvo.');
    setModal(false);
  }

  function excluir(id: string) {
    setEstado((atual) => atual && ({ ...atual, investimentos: atual.investimentos.filter((item) => item.id !== id) }));
    avisar('Investimento excluido.');
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard titulo="Total investido" valor={formatarMoeda(totalInvestido)} variacao={`${estado.investimentos.length} ativos cadastrados`} icon={TrendingUp} />
        <MetricCard titulo="Lucro estimado anual" valor={formatarMoeda(lucroEstimado)} variacao="Com base na rentabilidade esperada" icon={TrendingUp} tom="ambar" />
        <MetricCard titulo="Patrimonio projetado" valor={formatarMoeda(totalInvestido + lucroEstimado + aporteMensal * 12)} variacao="Projecao em 12 meses" icon={TrendingUp} tom="azul" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section titulo="Evolucao dos investimentos" acao={<button className="btn-primary" onClick={() => abrir()}><Plus size={18} />Novo investimento</button>}>
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={serie}>
                <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Line dataKey="valor" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section titulo="Carteira">
          <div className="space-y-3">
            {estado.investimentos.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-bold text-slate-950 dark:text-white">{item.nome}</h3><p className="text-sm text-slate-500">{item.tipo}</p></div>
                  <div className="flex items-center gap-2"><strong>{formatarMoeda(item.valorInicial)}</strong><button className="icon-btn" onClick={() => abrir(item)} aria-label="Editar"><Edit3 size={16} /></button><button className="icon-btn" onClick={() => excluir(item.id)} aria-label="Excluir"><Trash2 size={16} /></button></div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-slate-500">
                  <span>Aporte {formatarMoeda(item.aporteMensal)}</span><span>Esperada {item.rentabilidadeEsperada}%</span><span>Atual {item.rentabilidadeAtual}%</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Modal aberto={modal} titulo={editando ? 'Editar investimento' : 'Novo investimento'} onFechar={() => setModal(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={salvar}>
          <input className="input md:col-span-2" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoInvestimento })}>{tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}</select>
          <input className="input" type="number" value={form.valorInicial} onChange={(e) => setForm({ ...form, valorInicial: Number(e.target.value) })} />
          <input className="input" type="number" value={form.aporteMensal} onChange={(e) => setForm({ ...form, aporteMensal: Number(e.target.value) })} />
          <input className="input" type="number" step="0.01" value={form.rentabilidadeEsperada} onChange={(e) => setForm({ ...form, rentabilidadeEsperada: Number(e.target.value) })} />
          <input className="input" type="number" step="0.01" value={form.rentabilidadeAtual} onChange={(e) => setForm({ ...form, rentabilidadeAtual: Number(e.target.value) })} />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <button className="btn-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" type="submit">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
