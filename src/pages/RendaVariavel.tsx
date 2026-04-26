import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MinusCircle,
  Settings,
  TrendingDown,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  AppState,
  ConfiguracaoRendaVariavel,
  Pagamento,
  SessaoTrabalho,
  TipoPagamento,
  TipoSessaoTrabalho,
} from '../types/financeiro';
import { MetricCard } from '../components/MetricCard';
import { Section } from '../components/Section';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';
import { uid } from '../utils/calculos';

type Props = {
  estado: AppState;
  setEstado: Dispatch<SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
};

type RegistroDia = {
  data: string;
  trabalhou: boolean;
  tipo: TipoSessaoTrabalho;
  horasNormais: number;
  horasExtras: number;
  valorHora: number;
  descontosExtras: number;
};

type ResumoProducao = {
  bruto: number;
  descontos: number;
  liquido: number;
  horasNormais: number;
  horasExtras: number;
  faltas: number;
  diasTrabalhados: number;
};

const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export function RendaVariavel({ estado, setEstado, avisar }: Props) {
  const [mes, setMes] = useState(mesAtualISO());
  const [registro, setRegistro] = useState<RegistroDia | null>(null);
  const [configAberta, setConfigAberta] = useState(false);
  const config = estado.configuracaoRendaVariavel;

  const sessoesMes = useMemo(
    () => estado.sessoesTrabalho.filter((item) => item.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data)),
    [estado.sessoesTrabalho, mes],
  );
  const mapaSessoes = useMemo(() => new Map(sessoesMes.map((sessao) => [sessao.data, sessao])), [sessoesMes]);
  const diasCalendario = useMemo(() => montarCalendario(mes), [mes]);
  const pagamentosMes = useMemo(
    () => estado.pagamentos.filter((item) => item.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data)),
    [estado.pagamentos, mes],
  );

  const resumoMes = useMemo(() => resumirSessoes(sessoesMes), [sessoesMes]);
  const resumoTotal = useMemo(() => resumirSessoes(estado.sessoesTrabalho), [estado.sessoesTrabalho]);
  const totalPagoMes = pagamentosMes.reduce((soma, item) => soma + valorPagamento(item), 0);
  const totalPagoGeral = estado.pagamentos.reduce((soma, item) => soma + valorPagamento(item), 0);
  const saldoAcumulado = Math.max(resumoTotal.liquido - totalPagoGeral, 0);

  const intervaloVale = obterIntervaloVale(mes);
  const intervaloSalario = obterIntervaloSalario(mes);
  const resumoVale = resumirSessoesNoIntervalo(estado.sessoesTrabalho, intervaloVale.inicio, intervaloVale.fim);
  const resumoSalario = resumirSessoesNoIntervalo(estado.sessoesTrabalho, intervaloSalario.inicio, intervaloSalario.fim);
  const dataVale = `${mes}-20`;
  const dataSalario = `${mes}-05`;
  const valeJaGerado = estado.pagamentos.some((item) => item.tipo === 'vale' && item.data === dataVale);
  const salarioJaGerado = estado.pagamentos.some((item) => item.tipo === 'salario' && item.data === dataSalario);

  function abrirRegistro(data: string) {
    const sessao = mapaSessoes.get(data);
    if (!sessao) {
      setRegistro(criarRegistroPadrao(data, config));
      return;
    }
    const bruto = valorBrutoSessao(sessao);
    const descontoAutomatico = bruto > 0
      ? (bruto * ((config.descontoInss + config.descontoFgts) / 100)) + config.outrosDescontos
      : 0;
    const horasExtras = horasExtrasSessao(sessao);
    setRegistro({
      data,
      trabalhou: sessao.trabalhou ?? (sessao.tipo !== 'falta' && sessao.tipo !== 'folga'),
      tipo: sessao.tipo ?? 'normal',
      horasNormais: horasNormaisSessao(sessao),
      horasExtras,
      valorHora: sessao.valorHora,
      descontosExtras: Math.max((sessao.descontos ?? 0) - descontoAutomatico, 0),
    });
  }

  function atualizarRegistro(campo: keyof RegistroDia, valor: string | number | boolean) {
    setRegistro((atual) => {
      if (!atual) return atual;
      const proximo = { ...atual, [campo]: valor };
      if (campo === 'trabalhou' && valor === false) return { ...proximo, tipo: 'falta', horasNormais: 0, horasExtras: 0 };
      if (campo === 'tipo' && (valor === 'falta' || valor === 'folga')) return { ...proximo, trabalhou: false, horasNormais: 0, horasExtras: 0 };
      if (campo === 'tipo' && (valor === 'normal' || valor === 'extra')) return { ...proximo, trabalhou: true };
      return proximo;
    });
  }

  function aplicarAtalho(tipo: TipoSessaoTrabalho) {
    if (!registro) return;
    if (tipo === 'normal') {
      salvarRegistro({ ...registro, tipo: 'normal', trabalhou: true, horasNormais: config.horasPadraoDia, horasExtras: 0, descontosExtras: 0 });
      return;
    }
    if (tipo === 'falta' || tipo === 'folga') {
      salvarRegistro({ ...registro, tipo, trabalhou: false, horasNormais: 0, horasExtras: 0, descontosExtras: 0 });
      return;
    }
    setRegistro({ ...registro, tipo: 'extra', trabalhou: true, horasNormais: config.horasPadraoDia, horasExtras: Math.max(registro.horasExtras || 2, 0) });
  }

  function salvarRegistro(registroParaSalvar = registro) {
    if (!registroParaSalvar) return;
    if (registroParaSalvar.valorHora < 0) return avisar('Informe um valor por hora valido.', 'erro');
    if (registroParaSalvar.horasNormais < 0 || registroParaSalvar.horasExtras < 0) return avisar('Horas nao podem ser negativas.', 'erro');
    if (registroParaSalvar.trabalhou && registroParaSalvar.horasNormais + registroParaSalvar.horasExtras <= 0) {
      return avisar('Informe horas normais ou extras para salvar o dia.', 'erro');
    }

    const calculo = calcularFolhaDia(registroParaSalvar, config);
    const existente = mapaSessoes.get(registroParaSalvar.data);
    const sessao: SessaoTrabalho = {
      id: existente?.id ?? uid('work'),
      data: registroParaSalvar.data,
      tipo: registroParaSalvar.tipo,
      horasTrabalhadas: calculo.horasNormais,
      horasExtras: calculo.horasExtras,
      valorHora: registroParaSalvar.valorHora,
      totalGanho: calculo.liquido,
      trabalhou: calculo.trabalhou,
      falta: calculo.tipo === 'falta',
      descontos: calculo.descontos,
      valorBruto: calculo.bruto,
      valorLiquido: calculo.liquido,
    };

    setEstado((atual) => {
      if (!atual) return atual;
      const transacoesSemAntiga = existente?.transacaoId ? atual.transacoes.filter((item) => item.id !== existente.transacaoId) : atual.transacoes;
      return {
        ...atual,
        sessoesTrabalho: [
          sessao,
          ...atual.sessoesTrabalho.filter((item) => item.data !== registroParaSalvar.data),
        ].sort((a, b) => b.data.localeCompare(a.data)),
        transacoes: transacoesSemAntiga,
      };
    });
    setRegistro(null);
    avisar(calculo.trabalhou ? 'Dia registrado no saldo acumulado.' : `${rotuloTipo(calculo.tipo)} registrada.`);
  }

  function removerDia(sessao: SessaoTrabalho) {
    setEstado((atual) => atual && ({
      ...atual,
      sessoesTrabalho: atual.sessoesTrabalho.filter((item) => item.id !== sessao.id),
      transacoes: sessao.transacaoId ? atual.transacoes.filter((item) => item.id !== sessao.transacaoId) : atual.transacoes,
    }));
    setRegistro(null);
    avisar('Registro removido.');
  }

  function atualizarConfig(campo: keyof ConfiguracaoRendaVariavel, valor: number) {
    setEstado((atual) => atual && ({
      ...atual,
      configuracaoRendaVariavel: {
        ...atual.configuracaoRendaVariavel,
        [campo]: Math.max(Number.isFinite(valor) ? valor : 0, 0),
      },
    }));
  }

  function gerarPagamento(tipo: TipoPagamento, resumo: ResumoProducao, dataPagamento: string) {
    if (resumo.liquido <= 0) return avisar('Nao ha producao liquida para este pagamento.', 'info');
    const jaExiste = estado.pagamentos.some((item) => item.tipo === tipo && item.data === dataPagamento);
    if (jaExiste) return avisar('Este pagamento ja foi gerado.', 'info');

    const transacaoId = uid('pay-income');
    const pagamento: Pagamento = {
      id: uid('pay'),
      tipo,
      valor: resumo.liquido,
      valorBruto: resumo.bruto,
      descontos: resumo.descontos,
      valorLiquido: resumo.liquido,
      data: dataPagamento,
      transacaoId,
    };

    setEstado((atual) => {
      if (!atual) return atual;
      const categoria = garantirCategoriaRendaVariavel(atual);
      return {
        ...atual,
        categorias: atual.categorias.some((item) => item.id === categoria.id) ? atual.categorias : [...atual.categorias, categoria],
        pagamentos: [pagamento, ...atual.pagamentos].sort((a, b) => b.data.localeCompare(a.data)),
        transacoes: [{
          id: transacaoId,
          tipo: 'receita',
          categoriaId: categoria.id,
          descricao: tipo === 'vale' ? 'Vale renda variavel' : 'Salario renda variavel',
          valor: resumo.liquido,
          data: dataPagamento,
          status: 'realizado',
        }, ...atual.transacoes],
      };
    });
    avisar(tipo === 'vale' ? 'Vale registrado como receita real.' : 'Salario registrado como receita real.');
  }

  const sessaoSelecionada = registro ? mapaSessoes.get(registro.data) : undefined;
  const previaRegistro = registro ? calcularFolhaDia(registro, config) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard titulo="Produzido bruto" valor={formatarMoeda(resumoMes.bruto)} variacao="Antes dos descontos" icon={CircleDollarSign} tom="roxo" />
        <MetricCard titulo="Descontos totais" valor={formatarMoeda(resumoMes.descontos)} variacao={`${config.descontoInss + config.descontoFgts}% + fixos`} icon={TrendingDown} tom="vermelho" />
        <MetricCard titulo="Liquido do mes" valor={formatarMoeda(resumoMes.liquido)} variacao="Valor acumulado para receber" icon={Wallet} tom="verde" />
        <MetricCard titulo="Horas trabalhadas" valor={`${formatarNumero(resumoMes.horasNormais + resumoMes.horasExtras)}h`} variacao={`${formatarNumero(resumoMes.horasNormais)}h normais`} icon={Clock3} />
        <MetricCard titulo="Horas extras" valor={`${formatarNumero(resumoMes.horasExtras)}h`} variacao={`${config.multiplicadorHoraExtra}x multiplicador`} icon={Zap} tom="ambar" />
        <MetricCard titulo="Faltas" valor={String(resumoMes.faltas)} variacao="Dias sem producao" icon={CalendarDays} tom="vermelho" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-500">1. Producao</p>
          <strong className="mt-2 block text-2xl text-violet-950 dark:text-white">{formatarMoeda(resumoMes.bruto)}</strong>
          <p className="mt-1 text-sm text-slate-500">Dias trabalhados, extras, faltas e folgas ficam aqui.</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-500">2. Saldo acumulado</p>
          <strong className="mt-2 block text-2xl text-amber-600">{formatarMoeda(saldoAcumulado)}</strong>
          <p className="mt-1 text-sm text-slate-500">Liquido produzido que ainda nao virou pagamento.</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-500">3. Pagamentos</p>
          <strong className="mt-2 block text-2xl text-emerald-600">{formatarMoeda(totalPagoMes)}</strong>
          <p className="mt-1 text-sm text-slate-500">Vale e salario entram como receita real.</p>
        </div>
      </div>

      <Section titulo="Pagamentos previstos">
        <div className="grid gap-4 lg:grid-cols-2">
          <CartaoPagamento
            titulo="Vale - dia 20"
            periodo={`${formatarData(intervaloVale.inicio)} a ${formatarData(intervaloVale.fim)}`}
            dataPagamento={dataVale}
            resumo={resumoVale}
            jaGerado={valeJaGerado}
            onGerar={() => gerarPagamento('vale', resumoVale, dataVale)}
          />
          <CartaoPagamento
            titulo="Salario - dia 5"
            periodo={`${formatarData(intervaloSalario.inicio)} a ${formatarData(intervaloSalario.fim)}`}
            dataPagamento={dataSalario}
            resumo={resumoSalario}
            jaGerado={salarioJaGerado}
            onGerar={() => gerarPagamento('salario', resumoSalario, dataSalario)}
          />
        </div>
      </Section>

      <Section
        titulo="Calendario de trabalho"
        acao={(
          <div className="flex flex-wrap gap-2">
            <input className="input w-40" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            <button className="btn-secondary" onClick={() => setConfigAberta(true)}>
              <Settings size={18} />
              Configuracoes de trabalho
            </button>
          </div>
        )}
      >
        <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100">
          Clique em um dia para registrar trabalho, falta, folga ou hora extra. O dinheiro fica em saldo acumulado ate virar vale ou salario.
        </div>
        <div className="grid grid-cols-7 gap-2">
          {nomesDias.map((dia) => <div key={dia} className="py-2 text-center text-xs font-bold uppercase text-slate-500">{dia}</div>)}
          {diasCalendario.map((dia) => {
            const sessao = dia.data ? mapaSessoes.get(dia.data) : undefined;
            return (
              <button
                key={dia.chave}
                disabled={!dia.data}
                onClick={() => dia.data && abrirRegistro(dia.data)}
                title={tooltipSessao(sessao)}
                className={`min-h-24 rounded-lg border p-2 text-left transition sm:min-h-28 ${!dia.data ? 'border-transparent' : classeDia(sessao)}`}
              >
                {dia.data && (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-black text-slate-950 dark:text-white">{dia.numero}</span>
                      {sessao && <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-[#17102A] dark:text-violet-200">{rotuloTipo(sessao.tipo)}</span>}
                    </div>
                    <p className="mt-4 text-xs text-slate-500">{sessao ? `${formatarNumero(horasNormaisSessao(sessao) + horasExtrasSessao(sessao))}h` : 'Sem registro'}</p>
                    <strong className={sessao?.tipo === 'falta' ? 'text-rose-600' : 'text-emerald-600'}>
                      {sessao ? formatarMoeda(valorLiquidoSessao(sessao)) : ''}
                    </strong>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section titulo="Historico do mes">
        {sessoesMes.length === 0 ? <EmptyState icon={BriefcaseBusiness} titulo="Nenhum dia registrado" texto="Use o calendario para controlar trabalho normal, hora extra, falta e folga." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sessoesMes.map((sessao) => (
              <div key={sessao.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">{formatarData(sessao.data)} - {rotuloTipo(sessao.tipo)}</p>
                  <p className="text-sm text-slate-500">
                    {formatarNumero(horasNormaisSessao(sessao))}h normais
                    {horasExtrasSessao(sessao) > 0 ? ` + ${formatarNumero(horasExtrasSessao(sessao))}h extras` : ''}
                    {' '}x {formatarMoeda(sessao.valorHora)}/h
                  </p>
                </div>
                <div className="grid gap-1 text-left sm:text-right">
                  <span className="text-xs font-semibold text-slate-500">Bruto {formatarMoeda(valorBrutoSessao(sessao))}</span>
                  <span className="text-xs font-semibold text-rose-500">Descontos {formatarMoeda(sessao.descontos ?? 0)}</span>
                  <strong className={sessao.tipo === 'falta' ? 'text-rose-600' : 'text-emerald-600'}>{formatarMoeda(valorLiquidoSessao(sessao))}</strong>
                </div>
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
                <div className="grid gap-1 text-left sm:text-right">
                  <span className="text-xs font-semibold text-slate-500">Bruto {formatarMoeda(pagamento.valorBruto ?? pagamento.valor)}</span>
                  <span className="text-xs font-semibold text-rose-500">Descontos {formatarMoeda(pagamento.descontos ?? 0)}</span>
                  <strong className="text-emerald-600">{formatarMoeda(valorPagamento(pagamento))}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Modal aberto={!!registro} titulo={registro ? `Registro de ${formatarData(registro.data)}` : 'Registro do dia'} onFechar={() => setRegistro(null)}>
        {registro && (
          <div className="space-y-5">
            {sessaoSelecionada && (
              <div className="rounded-lg bg-violet-50 p-3 text-sm font-bold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                Atual: {rotuloTipo(sessaoSelecionada.tipo)} - liquido {formatarMoeda(valorLiquidoSessao(sessaoSelecionada))}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-4">
              <button className="btn-secondary" onClick={() => aplicarAtalho('normal')}><CheckCircle2 size={17} /> Trabalhei</button>
              <button className="btn-secondary" onClick={() => aplicarAtalho('falta')}><MinusCircle size={17} /> Faltei</button>
              <button className="btn-secondary" onClick={() => aplicarAtalho('extra')}><Zap size={17} /> Hora extra</button>
              <button className="btn-secondary" onClick={() => aplicarAtalho('folga')}><CalendarDays size={17} /> Folga</button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Data
                <input className="input mt-1" type="date" value={registro.data} onChange={(e) => atualizarRegistro('data', e.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Tipo
                <select className="input mt-1" value={registro.tipo} onChange={(e) => atualizarRegistro('tipo', e.target.value as TipoSessaoTrabalho)}>
                  <option value="normal">Normal</option>
                  <option value="extra">Hora extra</option>
                  <option value="falta">Falta</option>
                  <option value="folga">Folga</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-violet-100 p-3 text-sm font-semibold dark:border-violet-900">
                <input
                  type="checkbox"
                  checked={registro.trabalhou}
                  onChange={(e) => atualizarRegistro('trabalhou', e.target.checked)}
                  className="h-4 w-4 accent-violet-600"
                />
                Trabalhou neste dia
              </label>
              <label className="block text-sm font-semibold">
                Valor por hora
                <input className="input mt-1" type="number" min="0" step="0.01" value={registro.valorHora} onChange={(e) => atualizarRegistro('valorHora', Number(e.target.value))} />
              </label>
              <label className="block text-sm font-semibold">
                Horas normais
                <input className="input mt-1" type="number" min="0" step="0.25" value={registro.horasNormais} disabled={!registro.trabalhou} onChange={(e) => atualizarRegistro('horasNormais', Number(e.target.value))} />
              </label>
              <label className="block text-sm font-semibold">
                Horas extras
                <input className="input mt-1" type="number" min="0" step="0.25" value={registro.horasExtras} disabled={!registro.trabalhou} onChange={(e) => atualizarRegistro('horasExtras', Number(e.target.value))} />
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Descontos extras do dia
                <input className="input mt-1" type="number" min="0" step="0.01" value={registro.descontosExtras} disabled={!registro.trabalhou} onChange={(e) => atualizarRegistro('descontosExtras', Number(e.target.value))} />
              </label>
            </div>

            {previaRegistro && (
              <div className="grid gap-3 rounded-lg border border-violet-100 bg-violet-50 p-4 text-sm dark:border-violet-900 dark:bg-violet-950 sm:grid-cols-3">
                <div>
                  <p className="font-semibold text-violet-800 dark:text-violet-100">Bruto</p>
                  <strong className="text-lg text-violet-950 dark:text-white">{formatarMoeda(previaRegistro.bruto)}</strong>
                </div>
                <div>
                  <p className="font-semibold text-rose-600">Descontos</p>
                  <strong className="text-lg text-rose-600">{formatarMoeda(previaRegistro.descontos)}</strong>
                </div>
                <div>
                  <p className="font-semibold text-emerald-600">Liquido</p>
                  <strong className="text-lg text-emerald-600">{formatarMoeda(previaRegistro.liquido)}</strong>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {sessaoSelecionada && <button className="btn-secondary" onClick={() => removerDia(sessaoSelecionada)}>Remover</button>}
              <button className="btn-secondary" onClick={() => setRegistro(null)}>Cancelar</button>
              <button className="btn-primary" onClick={() => salvarRegistro()}>Salvar dia</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal aberto={configAberta} titulo="Configuracoes de trabalho" onFechar={() => setConfigAberta(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Valor por hora padrao
            <input className="input mt-1" type="number" min="0" step="0.01" value={config.valorHoraPadrao} onChange={(e) => atualizarConfig('valorHoraPadrao', Number(e.target.value))} />
          </label>
          <label className="block text-sm font-semibold">
            Horas padrao por dia
            <input className="input mt-1" type="number" min="0" step="0.25" value={config.horasPadraoDia} onChange={(e) => atualizarConfig('horasPadraoDia', Number(e.target.value))} />
          </label>
          <label className="block text-sm font-semibold">
            Multiplicador de hora extra
            <input className="input mt-1" type="number" min="1" step="0.1" value={config.multiplicadorHoraExtra} onChange={(e) => atualizarConfig('multiplicadorHoraExtra', Number(e.target.value))} />
          </label>
          <label className="block text-sm font-semibold">
            Desconto INSS (%)
            <input className="input mt-1" type="number" min="0" step="0.1" value={config.descontoInss} onChange={(e) => atualizarConfig('descontoInss', Number(e.target.value))} />
          </label>
          <label className="block text-sm font-semibold">
            Desconto FGTS (%)
            <input className="input mt-1" type="number" min="0" step="0.1" value={config.descontoFgts} onChange={(e) => atualizarConfig('descontoFgts', Number(e.target.value))} />
          </label>
          <label className="block text-sm font-semibold">
            Outros descontos padrao por dia
            <input className="input mt-1" type="number" min="0" step="0.01" value={config.outrosDescontos} onChange={(e) => atualizarConfig('outrosDescontos', Number(e.target.value))} />
          </label>
          <button className="btn-primary sm:col-span-2" onClick={() => { setConfigAberta(false); avisar('Configuracoes salvas.'); }}>Salvar configuracoes</button>
        </div>
      </Modal>
    </div>
  );
}

function CartaoPagamento({
  titulo,
  periodo,
  dataPagamento,
  resumo,
  jaGerado,
  onGerar,
}: {
  titulo: string;
  periodo: string;
  dataPagamento: string;
  resumo: ResumoProducao;
  jaGerado: boolean;
  onGerar: () => void;
}) {
  return (
    <div className="rounded-lg border border-violet-100 p-4 dark:border-violet-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950 dark:text-white">{titulo}</p>
          <p className="text-sm text-slate-500">Periodo: {periodo}</p>
          <p className="text-sm text-slate-500">Pagamento: {formatarData(dataPagamento)}</p>
        </div>
        {jaGerado && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Gerado</span>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950">
          <p className="text-slate-500">Bruto</p>
          <strong className="text-violet-950 dark:text-white">{formatarMoeda(resumo.bruto)}</strong>
        </div>
        <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-500/10">
          <p className="text-slate-500">Desc.</p>
          <strong className="text-rose-600">{formatarMoeda(resumo.descontos)}</strong>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
          <p className="text-slate-500">Liquido</p>
          <strong className="text-emerald-600">{formatarMoeda(resumo.liquido)}</strong>
        </div>
      </div>
      <button className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={jaGerado || resumo.liquido <= 0} onClick={onGerar}>
        <Banknote size={18} />
        {jaGerado ? 'Pagamento ja gerado' : 'Gerar pagamento'}
      </button>
    </div>
  );
}

function criarRegistroPadrao(data: string, config: ConfiguracaoRendaVariavel): RegistroDia {
  return {
    data,
    trabalhou: true,
    tipo: 'normal',
    horasNormais: config.horasPadraoDia,
    horasExtras: 0,
    valorHora: config.valorHoraPadrao,
    descontosExtras: 0,
  };
}

function calcularFolhaDia(registro: RegistroDia, config: ConfiguracaoRendaVariavel) {
  const tipo = registro.trabalhou ? registro.tipo : (registro.tipo === 'folga' ? 'folga' : 'falta');
  const trabalhou = tipo !== 'falta' && tipo !== 'folga';
  const horasNormais = trabalhou ? Math.max(registro.horasNormais, 0) : 0;
  const horasExtras = trabalhou ? Math.max(registro.horasExtras, 0) : 0;
  const bruto = trabalhou
    ? (horasNormais * registro.valorHora) + (horasExtras * registro.valorHora * config.multiplicadorHoraExtra)
    : 0;
  const descontos = bruto > 0
    ? Math.min(
      bruto,
      (bruto * ((config.descontoInss + config.descontoFgts) / 100)) + config.outrosDescontos + Math.max(registro.descontosExtras, 0),
    )
    : 0;
  return {
    tipo,
    trabalhou,
    horasNormais,
    horasExtras,
    bruto,
    descontos,
    liquido: Math.max(bruto - descontos, 0),
  };
}

function resumirSessoes(sessoes: SessaoTrabalho[]): ResumoProducao {
  return sessoes.reduce<ResumoProducao>((resumo, sessao) => {
    resumo.bruto += valorBrutoSessao(sessao);
    resumo.descontos += sessao.descontos ?? 0;
    resumo.liquido += valorLiquidoSessao(sessao);
    resumo.horasNormais += horasNormaisSessao(sessao);
    resumo.horasExtras += horasExtrasSessao(sessao);
    resumo.faltas += sessao.tipo === 'falta' ? 1 : 0;
    resumo.diasTrabalhados += sessao.tipo !== 'falta' && sessao.tipo !== 'folga' ? 1 : 0;
    return resumo;
  }, { bruto: 0, descontos: 0, liquido: 0, horasNormais: 0, horasExtras: 0, faltas: 0, diasTrabalhados: 0 });
}

function resumirSessoesNoIntervalo(sessoes: SessaoTrabalho[], inicio: string, fim: string) {
  return resumirSessoes(sessoes.filter((item) => item.data >= inicio && item.data <= fim));
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
  if (sessao.tipo === 'folga') return 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50';
  if (sessao.tipo === 'extra') return 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40';
  return 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40';
}

function rotuloTipo(tipo?: TipoSessaoTrabalho) {
  if (tipo === 'falta') return 'Falta';
  if (tipo === 'extra') return 'Hora extra';
  if (tipo === 'folga') return 'Folga';
  return 'Normal';
}

function tooltipSessao(sessao?: SessaoTrabalho) {
  if (!sessao) return 'Sem registro';
  return `${rotuloTipo(sessao.tipo)} | ${formatarNumero(horasNormaisSessao(sessao))}h normais + ${formatarNumero(horasExtrasSessao(sessao))}h extras | Bruto ${formatarMoeda(valorBrutoSessao(sessao))} | Liquido ${formatarMoeda(valorLiquidoSessao(sessao))}`;
}

function horasExtrasSessao(sessao: SessaoTrabalho) {
  if ((sessao.horasExtras ?? 0) > 0) return sessao.horasExtras ?? 0;
  if (sessao.tipo === 'extra') return sessao.horasTrabalhadas;
  return 0;
}

function horasNormaisSessao(sessao: SessaoTrabalho) {
  if (sessao.tipo === 'falta' || sessao.tipo === 'folga') return 0;
  if (sessao.tipo === 'extra' && (sessao.horasExtras ?? 0) === 0) return 0;
  return sessao.horasTrabalhadas;
}

function valorBrutoSessao(sessao: SessaoTrabalho) {
  return sessao.valorBruto ?? sessao.totalGanho;
}

function valorLiquidoSessao(sessao: SessaoTrabalho) {
  return sessao.valorLiquido ?? sessao.totalGanho;
}

function valorPagamento(pagamento: Pagamento) {
  return pagamento.valorLiquido ?? pagamento.valor;
}

function obterIntervaloVale(mesIso: string) {
  return { inicio: `${mesIso}-01`, fim: `${mesIso}-15` };
}

function obterIntervaloSalario(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const inicio = new Date(ano, mes - 2, 16);
  const fim = new Date(ano, mes - 1, 0);
  return { inicio: dataISO(inicio), fim: dataISO(fim) };
}

function dataISO(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

function formatarNumero(valor: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor);
}

function garantirCategoriaRendaVariavel(estado: AppState) {
  const existente = estado.categorias.find((item) => item.tipo === 'receita' && normalizarTexto(item.nome) === 'renda variavel');
  return existente ?? { id: uid('cat'), nome: 'Renda variavel', tipo: 'receita' as const, cor: '#7C3AED' };
}

function normalizarTexto(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
