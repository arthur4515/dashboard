import { FormEvent, useState } from 'react';
import { Edit3, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { AppState, Categoria, MetaFinanceira, TipoTransacao } from '../types/financeiro';
import { Modal } from '../components/Modal';
import { Section } from '../components/Section';
import { formatarMoeda } from '../utils/formatadores';
import { uid } from '../utils/calculos';
import { ritmoMeta } from '../utils/automacoes';

type Props = {
  estado: AppState;
  setEstado: React.Dispatch<React.SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  resetarExemplos: () => void;
};

const categoriaBase: Omit<Categoria, 'id'> = { nome: '', tipo: 'despesa', cor: '#10b981' };
const metaBase: Omit<MetaFinanceira, 'id'> = { nome: '', valorAlvo: 10000, valorAtual: 0, prazo: new Date().toISOString().slice(0, 10) };

export function Gerenciar({ estado, setEstado, avisar, resetarExemplos }: Props) {
  const [modalCategoria, setModalCategoria] = useState(false);
  const [modalMeta, setModalMeta] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null);
  const [metaEditando, setMetaEditando] = useState<MetaFinanceira | null>(null);
  const [categoriaForm, setCategoriaForm] = useState(categoriaBase);
  const [metaForm, setMetaForm] = useState(metaBase);

  function salvarCategoria(event: FormEvent) {
    event.preventDefault();
    if (!categoriaForm.nome.trim()) return avisar('Informe o nome da categoria.', 'erro');
    setEstado((atual) => atual && ({
      ...atual,
      categorias: categoriaEditando
        ? atual.categorias.map((item) => item.id === categoriaEditando.id ? { ...categoriaForm, id: item.id } : item)
        : [...atual.categorias, { ...categoriaForm, id: uid('cat') }],
    }));
    avisar('Categoria salva.');
    setModalCategoria(false);
  }

  function salvarMeta(event: FormEvent) {
    event.preventDefault();
    if (!metaForm.nome.trim() || metaForm.valorAlvo <= 0) return avisar('Preencha a meta corretamente.', 'erro');
    setEstado((atual) => atual && ({
      ...atual,
      metas: metaEditando
        ? atual.metas.map((item) => item.id === metaEditando.id ? { ...metaForm, id: item.id } : item)
        : [...atual.metas, { ...metaForm, id: uid('meta') }],
    }));
    avisar('Meta salva.');
    setModalMeta(false);
  }

  function abrirCategoria(item?: Categoria) {
    setCategoriaEditando(item ?? null);
    setCategoriaForm(item ? { nome: item.nome, tipo: item.tipo, cor: item.cor } : categoriaBase);
    setModalCategoria(true);
  }

  function abrirMeta(item?: MetaFinanceira) {
    setMetaEditando(item ?? null);
    setMetaForm(item ? { nome: item.nome, valorAlvo: item.valorAlvo, valorAtual: item.valorAtual, prazo: item.prazo } : metaBase);
    setModalMeta(true);
  }

  return (
    <div className="space-y-6">
      <Section titulo="Categorias" acao={<button className="btn-primary" onClick={() => abrirCategoria()}><Plus size={18} />Nova categoria</button>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {estado.categorias.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full" style={{ background: item.cor }} /><div><h3 className="font-bold text-slate-950 dark:text-white">{item.nome}</h3><p className="text-sm text-slate-500">{item.tipo}</p></div></div>
                <div className="flex gap-2"><button className="icon-btn" onClick={() => abrirCategoria(item)} aria-label="Editar"><Edit3 size={16} /></button><button className="icon-btn" onClick={() => {
                  setEstado((atual) => atual && ({ ...atual, categorias: atual.categorias.filter((cat) => cat.id !== item.id), orcamentos: atual.orcamentos.filter((orc) => orc.categoriaId !== item.id) }));
                  avisar('Categoria excluida.');
                }} aria-label="Excluir"><Trash2 size={16} /></button></div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section titulo="Metas financeiras" acao={<button className="btn-primary" onClick={() => abrirMeta()}><Plus size={18} />Nova meta</button>}>
        <div className="grid gap-4 lg:grid-cols-2">
          {estado.metas.map((item) => {
            const ritmo = ritmoMeta(item.valorAtual, item.valorAlvo, item.prazo);
            return (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-bold text-slate-950 dark:text-white">{item.nome}</h3><p className="text-sm text-slate-500">Prazo: {new Date(item.prazo).toLocaleDateString('pt-BR')}</p></div>
                  <div className="flex gap-2"><button className="icon-btn" onClick={() => abrirMeta(item)} aria-label="Editar"><Edit3 size={16} /></button><button className="icon-btn" onClick={() => {
                    setEstado((atual) => atual && ({ ...atual, metas: atual.metas.filter((meta) => meta.id !== item.id) }));
                    avisar('Meta excluida.');
                  }} aria-label="Excluir"><Trash2 size={16} /></button></div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full ${ritmo.noRitmo ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${ritmo.progresso}%` }} /></div>
                <p className="mt-2 text-sm text-slate-500">{formatarMoeda(item.valorAtual)} de {formatarMoeda(item.valorAlvo)}</p>
                <p className={`mt-1 text-sm font-semibold ${ritmo.noRitmo ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Falta {formatarMoeda(ritmo.falta)}. Guarde {formatarMoeda(ritmo.precisaMes)} por mes para chegar no prazo.
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section titulo="Dados de exemplo">
        <button className="btn-secondary" onClick={() => { resetarExemplos(); avisar('Dados de exemplo restaurados.'); }}><RotateCcw size={18} />Resetar dados de exemplo</button>
      </Section>

      <Modal aberto={modalCategoria} titulo={categoriaEditando ? 'Editar categoria' : 'Nova categoria'} onFechar={() => setModalCategoria(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={salvarCategoria}>
          <input className="input md:col-span-2" placeholder="Nome" value={categoriaForm.nome} onChange={(e) => setCategoriaForm({ ...categoriaForm, nome: e.target.value })} />
          <select className="input" value={categoriaForm.tipo} onChange={(e) => setCategoriaForm({ ...categoriaForm, tipo: e.target.value as TipoTransacao })}><option value="receita">Receita</option><option value="despesa">Despesa</option></select>
          <input className="input h-11" type="color" value={categoriaForm.cor} onChange={(e) => setCategoriaForm({ ...categoriaForm, cor: e.target.value })} />
          <button className="btn-primary md:col-span-2" type="submit"><Save size={18} />Salvar</button>
        </form>
      </Modal>

      <Modal aberto={modalMeta} titulo={metaEditando ? 'Editar meta' : 'Nova meta'} onFechar={() => setModalMeta(false)}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={salvarMeta}>
          <input className="input md:col-span-2" placeholder="Nome da meta" value={metaForm.nome} onChange={(e) => setMetaForm({ ...metaForm, nome: e.target.value })} />
          <input className="input" type="number" min="1" value={metaForm.valorAlvo} onChange={(e) => setMetaForm({ ...metaForm, valorAlvo: Number(e.target.value) })} />
          <input className="input" type="number" min="0" value={metaForm.valorAtual} onChange={(e) => setMetaForm({ ...metaForm, valorAtual: Number(e.target.value) })} />
          <input className="input md:col-span-2" type="date" value={metaForm.prazo} onChange={(e) => setMetaForm({ ...metaForm, prazo: e.target.value })} />
          <button className="btn-primary md:col-span-2" type="submit"><Save size={18} />Salvar</button>
        </form>
      </Modal>
    </div>
  );
}
