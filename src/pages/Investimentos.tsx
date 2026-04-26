import { FormEvent, useMemo, useState } from 'react';
import { Edit3, Plus, RefreshCcw, Trash2, TrendingUp } from 'lucide-react';
import { Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { AppState, DetalhesInvestimento, Investimento, TipoInvestimento } from '../types/financeiro';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { Section } from '../components/Section';
import { EmptyState } from '../components/EmptyState';
import { formatarMoeda } from '../utils/formatadores';
import { projetarInvestimento, uid } from '../utils/calculos';
import { ChartFrame } from '../components/ChartFrame';
import { buscarCotacaoAtivo } from '../services/marketData';

type Props = {
  estado: AppState;
  setEstado: React.Dispatch<React.SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
};

const tipos: TipoInvestimento[] = ['CDB', 'Tesouro Direto', 'LCI/LCA', 'FII', 'Acao', 'ETF', 'Cripto', 'Reserva de emergencia', 'Outro'];
const investimentoBase: Omit<Investimento, 'id'> = { nome: '', tipo: 'CDB', valorInicial: 0, aporteMensal: 0, rentabilidadeEsperada: 0.9, rentabilidadeAtual: 0, detalhes: { liquidez: 'diaria' } };
const cores = ['#7C3AED', '#A78BFA', '#10B981', '#F59E0B', '#EF4444', '#4C1D95'];

export function Investimentos({ estado, setEstado, avisar }: Props) {
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [form, setForm] = useState(investimentoBase);
  const [atualizando, setAtualizando] = useState(false);
  const ativos = estado.investimentos;
  const totalInvestido = ativos.reduce((total, item) => total + valorAtual(item), 0);
  const custoTotal = ativos.reduce((total, item) => total + custoInvestido(item), 0);
  const lucroTotal = totalInvestido - custoTotal;
  const dividendos = ativos.reduce((total, item) => total + (item.detalhes?.dividendosMensais ?? 0), 0);
  const rentabilidade = custoTotal > 0 ? (lucroTotal / custoTotal) * 100 : 0;
  const alocacao = tipos.map((tipo) => ({ name: tipo, value: ativos.filter((item) => item.tipo === tipo).reduce((total, item) => total + valorAtual(item), 0) })).filter((item) => item.value > 0);
  const serie = useMemo(() => ativos.reduce((acc, item) => {
    projetarInvestimento({ ...item, valorInicial: valorAtual(item) }, 24).forEach((ponto, index) => {
      acc[index] = { mes: ponto.mes, valor: (acc[index]?.valor ?? 0) + ponto.valor };
    });
    return acc;
  }, [] as { mes: number; valor: number }[]), [ativos]);

  function abrir(item?: Investimento) {
    setEditando(item ?? null);
    setForm(item ? { nome: item.nome, tipo: item.tipo, valorInicial: item.valorInicial, aporteMensal: item.aporteMensal, rentabilidadeEsperada: item.rentabilidadeEsperada, rentabilidadeAtual: item.rentabilidadeAtual, detalhes: item.detalhes ?? {} } : investimentoBase);
    setModal(true);
  }

  function salvar(event: FormEvent) {
    event.preventDefault();
    if (!form.nome.trim()) return avisar('Informe o nome do ativo.', 'erro');
    const normalizado = normalizarInvestimento(form);
    setEstado((atual) => atual && ({
      ...atual,
      investimentos: editando
        ? atual.investimentos.map((item) => item.id === editando.id ? { ...normalizado, id: item.id } : item)
        : [...atual.investimentos, { ...normalizado, id: uid('i') }],
    }));
    avisar('Investimento salvo.');
    setModal(false);
  }

  function excluir(id: string) {
    setEstado((atual) => atual && ({ ...atual, investimentos: atual.investimentos.filter((item) => item.id !== id) }));
    avisar('Investimento excluido.');
  }

  async function atualizarCotacoes() {
    setAtualizando(true);
    const resultados = await Promise.all(ativos.map(async (ativo) => ({ ativo, cotacao: await buscarCotacaoAtivo(ativo) })));
    let atualizados = 0;
    setEstado((atual) => atual && ({
      ...atual,
      investimentos: atual.investimentos.map((item) => {
        const resultado = resultados.find((r) => r.ativo.id === item.id);
        if (!resultado?.cotacao.precoAtual) return item;
        atualizados += 1;
        return { ...item, detalhes: { ...item.detalhes, precoAtual: resultado.cotacao.precoAtual, dividendosMensais: resultado.cotacao.dividendosMensais ?? item.detalhes?.dividendosMensais } };
      }),
    }));
    setAtualizando(false);
    avisar(atualizados ? `${atualizados} cotacao(oes) atualizada(s).` : 'API de cotacoes nao configurada. Use valores manuais.', atualizados ? 'sucesso' : 'info');
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard titulo="Patrimonio investido" valor={formatarMoeda(totalInvestido)} variacao={`${ativos.length} ativo(s)`} icon={TrendingUp} />
        <MetricCard titulo="Lucro/prejuizo" valor={formatarMoeda(lucroTotal)} variacao={`${rentabilidade.toFixed(2)}% na carteira`} icon={TrendingUp} tom={lucroTotal >= 0 ? 'verde' : 'vermelho'} />
        <MetricCard titulo="Rentabilidade" valor={`${rentabilidade.toFixed(2)}%`} variacao="Sobre custo total" icon={TrendingUp} tom="ambar" />
        <MetricCard titulo="Dividendos mensais" valor={formatarMoeda(dividendos)} variacao="FIIs e ativos com renda" icon={TrendingUp} tom="azul" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Section titulo="Evolucao projetada" acao={<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={atualizarCotacoes} disabled={atualizando}><RefreshCcw size={18} />{atualizando ? 'Atualizando' : 'Atualizar cotacoes'}</button><button className="btn-primary" onClick={() => abrir()}><Plus size={18} />Adicionar ativo</button></div>}>
          {serie.length === 0 ? <EmptyState icon={TrendingUp} titulo="Carteira vazia" texto="Adicione ativos para ver evolucao, alocacao e rentabilidade." /> : (
            <ChartFrame className="h-[320px]">
              <LineChart data={serie}>
                <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Line dataKey="valor" stroke="#7C3AED" strokeWidth={3} dot={false} />
              </LineChart>
            </ChartFrame>
          )}
        </Section>

        <Section titulo="Alocacao por tipo">
          {alocacao.length === 0 ? <EmptyState icon={TrendingUp} titulo="Sem alocacao" texto="A distribuicao aparece quando houver ativos cadastrados." /> : (
            <ChartFrame className="h-[320px]">
              <PieChart>
                <Pie data={alocacao} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={4}>{alocacao.map((item, index) => <Cell key={item.name} fill={cores[index % cores.length]} />)}</Pie>
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              </PieChart>
            </ChartFrame>
          )}
        </Section>
      </div>

      <Section titulo="Ativos da carteira">
        {ativos.length === 0 ? <EmptyState icon={TrendingUp} titulo="Nenhum ativo cadastrado" texto="Cadastre CDB, Tesouro, FII, acoes, ETF, cripto ou reserva." /> : (
          <div className="space-y-3">
            {ativos.map((item) => (
              <div key={item.id} className="rounded-lg border border-violet-100 p-4 dark:border-violet-950">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h3 className="font-bold text-slate-950 dark:text-white">{item.nome}</h3><p className="text-sm text-slate-500">{item.tipo} {item.detalhes?.ticker ? `- ${item.detalhes.ticker}` : ''}</p></div>
                  <div className="flex items-center gap-2"><strong>{formatarMoeda(valorAtual(item))}</strong><button className="icon-btn" onClick={() => abrir(item)} aria-label="Editar"><Edit3 size={16} /></button><button className="icon-btn" onClick={() => excluir(item.id)} aria-label="Excluir"><Trash2 size={16} /></button></div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-4">
                  <span>Custo {formatarMoeda(custoInvestido(item))}</span><span>Resultado {formatarMoeda(valorAtual(item) - custoInvestido(item))}</span><span>Aporte {formatarMoeda(item.aporteMensal)}</span><span>DY {Number(item.detalhes?.dividendYield ?? 0).toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Modal aberto={modal} titulo={editando ? 'Editar ativo' : 'Adicionar ativo'} onFechar={() => setModal(false)}>
        <form className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1 md:grid-cols-2" onSubmit={salvar}>
          <input className="input md:col-span-2" placeholder="Nome do ativo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoInvestimento, detalhes: {} })}>{tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}</select>
          <input className="input" type="number" placeholder="Valor inicial" value={form.valorInicial} onChange={(e) => setForm({ ...form, valorInicial: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Aporte mensal" value={form.aporteMensal} onChange={(e) => setForm({ ...form, aporteMensal: Number(e.target.value) })} />
          <input className="input" type="number" step="0.01" placeholder="Rentabilidade esperada % mes" value={form.rentabilidadeEsperada} onChange={(e) => setForm({ ...form, rentabilidadeEsperada: Number(e.target.value) })} />
          <CamposDetalhes tipo={form.tipo} detalhes={form.detalhes ?? {}} onChange={(detalhes) => setForm({ ...form, detalhes })} />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2"><button className="btn-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="btn-primary" type="submit">Salvar ativo</button></div>
        </form>
      </Modal>
    </div>
  );
}

function CamposDetalhes({ tipo, detalhes, onChange }: { tipo: TipoInvestimento; detalhes: DetalhesInvestimento; onChange: (detalhes: DetalhesInvestimento) => void }) {
  const set = (campo: keyof DetalhesInvestimento, valor: string | number) => onChange({ ...detalhes, [campo]: valor });
  if (tipo === 'CDB' || tipo === 'LCI/LCA' || tipo === 'Tesouro Direto' || tipo === 'Reserva de emergencia') {
    return (
      <>
        <input className="input" placeholder="Banco/emissor" value={detalhes.emissor ?? ''} onChange={(e) => set('emissor', e.target.value)} />
        <input className="input" type="number" placeholder="% do CDI" value={detalhes.percentualCdi ?? 100} onChange={(e) => set('percentualCdi', Number(e.target.value))} />
        <input className="input" type="date" value={detalhes.vencimento ?? ''} onChange={(e) => set('vencimento', e.target.value)} />
        <select className="input" value={detalhes.liquidez ?? 'diaria'} onChange={(e) => set('liquidez', e.target.value)}><option value="diaria">Liquidez diaria</option><option value="vencimento">No vencimento</option></select>
      </>
    );
  }
  if (tipo === 'FII' || tipo === 'Acao' || tipo === 'ETF') {
    return (
      <>
        <input className="input" placeholder="Ticker ex: MXRF11" value={detalhes.ticker ?? ''} onChange={(e) => set('ticker', e.target.value.toUpperCase())} />
        <input className="input" type="number" placeholder="Quantidade" value={detalhes.quantidade ?? 0} onChange={(e) => set('quantidade', Number(e.target.value))} />
        <input className="input" type="number" placeholder="Preco medio" value={detalhes.precoMedio ?? 0} onChange={(e) => set('precoMedio', Number(e.target.value))} />
        <input className="input" type="number" placeholder="Preco atual" value={detalhes.precoAtual ?? 0} onChange={(e) => set('precoAtual', Number(e.target.value))} />
        {tipo === 'FII' && <input className="input" type="number" placeholder="Dividendos mensais" value={detalhes.dividendosMensais ?? 0} onChange={(e) => set('dividendosMensais', Number(e.target.value))} />}
      </>
    );
  }
  if (tipo === 'Cripto') {
    return (
      <>
        <input className="input" placeholder="Moeda ex: BTC" value={detalhes.moeda ?? ''} onChange={(e) => set('moeda', e.target.value.toUpperCase())} />
        <input className="input" type="number" placeholder="Quantidade" value={detalhes.quantidade ?? 0} onChange={(e) => set('quantidade', Number(e.target.value))} />
        <input className="input" type="number" placeholder="Preco medio" value={detalhes.precoMedio ?? 0} onChange={(e) => set('precoMedio', Number(e.target.value))} />
        <input className="input" type="number" placeholder="Preco atual" value={detalhes.precoAtual ?? 0} onChange={(e) => set('precoAtual', Number(e.target.value))} />
      </>
    );
  }
  return null;
}

function custoInvestido(item: Investimento) {
  const quantidade = item.detalhes?.quantidade;
  const precoMedio = item.detalhes?.precoMedio;
  return quantidade && precoMedio ? quantidade * precoMedio : item.valorInicial;
}

function valorAtual(item: Investimento) {
  const quantidade = item.detalhes?.quantidade;
  const precoAtual = item.detalhes?.precoAtual;
  return quantidade && precoAtual ? quantidade * precoAtual : item.valorInicial;
}

function normalizarInvestimento(item: Omit<Investimento, 'id'>): Omit<Investimento, 'id'> {
  const detalhes = item.detalhes ?? {};
  const valorAtualAtivo = valorAtual({ ...item, id: 'tmp' });
  const custo = custoInvestido({ ...item, id: 'tmp' });
  return {
    ...item,
    valorInicial: valorAtualAtivo || item.valorInicial,
    rentabilidadeAtual: custo > 0 ? ((valorAtualAtivo - custo) / custo) * 100 : item.rentabilidadeAtual,
    detalhes: {
      ...detalhes,
      dividendYield: valorAtualAtivo > 0 ? ((detalhes.dividendosMensais ?? 0) * 12 / valorAtualAtivo) * 100 : detalhes.dividendYield,
    },
  };
}
