import { useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarDays, CircleDollarSign, Clock3, Settings, Zap } from 'lucide-react';
import { AppState, SessaoTrabalho, TipoSessaoTrabalho } from '../types/financeiro';
import { MetricCard } from '../components/MetricCard';
import { Section } from '../components/Section';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';
import { uid } from '../utils/calculos';

type Props = {
  estado: AppState;
  setEstado: React.Dispatch<React.SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
};

const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export function RendaVariavel({ estado, setEstado, avisar }: Props) {
  const [mes, setMes] = useState(mesAtualISO());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [horasExtra, setHorasExtra] = useState(2);
  const [configAberta, setConfigAberta] = useState(false);
  const config = estado.configuracaoRendaVariavel;
  const sessoesMes = useMemo(() => estado.sessoesTrabalho.filter((item) => item.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data)), [estado.sessoesTrabalho, mes]);
  const mapaSessoes = useMemo(() => new Map(sessoesMes.map((sessao) => [sessao.data, sessao])), [sessoesMes]);
  const diasCalendario = useMemo(() => montarCalendario(mes), [mes]);
  const totalMes = sessoesMes.reduce((soma, item) => soma + item.totalGanho, 0);
  const totalHoras = sessoesMes.reduce((soma, item) => soma + item.horasTrabalhadas, 0);
  const faltas = sessoesMes.filter((item) => item.tipo === 'falta').length;
  const horasExtras = sessoesMes.filter((item) => item.tipo === 'extra').reduce((soma, item) => soma + item.horasTrabalhadas, 0);

  function registrarDia(data: string, tipo: TipoSessaoTrabalho, horasCustom?: number) {
    const horas = tipo === 'falta' ? 0 : tipo === 'extra' ? Math.max(horasCustom ?? horasExtra, 0) : config.horasPadraoDia;
    if (tipo !== 'falta' && horas <= 0) return avisar('Informe uma quantidade de horas valida.', 'erro');
    const valor = calcularGanho(horas, tipo, config.valorHoraPadrao, config.multiplicadorHoraExtra);
    const existente = mapaSessoes.get(data);
    const transacaoExistenteId = existente?.transacaoId;
    const transacaoId = tipo === 'falta' ? undefined : transacaoExistenteId ?? uid('work-income');
    const sessao: SessaoTrabalho = {
      id: existente?.id ?? uid('work'),
      data,
      tipo,
      horasTrabalhadas: horas,
      valorHora: config.valorHoraPadrao,
      totalGanho: valor,
      transacaoId,
    };

    setEstado((atual) => {
      if (!atual) return atual;
      const categoria = garantirCategoriaRendaVariavel(atual);
      const semSessao = atual.sessoesTrabalho.filter((item) => item.id !== sessao.id);
      const transacoesSemAntiga = transacaoExistenteId ? atual.transacoes.filter((item) => item.id !== transacaoExistenteId) : atual.transacoes;
      const transacoes = tipo === 'falta' ? transacoesSemAntiga : [{
        id: transacaoId!,
        tipo: 'receita' as const,
        categoriaId: categoria.id,
        descricao: tipo === 'extra' ? `Hora extra - ${horas}h` : `Renda variavel - ${horas}h`,
        valor,
        data,
        status: 'realizado' as const,
      }, ...transacoesSemAntiga];
      return {
        ...atual,
        categorias: atual.categorias.some((item) => item.id === categoria.id) ? atual.categorias : [...atual.categorias, categoria],
        sessoesTrabalho: [sessao, ...semSessao].sort((a, b) => b.data.localeCompare(a.data)),
        transacoes,
      };
    });
    setDiaSelecionado(null);
    avisar(tipo === 'falta' ? 'Falta registrada.' : 'Dia registrado e receita criada.');
  }

  function removerDia(sessao: SessaoTrabalho) {
    setEstado((atual) => atual && ({
      ...atual,
      sessoesTrabalho: atual.sessoesTrabalho.filter((item) => item.id !== sessao.id),
      transacoes: sessao.transacaoId ? atual.transacoes.filter((item) => item.id !== sessao.transacaoId) : atual.transacoes,
    }));
    setDiaSelecionado(null);
    avisar('Registro removido.');
  }

  function atualizarConfig(campo: keyof typeof config, valor: number) {
    setEstado((atual) => atual && ({ ...atual, configuracaoRendaVariavel: { ...atual.configuracaoRendaVariavel, [campo]: valor } }));
  }

  const sessaoSelecionada = diaSelecionado ? mapaSessoes.get(diaSelecionado) : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard titulo="Total no mes" valor={formatarMoeda(totalMes)} variacao="Receitas geradas automaticamente" icon={CircleDollarSign} tom="verde" />
        <MetricCard titulo="Horas trabalhadas" valor={`${totalHoras.toFixed(1)}h`} variacao={`${config.horasPadraoDia}h por dia normal`} icon={Clock3} />
        <MetricCard titulo="Media por hora" valor={formatarMoeda(totalHoras ? totalMes / totalHoras : 0)} variacao={`${formatarMoeda(config.valorHoraPadrao)}/h padrao`} icon={BriefcaseBusiness} tom="azul" />
        <MetricCard titulo="Faltas" valor={String(faltas)} variacao="Dias sem ganho" icon={CalendarDays} tom="vermelho" />
        <MetricCard titulo="Horas extras" valor={`${horasExtras.toFixed(1)}h`} variacao={`${config.multiplicadorHoraExtra}x multiplicador`} icon={Zap} tom="ambar" />
      </div>

      <Section titulo="Calendario de trabalho" acao={<div className="flex gap-2"><input className="input w-40" type="month" value={mes} onChange={(e) => setMes(e.target.value)} /><button className="icon-btn" onClick={() => setConfigAberta(true)} aria-label="Configurar renda variavel"><Settings size={18} /></button></div>}>
        <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100">
          Clique em um dia e escolha: Trabalhei, Faltei ou Hora extra. O app calcula o ganho e cria a receita automaticamente.
        </div>
        <div className="grid grid-cols-7 gap-2">
          {nomesDias.map((dia) => <div key={dia} className="py-2 text-center text-xs font-bold uppercase text-slate-500">{dia}</div>)}
          {diasCalendario.map((dia) => {
            const sessao = dia.data ? mapaSessoes.get(dia.data) : undefined;
            return (
              <button
                key={dia.chave}
                disabled={!dia.data}
                onClick={() => dia.data && setDiaSelecionado(dia.data)}
                className={`min-h-24 rounded-lg border p-2 text-left transition ${!dia.data ? 'border-transparent' : classeDia(sessao)}`}
              >
                {dia.data && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-950 dark:text-white">{dia.numero}</span>
                      {sessao && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-[#17102A] dark:text-violet-200">{rotuloTipo(sessao.tipo)}</span>}
                    </div>
                    <p className="mt-4 text-xs text-slate-500">{sessao ? `${sessao.horasTrabalhadas}h` : 'Sem registro'}</p>
                    <strong className={sessao?.tipo === 'falta' ? 'text-rose-600' : 'text-emerald-600'}>{sessao ? formatarMoeda(sessao.totalGanho) : ''}</strong>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section titulo="Historico do mes">
        {sessoesMes.length === 0 ? <EmptyState icon={BriefcaseBusiness} titulo="Nenhum dia registrado" texto="Use o calendario acima para marcar dias trabalhados, faltas e horas extras." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sessoesMes.map((sessao) => (
              <div key={sessao.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">{new Date(`${sessao.data}T00:00:00`).toLocaleDateString('pt-BR')} - {rotuloTipo(sessao.tipo)}</p>
                  <p className="text-sm text-slate-500">{sessao.horasTrabalhadas}h x {formatarMoeda(sessao.valorHora)}/h</p>
                </div>
                <strong className={sessao.tipo === 'falta' ? 'text-rose-600' : 'text-emerald-600'}>{formatarMoeda(sessao.totalGanho)}</strong>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Modal aberto={!!diaSelecionado} titulo={diaSelecionado ? new Date(`${diaSelecionado}T00:00:00`).toLocaleDateString('pt-BR') : 'Dia'} onFechar={() => setDiaSelecionado(null)}>
        {diaSelecionado && (
          <div className="space-y-4">
            {sessaoSelecionada && <div className="rounded-lg bg-violet-50 p-3 text-sm font-bold text-violet-900 dark:bg-violet-950 dark:text-violet-100">Atual: {rotuloTipo(sessaoSelecionada.tipo)} - {formatarMoeda(sessaoSelecionada.totalGanho)}</div>}
            <button className="btn-primary w-full" onClick={() => registrarDia(diaSelecionado, 'normal')}>Trabalhei ({config.horasPadraoDia}h)</button>
            <button className="btn-secondary w-full" onClick={() => registrarDia(diaSelecionado, 'falta')}>Faltei</button>
            <div className="rounded-lg border border-violet-100 p-3 dark:border-violet-900">
              <label className="block text-sm font-semibold">Horas extras<input className="input mt-1" type="number" min="0" step="0.25" value={horasExtra} onChange={(e) => setHorasExtra(Number(e.target.value))} /></label>
              <button className="btn-secondary mt-3 w-full" onClick={() => registrarDia(diaSelecionado, 'extra', horasExtra)}>Registrar hora extra</button>
            </div>
            {sessaoSelecionada && <button className="btn-secondary w-full" onClick={() => removerDia(sessaoSelecionada)}>Remover registro do dia</button>}
          </div>
        )}
      </Modal>

      <Modal aberto={configAberta} titulo="Configuracao da renda variavel" onFechar={() => setConfigAberta(false)}>
        <div className="grid gap-4">
          <label className="block text-sm font-semibold">Valor por hora padrao<input className="input mt-1" type="number" min="0" step="0.01" value={config.valorHoraPadrao} onChange={(e) => atualizarConfig('valorHoraPadrao', Number(e.target.value))} /></label>
          <label className="block text-sm font-semibold">Horas padrao por dia<input className="input mt-1" type="number" min="0" step="0.25" value={config.horasPadraoDia} onChange={(e) => atualizarConfig('horasPadraoDia', Number(e.target.value))} /></label>
          <label className="block text-sm font-semibold">Multiplicador de hora extra<input className="input mt-1" type="number" min="1" step="0.1" value={config.multiplicadorHoraExtra} onChange={(e) => atualizarConfig('multiplicadorHoraExtra', Number(e.target.value))} /></label>
          <button className="btn-primary" onClick={() => { setConfigAberta(false); avisar('Configuracao salva.'); }}>Salvar configuracao</button>
        </div>
      </Modal>
    </div>
  );
}

function calcularGanho(horas: number, tipo: TipoSessaoTrabalho, valorHora: number, multiplicadorExtra: number) {
  if (tipo === 'falta') return 0;
  if (tipo === 'extra') return horas * valorHora * multiplicadorExtra;
  return horas * valorHora;
}

function montarCalendario(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
  const totalDias = new Date(ano, mes, 0).getDate();
  const vazios = Array.from({ length: primeiro.getDay() }, (_, index) => ({ chave: `vazio-${index}`, data: '', numero: '' }));
  const dias = Array.from({ length: totalDias }, (_, index) => {
    const numero = index + 1;
    return { chave: `${mesIso}-${numero}`, data: `${mesIso}-${String(numero).padStart(2, '0')}`, numero: String(numero) };
  });
  return [...vazios, ...dias];
}

function classeDia(sessao?: SessaoTrabalho) {
  if (!sessao) return 'border-violet-100 bg-white hover:border-violet-300 hover:bg-violet-50 dark:border-violet-950 dark:bg-[#17102A] dark:hover:bg-violet-950';
  if (sessao.tipo === 'falta') return 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40';
  if (sessao.tipo === 'extra') return 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40';
  return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40';
}

function rotuloTipo(tipo?: TipoSessaoTrabalho) {
  if (tipo === 'falta') return 'Falta';
  if (tipo === 'extra') return 'Extra';
  return 'Trabalhei';
}

function garantirCategoriaRendaVariavel(estado: AppState) {
  const existente = estado.categorias.find((item) => item.tipo === 'receita' && item.nome.toLowerCase() === 'renda variavel');
  return existente ?? { id: uid('cat'), nome: 'Renda variavel', tipo: 'receita' as const, cor: '#7C3AED' };
}
