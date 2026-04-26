import { useMemo, useState } from 'react';
import { Banknote, BriefcaseBusiness, CalendarDays, CircleDollarSign, Clock3, Settings, Wallet, Zap } from 'lucide-react';
import { AppState, Pagamento, SessaoTrabalho, TipoPagamento, TipoSessaoTrabalho } from '../types/financeiro';
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
  const pagamentosMes = useMemo(() => estado.pagamentos.filter((item) => item.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data)), [estado.pagamentos, mes]);
  const totalPagoMes = pagamentosMes.reduce((soma, item) => soma + item.valor, 0);
  const saldoAcumulado = Math.max(estado.sessoesTrabalho.reduce((soma, item) => soma + item.totalGanho, 0) - estado.pagamentos.reduce((soma, item) => soma + item.valor, 0), 0);
  const sugestaoVale = Math.max(producaoNoIntervalo(estado.sessoesTrabalho, `${mes}-01`, `${mes}-15`) - pagamentosMes.filter((item) => item.tipo === 'vale').reduce((soma, item) => soma + item.valor, 0), 0);
  const sugestaoSalario = Math.max(producaoAte(estado.sessoesTrabalho, ultimoDiaMesAnterior(mes)) - pagamentosAte(estado.pagamentos, `${mes}-05`), 0);
  const proximoVale = `${mes}-20`;
  const proximoSalario = `${mes}-05`;

  function registrarDia(data: string, tipo: TipoSessaoTrabalho, horasCustom?: number) {
    const horas = tipo === 'falta' ? 0 : tipo === 'extra' ? Math.max(horasCustom ?? horasExtra, 0) : config.horasPadraoDia;
    if (tipo !== 'falta' && horas <= 0) return avisar('Informe uma quantidade de horas valida.', 'erro');
    const valor = calcularGanho(horas, tipo, config.valorHoraPadrao, config.multiplicadorHoraExtra);
    const existente = mapaSessoes.get(data);
    const transacaoExistenteId = existente?.transacaoId;
    const sessao: SessaoTrabalho = {
      id: existente?.id ?? uid('work'),
      data,
      tipo,
      horasTrabalhadas: horas,
      valorHora: config.valorHoraPadrao,
      totalGanho: valor,
    };

    setEstado((atual) => {
      if (!atual) return atual;
      const semSessao = atual.sessoesTrabalho.filter((item) => item.id !== sessao.id);
      const transacoesSemAntiga = transacaoExistenteId ? atual.transacoes.filter((item) => item.id !== transacaoExistenteId) : atual.transacoes;
      return {
        ...atual,
        sessoesTrabalho: [sessao, ...semSessao].sort((a, b) => b.data.localeCompare(a.data)),
        transacoes: transacoesSemAntiga,
      };
    });
    setDiaSelecionado(null);
    avisar(tipo === 'falta' ? 'Falta registrada.' : 'Producao registrada no saldo acumulado.');
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

  function gerarPagamento(tipo: TipoPagamento, valorSugerido: number, dataPagamento: string) {
    if (valorSugerido <= 0) return avisar('Nao ha saldo elegivel para este pagamento.', 'info');
    const jaExiste = estado.pagamentos.some((item) => item.tipo === tipo && item.data === dataPagamento);
    if (jaExiste) return avisar('Este pagamento ja foi gerado.', 'info');
    const transacaoId = uid('pay-income');
    const pagamento: Pagamento = { id: uid('pay'), tipo, valor: valorSugerido, data: dataPagamento, transacaoId };
    setEstado((atual) => {
      if (!atual) return atual;
      const categoria = garantirCategoriaRendaVariavel(atual);
      return {
        ...atual,
        categorias: atual.categorias.some((item) => item.id === categoria.id) ? atual.categorias : [...atual.categorias, categoria],
        pagamentos: [pagamento, ...atual.pagamentos].sort((a, b) => b.data.localeCompare(a.data)),
        transacoes: [{
          id: transacaoId,
          tipo: 'receita' as const,
          categoriaId: categoria.id,
          descricao: tipo === 'vale' ? 'Vale renda variavel' : 'Salario renda variavel',
          valor: valorSugerido,
          data: dataPagamento,
          status: 'realizado' as const,
        }, ...atual.transacoes],
      };
    });
    avisar(tipo === 'vale' ? 'Vale registrado como receita.' : 'Salario registrado como receita.');
  }

  const sessaoSelecionada = diaSelecionado ? mapaSessoes.get(diaSelecionado) : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard titulo="Produzido no mes" valor={formatarMoeda(totalMes)} variacao="Trabalho realizado, ainda nao necessariamente recebido" icon={CircleDollarSign} tom="verde" />
        <MetricCard titulo="Saldo acumulado" valor={formatarMoeda(saldoAcumulado)} variacao="Produzido menos pagamentos recebidos" icon={Wallet} tom="ambar" />
        <MetricCard titulo="Recebido no mes" valor={formatarMoeda(totalPagoMes)} variacao="Vale + salario registrados" icon={Banknote} tom="azul" />
        <MetricCard titulo="Horas trabalhadas" valor={`${totalHoras.toFixed(1)}h`} variacao={`${config.horasPadraoDia}h por dia normal`} icon={Clock3} />
        <MetricCard titulo="Faltas" valor={String(faltas)} variacao="Dias sem ganho" icon={CalendarDays} tom="vermelho" />
        <MetricCard titulo="Horas extras" valor={`${horasExtras.toFixed(1)}h`} variacao={`${config.multiplicadorHoraExtra}x multiplicador`} icon={Zap} tom="ambar" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-500">1. Producao</p>
          <strong className="mt-2 block text-2xl text-violet-950 dark:text-white">{formatarMoeda(totalMes)}</strong>
          <p className="mt-1 text-sm text-slate-500">Dias trabalhados, faltas e extras entram aqui.</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-500">2. Saldo acumulado</p>
          <strong className="mt-2 block text-2xl text-amber-600">{formatarMoeda(saldoAcumulado)}</strong>
          <p className="mt-1 text-sm text-slate-500">Valor produzido que ainda nao virou dinheiro recebido.</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-500">3. Pagamentos</p>
          <strong className="mt-2 block text-2xl text-emerald-600">{formatarMoeda(totalPagoMes)}</strong>
          <p className="mt-1 text-sm text-slate-500">Ao gerar vale/salario, entra como receita real.</p>
        </div>
      </div>

      <Section titulo="Pagamentos automaticos">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-violet-100 p-4 dark:border-violet-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-950 dark:text-white">Vale - dia 20</p>
                <p className="text-sm text-slate-500">Sugestao: producao de 1 a 15 do mes.</p>
              </div>
              <strong className="text-emerald-600">{formatarMoeda(sugestaoVale)}</strong>
            </div>
            <button className="btn-primary mt-4 w-full" onClick={() => gerarPagamento('vale', sugestaoVale, proximoVale)}>Gerar vale em {formatarData(proximoVale)}</button>
          </div>
          <div className="rounded-lg border border-violet-100 p-4 dark:border-violet-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-950 dark:text-white">Salario - dia 5</p>
                <p className="text-sm text-slate-500">Sugestao: saldo acumulado ate o fim do mes anterior.</p>
              </div>
              <strong className="text-emerald-600">{formatarMoeda(sugestaoSalario)}</strong>
            </div>
            <button className="btn-primary mt-4 w-full" onClick={() => gerarPagamento('salario', sugestaoSalario, proximoSalario)}>Gerar salario em {formatarData(proximoSalario)}</button>
          </div>
        </div>
      </Section>

      <Section titulo="Calendario de trabalho" acao={<div className="flex gap-2"><input className="input w-40" type="month" value={mes} onChange={(e) => setMes(e.target.value)} /><button className="icon-btn" onClick={() => setConfigAberta(true)} aria-label="Configurar renda variavel"><Settings size={18} /></button></div>}>
        <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100">
          Clique em um dia e escolha: Trabalhei, Faltei ou Hora extra. O app calcula a producao e acumula o valor para o proximo pagamento.
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

      <Section titulo="Pagamentos recebidos">
        {pagamentosMes.length === 0 ? <EmptyState icon={Banknote} titulo="Nenhum pagamento no mes" texto="Gere o vale ou o salario para registrar dinheiro recebido." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pagamentosMes.map((pagamento) => (
              <div key={pagamento.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">{pagamento.tipo === 'vale' ? 'Vale' : 'Salario'} - {formatarData(pagamento.data)}</p>
                  <p className="text-sm text-slate-500">Registrado como receita real</p>
                </div>
                <strong className="text-emerald-600">{formatarMoeda(pagamento.valor)}</strong>
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

function producaoNoIntervalo(sessoes: SessaoTrabalho[], inicio: string, fim: string) {
  return sessoes
    .filter((item) => item.data >= inicio && item.data <= fim)
    .reduce((total, item) => total + item.totalGanho, 0);
}

function producaoAte(sessoes: SessaoTrabalho[], fim: string) {
  return sessoes
    .filter((item) => item.data <= fim)
    .reduce((total, item) => total + item.totalGanho, 0);
}

function pagamentosAte(pagamentos: Pagamento[], fim: string) {
  return pagamentos
    .filter((item) => item.data <= fim)
    .reduce((total, item) => total + item.valor, 0);
}

function ultimoDiaMesAnterior(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  return new Date(ano, mes - 1, 0).toISOString().slice(0, 10);
}

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

function garantirCategoriaRendaVariavel(estado: AppState) {
  const existente = estado.categorias.find((item) => item.tipo === 'receita' && item.nome.toLowerCase() === 'renda variavel');
  return existente ?? { id: uid('cat'), nome: 'Renda variavel', tipo: 'receita' as const, cor: '#7C3AED' };
}
