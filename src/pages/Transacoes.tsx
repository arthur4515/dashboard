import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { CalendarClock, Edit3, FileUp, Plus, Search, Trash2 } from 'lucide-react';
import { AppState, StatusRecorrencia, TipoTransacao, Transacao, TransacaoRecorrente } from '../types/financeiro';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';
import { uid } from '../utils/calculos';
import { detectarDuplicata, gerarRecorrenciasDoMes, ImportacaoCSV, importarCSV, previsaoRecorrente, proximaDataRecorrencia, recorrenciasFuturas, sugerirCategoria } from '../utils/automacoes';

type Props = {
  estado: AppState;
  setEstado: React.Dispatch<React.SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
};

export function Transacoes({ estado, setEstado, avisar }: Props) {
  const [modal, setModal] = useState(false);
  const [modalRecorrencia, setModalRecorrencia] = useState(false);
  const [modalImportacao, setModalImportacao] = useState(false);
  const [editando, setEditando] = useState<Transacao | null>(null);
  const [recorrenciaEditando, setRecorrenciaEditando] = useState<TransacaoRecorrente | null>(null);
  const [form, setForm] = useState<Omit<Transacao, 'id'>>(() => criarTransacaoVazia(estado, 'despesa'));
  const [recorrenteForm, setRecorrenteForm] = useState<Omit<TransacaoRecorrente, 'id'>>(() => criarRecorrenteVazio(estado));
  const [importados, setImportados] = useState<ImportacaoCSV[]>([]);
  const [tipo, setTipo] = useState<'todos' | TipoTransacao>('todos');
  const [categoria, setCategoria] = useState('todas');
  const [mes, setMes] = useState(mesAtualISO());
  const [busca, setBusca] = useState('');
  const futuras = recorrenciasFuturas(estado, 120);

  const categoriasDoTipo = estado.categorias.filter((item) => item.tipo === form.tipo);
  const categoriasRecorrencia = estado.categorias.filter((item) => item.tipo === recorrenteForm.tipo);
  const filtradas = useMemo(() => estado.transacoes.filter((item) => {
    const texto = item.descricao.toLowerCase().includes(busca.toLowerCase());
    return texto && (tipo === 'todos' || item.tipo === tipo) && (categoria === 'todas' || item.categoriaId === categoria) && item.data.startsWith(mes);
  }).sort((a, b) => b.data.localeCompare(a.data)), [estado.transacoes, tipo, categoria, mes, busca]);
  const futurasFiltradas = useMemo(() => futuras
    .filter((item) => !estado.transacoes.some((transacao) => transacao.recorrenciaId === item.recorrente.id && transacao.data === item.data))
    .filter((item) => item.recorrente.descricao.toLowerCase().includes(busca.toLowerCase()))
    .filter((item) => tipo === 'todos' || item.recorrente.tipo === tipo)
    .filter((item) => categoria === 'todas' || item.recorrente.categoriaId === categoria)
    .filter((item) => item.data.startsWith(mes))
    .sort((a, b) => b.data.localeCompare(a.data)), [futuras, estado.transacoes, busca, tipo, categoria, mes]);
  const transacoesPorMes = useMemo(() => agruparTransacoesPorMes(filtradas), [filtradas]);
  const futurasPorMes = useMemo(() => agruparFuturasPorMes(futurasFiltradas), [futurasFiltradas]);

  function abrirNova(tipoTransacao: TipoTransacao) {
    setEditando(null);
    setForm(criarTransacaoVazia(estado, tipoTransacao));
    setModal(true);
  }

  function atualizarDescricao(descricao: string) {
    const categoriaSugerida = sugerirCategoria(descricao, estado.categorias, form.tipo);
    setForm({ ...form, descricao, categoriaId: categoriaSugerida || form.categoriaId });
  }

  function abrirEdicao(transacao: Transacao) {
    setEditando(transacao);
    setForm({ tipo: transacao.tipo, categoriaId: transacao.categoriaId, descricao: transacao.descricao, valor: transacao.valor, data: transacao.data, recorrenciaId: transacao.recorrenciaId, importada: transacao.importada });
    setModal(true);
  }

  function salvar(event: FormEvent) {
    event.preventDefault();
    if (!form.descricao.trim() || form.valor <= 0 || !form.categoriaId) {
      avisar('Preencha descricao, categoria e valor corretamente.', 'erro');
      return;
    }
    if (!editando && detectarDuplicata(form, estado.transacoes)) {
      const confirmou = window.confirm('Possivel transacao duplicada encontrada. Deseja salvar mesmo assim?');
      if (!confirmou) return;
    }
    setEstado((atual) => atual && ({
      ...atual,
      transacoes: editando
        ? atual.transacoes.map((item) => item.id === editando.id ? { ...form, id: editando.id } : item)
        : [{ ...form, id: uid('t') }, ...atual.transacoes],
    }));
    avisar(editando ? 'Transacao atualizada.' : 'Transacao adicionada.');
    setModal(false);
  }

  function excluir(id: string) {
    setEstado((atual) => atual && ({ ...atual, transacoes: atual.transacoes.filter((item) => item.id !== id) }));
    avisar('Transacao excluida.');
  }

  function abrirRecorrencia(recorrencia?: TransacaoRecorrente) {
    const base = recorrencia ? {
      tipo: recorrencia.tipo,
      tipoRecorrencia: recorrencia.tipo,
      categoriaId: recorrencia.categoriaId,
      descricao: recorrencia.descricao,
      valor: recorrencia.valor,
      dataInicio: recorrencia.dataInicio,
      dataFinal: recorrencia.dataFinal,
      proximaData: recorrencia.proximaData,
      diaExecucao: recorrencia.diaExecucao,
      frequencia: recorrencia.frequencia,
      status: recorrencia.status ?? (recorrencia.ativa ? 'ativa' : 'pausada'),
      ativa: recorrencia.ativa,
    } : criarRecorrenteVazio(estado);
    setRecorrenciaEditando(recorrencia ?? null);
    setRecorrenteForm(base);
    setModalRecorrencia(true);
  }

  function salvarRecorrencia(event: FormEvent) {
    event.preventDefault();
    if (!recorrenteForm.valor || recorrenteForm.valor <= 0 || !recorrenteForm.categoriaId) {
      avisar('Preencha tipo, valor e categoria.', 'erro');
      return;
    }
    if (!recorrenteForm.diaExecucao || recorrenteForm.diaExecucao < 1 || recorrenteForm.diaExecucao > 31) {
      avisar('Informe um dia do mes entre 1 e 31.', 'erro');
      return;
    }
    const descricao = recorrenteForm.descricao.trim() || descricaoPadraoRecorrencia(recorrenteForm.tipo);
    const dados = { ...recorrenteForm, descricao, frequencia: 'mensal' as const, tipoRecorrencia: recorrenteForm.tipo, proximaData: proximaDataRecorrencia({ ...recorrenteForm, descricao, frequencia: 'mensal' } as TransacaoRecorrente), ativa: (recorrenteForm.status ?? 'ativa') === 'ativa' };
    setEstado((atual) => atual && ({
      ...atual,
      recorrentes: recorrenciaEditando
        ? atual.recorrentes.map((item) => item.id === recorrenciaEditando.id ? { ...dados, id: item.id } : item)
        : [...atual.recorrentes, { ...dados, id: uid('rec') }],
    }));
    avisar(recorrenciaEditando ? 'Recorrencia atualizada.' : 'Recorrencia criada.');
    setModalRecorrencia(false);
  }

  function excluirRecorrencia(id: string) {
    setEstado((atual) => atual && ({ ...atual, recorrentes: atual.recorrentes.filter((item) => item.id !== id) }));
    avisar('Recorrencia excluida.');
  }

  function alternarRecorrencia(recorrencia: TransacaoRecorrente) {
    const novoStatus: StatusRecorrencia = (recorrencia.status ?? (recorrencia.ativa ? 'ativa' : 'pausada')) === 'ativa' ? 'inativa' : 'ativa';
    setEstado((atual) => atual && ({ ...atual, recorrentes: atual.recorrentes.map((item) => item.id === recorrencia.id ? { ...item, status: novoStatus, ativa: novoStatus === 'ativa' } : item) }));
  }

  function gerarRecorrencias() {
    const novas = gerarRecorrenciasDoMes(estado, mes);
    if (novas.length === 0) return avisar('Nenhum lancamento novo para gerar.', 'info');
    setEstado((atual) => atual && ({ ...atual, transacoes: [...novas, ...atual.transacoes] }));
    avisar(`${novas.length} lancamento(s) recorrente(s) gerado(s).`);
  }

  function lerCSV(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const resultado = importarCSV(String(leitor.result ?? ''), estado);
      setImportados(resultado);
      setModalImportacao(true);
    };
    leitor.readAsText(arquivo);
    event.target.value = '';
  }

  function confirmarImportacao() {
    const selecionados = importados.filter((item) => !item.duplicada).map(({ idTemp: _idTemp, duplicada: _duplicada, ...item }) => ({ ...item, id: uid('csv') }));
    if (selecionados.length === 0) return avisar('Nao ha lancamentos novos para importar.', 'info');
    setEstado((atual) => atual && ({ ...atual, transacoes: [...selecionados, ...atual.transacoes] }));
    setModalImportacao(false);
    avisar(`${selecionados.length} lancamento(s) importado(s).`);
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_140px_170px_145px_auto_auto_auto_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input className="input pl-10" placeholder="Buscar por descricao" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as 'todos' | TipoTransacao)}><option value="todos">Todos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select>
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="todas">Categorias</option>{estado.categorias.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          <input className="input" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          <button className="btn-primary whitespace-nowrap" onClick={() => abrirNova('receita')}><Plus size={18} />Nova receita</button>
          <button className="btn-secondary whitespace-nowrap" onClick={() => abrirNova('despesa')}><Plus size={18} />Nova despesa</button>
          <button className="btn-secondary whitespace-nowrap" onClick={() => abrirRecorrencia()}><CalendarClock size={18} />Recorrente</button>
          <label className="btn-secondary cursor-pointer whitespace-nowrap"><FileUp size={18} />Importar CSV<input className="hidden" type="file" accept=".csv,text/csv" onChange={lerCSV} /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={gerarRecorrencias}>Gerar recorrentes do mes</button>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{estado.recorrentes.filter((item) => (item.status ?? (item.ativa ? 'ativa' : 'pausada')) === 'ativa').length} recorrencia(s) ativa(s)</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[30, 60, 90].map((dias) => (
          <div key={dias} className="card p-4">
            <p className="text-sm text-slate-500">Previsao {dias} dias</p>
            <strong className="mt-1 block text-xl text-violet-950 dark:text-white">{formatarMoeda(previsaoRecorrente(estado, dias))}</strong>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Lançamentos realizados</h2>
            <p className="text-sm text-slate-500">Transações efetivadas, em ordem cronológica decrescente.</p>
          </div>
        </div>
        {filtradas.length === 0 ? <div className="p-6"><EmptyState icon={Search} titulo="Nenhuma transação encontrada" texto="Adicione lançamentos, gere recorrências ou importe um CSV." /></div> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transacoesPorMes.map((grupo) => (
              <div key={grupo.mes}>
                <div className="bg-slate-50 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">{grupo.rotulo}</div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grupo.itens.map((item) => {
                    const cat = estado.categorias.find((c) => c.id === item.categoriaId);
                    return (
                      <article key={item.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-violet-50/70 dark:hover:bg-violet-950/30 sm:flex-row sm:items-center sm:gap-4">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.tipo === 'receita' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`}>
                          {item.tipo === 'receita' ? '+' : '-'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-slate-950 dark:text-white">{item.descricao}</p>
                            {item.recorrenciaId && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-200">Recorrente</span>}
                            {item.importada && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">CSV</span>}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{formatarDataCurta(item.data)} • {cat?.nome ?? 'Sem categoria'}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                          <p className={item.tipo === 'receita' ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'}>{item.tipo === 'receita' ? '+' : '-'} {formatarMoeda(item.valor)}</p>
                          <div className="mt-2 flex justify-end gap-1">
                            <button className="icon-btn" onClick={() => abrirEdicao(item)} aria-label="Editar"><Edit3 size={16} /></button>
                            <button className="icon-btn" onClick={() => excluir(item.id)} aria-label="Excluir"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Lançamentos futuros</h2>
            <p className="text-sm text-slate-500">Previsões geradas pelas recorrências ativas, sem repetir lançamentos já realizados.</p>
          </div>
          <button className="btn-secondary" onClick={gerarRecorrencias}>Gerar mês atual</button>
        </div>
        {futurasFiltradas.length === 0 ? <div className="p-6"><EmptyState icon={CalendarClock} titulo="Nenhum lançamento previsto" texto="Cadastre uma recorrência ativa para ver próximos lançamentos." /></div> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {futurasPorMes.map((grupo) => (
              <div key={grupo.mes}>
                <div className="bg-slate-50 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">{grupo.rotulo}</div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {grupo.itens.map((item) => {
                    const cat = estado.categorias.find((c) => c.id === item.recorrente.categoriaId);
                    return (
                      <article key={`${item.recorrente.id}-${item.data}`} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-violet-50/70 dark:hover:bg-violet-950/30 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          <CalendarClock size={19} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-slate-950 dark:text-white">{item.recorrente.descricao}</p>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">Previsto</span>
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-200">Recorrente</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{formatarDataCurta(item.data)} • {cat?.nome ?? 'Sem categoria'}</p>
                        </div>
                        <p className={item.recorrente.tipo === 'receita' ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'}>{item.recorrente.tipo === 'receita' ? '+' : '-'} {formatarMoeda(item.recorrente.valor)}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Recorrências cadastradas</h2>
            <p className="text-sm text-slate-500">Regras mensais usadas para gerar lançamentos previstos e realizados.</p>
          </div>
          <button className="btn-secondary" onClick={() => abrirRecorrencia()}><CalendarClock size={18} />Nova recorrência</button>
        </div>
        {estado.recorrentes.length === 0 ? <EmptyState icon={CalendarClock} titulo="Nenhuma recorrência cadastrada" texto="Crie salários, contas e cobranças mensais automáticas." /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {estado.recorrentes.map((item) => {
              const categoriaAtual = estado.categorias.find((cat) => cat.id === item.categoriaId);
              const status = item.status ?? (item.ativa ? 'ativa' : 'inativa');
              return (
                <article key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950 dark:text-white">{item.descricao}</p>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-200">Recorrente</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${status === 'ativa' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{status === 'ativa' ? 'Ativa' : 'Inativa'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{resumoRecorrencia(item)} • {categoriaAtual?.nome ?? 'Sem categoria'} • Próximo: {formatarDataCurta(proximaDataRecorrencia(item))}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className={item.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'}>{formatarMoeda(item.valor)}</strong>
                    <button className="btn-secondary" onClick={() => abrirRecorrencia(item)}><Edit3 size={16} />Editar</button>
                    <button className="btn-secondary" onClick={() => alternarRecorrencia(item)}>{status === 'ativa' ? 'Desativar' : 'Ativar'}</button>
                    <button className="icon-btn" onClick={() => excluirRecorrencia(item.id)} aria-label="Excluir recorrência"><Trash2 size={16} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal aberto={modal} titulo={editando ? 'Editar transacao' : form.tipo === 'receita' ? 'Nova receita' : 'Nova despesa'} onFechar={() => setModal(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={salvar}>
          <select className="input" value={form.tipo} onChange={(e) => {
            const novoTipo = e.target.value as TipoTransacao;
            const categoriasNovas = categoriasParaTipo(estado.categorias, novoTipo);
            setForm({ ...form, tipo: novoTipo, categoriaId: sugerirCategoria(form.descricao, estado.categorias, novoTipo) || categoriasNovas[0]?.id || '' });
          }}><option value="receita">Receita</option><option value="despesa">Despesa</option></select>
          <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}><option value="">Selecione uma categoria</option>{categoriasDoTipo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          <input className="input md:col-span-2" placeholder="Descricao" value={form.descricao} onChange={(e) => atualizarDescricao(e.target.value)} />
          <input className="input" type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
          <input className="input" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2"><button className="btn-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="btn-primary" type="submit">Salvar</button></div>
        </form>
      </Modal>

      <Modal aberto={modalRecorrencia} titulo={recorrenciaEditando ? 'Editar recorrencia' : 'Nova recorrencia'} onFechar={() => setModalRecorrencia(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={salvarRecorrencia}>
          <select className="input" value={recorrenteForm.tipo} onChange={(e) => {
            const novoTipo = e.target.value as TipoTransacao;
            const categoriasNovas = categoriasParaTipo(estado.categorias, novoTipo);
            setRecorrenteForm({ ...recorrenteForm, tipo: novoTipo, tipoRecorrencia: novoTipo, categoriaId: sugerirCategoria(recorrenteForm.descricao, estado.categorias, novoTipo) || categoriasNovas[0]?.id || '' });
          }}><option value="receita">Entrada mensal</option><option value="despesa">Saida mensal</option></select>
          <div className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">Frequencia: mensal</div>
          <input className="input md:col-span-2" placeholder="Descricao, ex: salario, aluguel, internet" value={recorrenteForm.descricao} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, descricao: e.target.value, categoriaId: sugerirCategoria(e.target.value, estado.categorias, recorrenteForm.tipo) || recorrenteForm.categoriaId })} />
          <select className="input md:col-span-2" value={recorrenteForm.categoriaId} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, categoriaId: e.target.value })}>
            <option value="">Selecione uma categoria</option>
            {categoriasRecorrencia.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
          {categoriasRecorrencia.length === 0 && <p className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Nenhuma categoria encontrada</p>}
          <input className="input" type="number" min="0" step="0.01" value={recorrenteForm.valor} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, valor: Number(e.target.value) })} />
          <input className="input" type="number" min="1" max="31" placeholder="Dia do mes" value={recorrenteForm.diaExecucao ?? ''} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, diaExecucao: Number(e.target.value), frequencia: 'mensal' })} />
          <select className="input md:col-span-2" value={recorrenteForm.status ?? 'ativa'} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, status: e.target.value as StatusRecorrencia, ativa: e.target.value === 'ativa' })}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select>
          <div className="md:col-span-2 rounded-lg bg-violet-50 p-3 text-sm font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">{resumoRecorrencia(recorrenteForm as TransacaoRecorrente)}</div>
          <div className="md:col-span-2">
            <button className="btn-secondary w-full" type="button" onClick={() => avisar(simularExecucoes(recorrenteForm as TransacaoRecorrente).join(', ') || 'Sem execucoes futuras.', 'info')}>Simular proximas execucoes</button>
          </div>
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2"><button className="btn-secondary" type="button" onClick={() => setModalRecorrencia(false)}>Cancelar</button><button className="btn-primary" type="submit">Salvar recorrencia</button></div>
        </form>
      </Modal>

      <Modal aberto={modalImportacao} titulo="Revisar importacao CSV" onFechar={() => setModalImportacao(false)}>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-2">Data</th><th>Descricao</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>{importados.map((item) => <tr key={item.idTemp} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2">{item.data}</td><td>{item.descricao}</td><td>{estado.categorias.find((cat) => cat.id === item.categoriaId)?.nome}</td><td>{formatarMoeda(item.valor)}</td><td className={item.duplicada ? 'text-amber-600' : 'text-emerald-600'}>{item.duplicada ? 'Possivel duplicata' : 'Novo'}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><button className="btn-secondary" onClick={() => setModalImportacao(false)}>Cancelar</button><button className="btn-primary" onClick={confirmarImportacao}>Salvar nao duplicados</button></div>
      </Modal>
    </div>
  );
}

function criarTransacaoVazia(estado: AppState, tipo: TipoTransacao): Omit<Transacao, 'id'> {
  return { tipo, categoriaId: estado.categorias.find((categoria) => categoria.tipo === tipo)?.id ?? '', descricao: '', valor: 0, data: new Date().toISOString().slice(0, 10) };
}

function criarRecorrenteVazio(estado: AppState): Omit<TransacaoRecorrente, 'id'> {
  return { tipo: 'despesa', tipoRecorrencia: 'despesa', categoriaId: estado.categorias.find((categoria) => categoria.tipo === 'despesa')?.id ?? '', descricao: '', valor: 0, dataInicio: new Date().toISOString().slice(0, 10), diaExecucao: new Date().getDate(), frequencia: 'mensal', status: 'ativa', ativa: true };
}

function categoriasParaTipo(categorias: AppState['categorias'], tipo: TipoTransacao) {
  return categorias.filter((categoria) => categoria.tipo === tipo);
}

function resumoRecorrencia(recorrente: Pick<TransacaoRecorrente, 'tipo' | 'tipoRecorrencia' | 'valor' | 'frequencia' | 'diaExecucao'>) {
  const acao = recorrente.tipo === 'receita' ? 'entra' : 'sai';
  const valor = formatarMoeda(Number(recorrente.valor) || 0);
  return `Todo mes, dia ${recorrente.diaExecucao ?? new Date().getDate()}, ${acao} ${valor}`;
}

function simularExecucoes(recorrente: TransacaoRecorrente) {
  const estadoTemporario: AppState = {
    usuario: { id: 'simulacao', nome: 'Simulacao', email: '', avatar: 'S', tema: 'light', metaEconomia: 25 },
    categorias: [],
    transacoes: [],
    recorrentes: [{ ...recorrente, id: recorrente.id || 'simulacao', ativa: (recorrente.status ?? 'ativa') === 'ativa' }],
    orcamentos: [],
    investimentos: [],
    metas: [],
    historicoMensal: [],
  };
  return recorrenciasFuturas(estadoTemporario, 90)
    .slice(0, 8)
    .map((item) => new Date(`${item.data}T00:00:00`).toLocaleDateString('pt-BR'));
}

function descricaoPadraoRecorrencia(tipo: TipoTransacao) {
  return tipo === 'receita' ? 'Entrada mensal recorrente' : 'Saida mensal recorrente';
}

function formatarDataCurta(data?: string) {
  if (!data) return 'sem data';
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

function agruparTransacoesPorMes(transacoes: Transacao[]) {
  const grupos = new Map<string, Transacao[]>();
  transacoes.forEach((transacao) => {
    const chave = transacao.data.slice(0, 7);
    grupos.set(chave, [...(grupos.get(chave) ?? []), transacao]);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mes, itens]) => ({ mes, rotulo: rotuloMes(mes), itens: itens.sort((a, b) => b.data.localeCompare(a.data)) }));
}

function agruparFuturasPorMes(futuras: { recorrente: TransacaoRecorrente; data: string }[]) {
  const grupos = new Map<string, { recorrente: TransacaoRecorrente; data: string }[]>();
  futuras.forEach((item) => {
    const chave = item.data.slice(0, 7);
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mes, itens]) => ({ mes, rotulo: rotuloMes(mes), itens: itens.sort((a, b) => b.data.localeCompare(a.data)) }));
}

function rotuloMes(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
