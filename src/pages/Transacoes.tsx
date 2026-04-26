import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { CalendarClock, Edit3, FileUp, Plus, Search, Trash2 } from 'lucide-react';
import { AppState, FrequenciaRecorrencia, StatusRecorrencia, TipoRecorrencia, TipoTransacao, Transacao, TransacaoRecorrente } from '../types/financeiro';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';
import { uid } from '../utils/calculos';
import { detectarDuplicata, gerarLancamentosRecorrentesAte, gerarRecorrenciasDoMes, ImportacaoCSV, importarCSV, previsaoRecorrente, proximaDataRecorrencia, recorrenciasFuturas, sugerirCategoria } from '../utils/automacoes';

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
  const [form, setForm] = useState<Omit<Transacao, 'id'>>(() => criarTransacaoVazia(estado, 'despesa'));
  const [recorrenteForm, setRecorrenteForm] = useState<Omit<TransacaoRecorrente, 'id'>>(() => criarRecorrenteVazio(estado));
  const [importados, setImportados] = useState<ImportacaoCSV[]>([]);
  const [tipo, setTipo] = useState<'todos' | TipoTransacao>('todos');
  const [categoria, setCategoria] = useState('todas');
  const [mes, setMes] = useState(mesAtualISO());
  const [busca, setBusca] = useState('');
  const futuras = recorrenciasFuturas(estado, 90).slice(0, 12);

  const categoriasDoTipo = estado.categorias.filter((item) => item.tipo === form.tipo);
  const filtradas = useMemo(() => estado.transacoes.filter((item) => {
    const texto = item.descricao.toLowerCase().includes(busca.toLowerCase());
    return texto && (tipo === 'todos' || item.tipo === tipo) && (categoria === 'todas' || item.categoriaId === categoria) && item.data.startsWith(mes);
  }).sort((a, b) => b.data.localeCompare(a.data)), [estado.transacoes, tipo, categoria, mes, busca]);

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

  function salvarRecorrencia(event: FormEvent) {
    event.preventDefault();
    if (!recorrenteForm.descricao.trim() || recorrenteForm.valor <= 0 || !recorrenteForm.categoriaId) {
      avisar('Preencha a recorrencia corretamente.', 'erro');
      return;
    }
    const nova = { ...recorrenteForm, proximaData: proximaDataRecorrencia(recorrenteForm as TransacaoRecorrente), id: uid('rec') };
    setEstado((atual) => atual && ({ ...atual, recorrentes: [...atual.recorrentes, nova] }));
    avisar('Recorrencia criada.');
    setModalRecorrencia(false);
  }

  function gerarRecorrencias() {
    const novas = gerarRecorrenciasDoMes(estado, mes);
    if (novas.length === 0) return avisar('Nenhum lancamento novo para gerar.', 'info');
    setEstado((atual) => atual && ({ ...atual, transacoes: [...novas, ...atual.transacoes] }));
    avisar(`${novas.length} lancamento(s) recorrente(s) gerado(s).`);
  }

  function gerarProximosDias(dias: number) {
    const novas = gerarLancamentosRecorrentesAte(estado, dias);
    if (novas.length === 0) return avisar('Nenhum lancamento futuro novo para gerar.', 'info');
    setEstado((atual) => atual && ({ ...atual, transacoes: [...novas, ...atual.transacoes] }));
    avisar(`${novas.length} lancamento(s) gerado(s) para os proximos ${dias} dias.`);
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
          <button className="btn-secondary whitespace-nowrap" onClick={() => setModalRecorrencia(true)}><CalendarClock size={18} />Recorrente</button>
          <label className="btn-secondary cursor-pointer whitespace-nowrap"><FileUp size={18} />Importar CSV<input className="hidden" type="file" accept=".csv,text/csv" onChange={lerCSV} /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={gerarRecorrencias}>Gerar recorrentes do mes</button>
          <button className="btn-secondary" onClick={() => gerarProximosDias(30)}>Gerar proximos 30 dias</button>
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

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Recorrencias futuras</h2>
          <button className="btn-secondary" onClick={() => gerarProximosDias(90)}>Gerar proximos 90 dias</button>
        </div>
        {futuras.length === 0 ? <EmptyState icon={CalendarClock} titulo="Sem recorrencias futuras" texto="Cadastre uma recorrencia ativa para ver proximas cobrancas, recebimentos e aportes." /> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {futuras.map((item) => (
              <div key={`${item.recorrente.id}-${item.data}`} className="rounded-lg border border-violet-100 p-3 dark:border-violet-950">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-950 dark:text-white">{item.recorrente.descricao}</p><p className="text-sm text-slate-500">{item.recorrente.tipoRecorrencia ?? item.recorrente.tipo} - {new Date(item.data).toLocaleDateString('pt-BR')}</p></div>
                  <strong className={item.recorrente.tipo === 'receita' ? 'text-emerald-600' : 'text-rose-600'}>{formatarMoeda(item.recorrente.valor)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {filtradas.length === 0 ? <div className="p-6"><EmptyState icon={Search} titulo="Nenhuma transacao encontrada" texto="Adicione lancamentos, gere recorrencias ou importe um CSV." /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400"><tr><th className="p-4">Descricao</th><th>Categoria</th><th>Data</th><th>Origem</th><th>Valor</th><th className="pr-4 text-right">Acoes</th></tr></thead>
              <tbody>
                {filtradas.map((item) => {
                  const cat = estado.categorias.find((c) => c.id === item.categoriaId);
                  return (
                    <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">{item.descricao}</td>
                      <td>{cat?.nome ?? 'Sem categoria'}</td><td>{new Date(item.data).toLocaleDateString('pt-BR')}</td><td>{item.recorrenciaId ? 'Recorrente' : item.importada ? 'CSV' : 'Manual'}</td>
                      <td className={item.tipo === 'receita' ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'}>{formatarMoeda(item.valor)}</td>
                      <td className="pr-4 text-right"><button className="icon-btn mr-2" onClick={() => abrirEdicao(item)} aria-label="Editar"><Edit3 size={16} /></button><button className="icon-btn" onClick={() => excluir(item.id)} aria-label="Excluir"><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal aberto={modal} titulo={editando ? 'Editar transacao' : form.tipo === 'receita' ? 'Nova receita' : 'Nova despesa'} onFechar={() => setModal(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={salvar}>
          <select className="input" value={form.tipo} onChange={(e) => {
            const novoTipo = e.target.value as TipoTransacao;
            setForm({ ...form, tipo: novoTipo, categoriaId: sugerirCategoria(form.descricao, estado.categorias, novoTipo) });
          }}><option value="receita">Receita</option><option value="despesa">Despesa</option></select>
          <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>{categoriasDoTipo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          <input className="input md:col-span-2" placeholder="Descricao" value={form.descricao} onChange={(e) => atualizarDescricao(e.target.value)} />
          <input className="input" type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
          <input className="input" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2"><button className="btn-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="btn-primary" type="submit">Salvar</button></div>
        </form>
      </Modal>

      <Modal aberto={modalRecorrencia} titulo="Nova transacao recorrente" onFechar={() => setModalRecorrencia(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={salvarRecorrencia}>
          <select className="input" value={recorrenteForm.tipoRecorrencia ?? recorrenteForm.tipo} onChange={(e) => {
            const tipoRecorrencia = e.target.value as TipoRecorrencia;
            const novoTipo: TipoTransacao = tipoRecorrencia === 'receita' ? 'receita' : 'despesa';
            setRecorrenteForm({ ...recorrenteForm, tipoRecorrencia, tipo: novoTipo, categoriaId: sugerirCategoria(recorrenteForm.descricao, estado.categorias, novoTipo) });
          }}><option value="receita">Receita recorrente</option><option value="despesa">Despesa recorrente</option><option value="aporte">Aporte recorrente</option></select>
          <select className="input" value={recorrenteForm.frequencia} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, frequencia: e.target.value as FrequenciaRecorrencia })}><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option><option value="bimestral">Bimestral</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select>
          <input className="input md:col-span-2" placeholder="Ex: aluguel, salario, internet" value={recorrenteForm.descricao} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, descricao: e.target.value, categoriaId: sugerirCategoria(e.target.value, estado.categorias, recorrenteForm.tipo) })} />
          <select className="input" value={recorrenteForm.categoriaId} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, categoriaId: e.target.value })}>{estado.categorias.filter((item) => item.tipo === recorrenteForm.tipo).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          <input className="input" type="number" min="0" step="0.01" value={recorrenteForm.valor} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, valor: Number(e.target.value) })} />
          <input className="input" type="date" value={recorrenteForm.dataInicio} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, dataInicio: e.target.value })} />
          <input className="input" type="date" value={recorrenteForm.dataFinal ?? ''} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, dataFinal: e.target.value || undefined })} />
          <select className="input md:col-span-2" value={recorrenteForm.status ?? 'ativa'} onChange={(e) => setRecorrenteForm({ ...recorrenteForm, status: e.target.value as StatusRecorrencia, ativa: e.target.value === 'ativa' })}><option value="ativa">Ativa</option><option value="pausada">Pausada</option><option value="encerrada">Encerrada</option></select>
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
  return { tipo: 'despesa', tipoRecorrencia: 'despesa', categoriaId: estado.categorias.find((categoria) => categoria.tipo === 'despesa')?.id ?? '', descricao: '', valor: 0, dataInicio: new Date().toISOString().slice(0, 10), frequencia: 'mensal', status: 'ativa', ativa: true };
}
