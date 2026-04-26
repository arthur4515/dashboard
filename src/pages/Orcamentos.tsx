import { FormEvent, useState } from 'react';
import { AlertTriangle, Edit3, Plus, Trash2 } from 'lucide-react';
import { AppState, Orcamento } from '../types/financeiro';
import { Section } from '../components/Section';
import { Modal } from '../components/Modal';
import { filtrarPorMes, uid } from '../utils/calculos';
import { formatarMoeda, mesAtualISO } from '../utils/formatadores';
import { sugerirOrcamentos } from '../utils/automacoes';

type Props = {
  estado: AppState;
  setEstado: React.Dispatch<React.SetStateAction<AppState | null>>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
};

export function Orcamentos({ estado, setEstado, avisar }: Props) {
  const primeiraCategoria = estado.categorias.find((item) => item.tipo === 'despesa')?.id ?? '';
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Orcamento | null>(null);
  const [categoriaId, setCategoriaId] = useState(primeiraCategoria);
  const [limite, setLimite] = useState(1000);
  const despesasMes = filtrarPorMes(estado.transacoes, mesAtualISO()).filter((item) => item.tipo === 'despesa');

  function abrir(orcamento?: Orcamento) {
    setEditando(orcamento ?? null);
    setCategoriaId(orcamento?.categoriaId ?? primeiraCategoria);
    setLimite(orcamento?.limite ?? 1000);
    setModal(true);
  }

  function salvar(event: FormEvent) {
    event.preventDefault();
    if (!categoriaId || limite <= 0) return avisar('Preencha categoria e limite.', 'erro');
    setEstado((atual) => atual && ({
      ...atual,
      orcamentos: editando
        ? atual.orcamentos.map((item) => item.id === editando.id ? { ...item, categoriaId, limite } : item)
        : [...atual.orcamentos, { id: uid('o'), categoriaId, limite }],
    }));
    avisar('Orcamento salvo.');
    setModal(false);
  }

  function excluir(id: string) {
    setEstado((atual) => atual && ({ ...atual, orcamentos: atual.orcamentos.filter((item) => item.id !== id) }));
    avisar('Orcamento excluido.');
  }

  function aplicarSugestoes() {
    const sugestoes = sugerirOrcamentos(estado);
    if (sugestoes.length === 0) return avisar('Nao ha historico suficiente para sugerir orcamentos.', 'info');
    setEstado((atual) => atual && ({
      ...atual,
      orcamentos: sugestoes.map((sugestao) => {
        const existente = atual.orcamentos.find((item) => item.categoriaId === sugestao.categoriaId);
        return { id: existente?.id ?? uid('o'), categoriaId: sugestao.categoriaId, limite: sugestao.limiteSugerido };
      }),
    }));
    avisar('Orcamentos sugeridos pela media historica.');
  }

  return (
    <Section titulo="Orcamento mensal" acao={<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={aplicarSugestoes}>Sugerir limites</button><button className="btn-primary" onClick={() => abrir()}><Plus size={18} />Novo limite</button></div>}>
      <div className="grid gap-4 lg:grid-cols-2">
        {estado.orcamentos.map((orcamento) => {
          const categoria = estado.categorias.find((item) => item.id === orcamento.categoriaId);
          const usado = despesasMes.filter((item) => item.categoriaId === orcamento.categoriaId).reduce((total, item) => total + item.valor, 0);
          const porcentagem = Math.min((usado / orcamento.limite) * 100, 140);
          const passou = usado > orcamento.limite;
          const alerta = !passou && porcentagem >= 80;
          return (
            <div key={orcamento.id} className="rounded-lg border border-slate-200 p-4 transition hover:-translate-y-0.5 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-950 dark:text-white">{categoria?.nome ?? 'Categoria removida'}</h3>
                  <p className="mt-1 text-sm text-slate-500">Usado {formatarMoeda(usado)} de {formatarMoeda(orcamento.limite)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <strong className={passou ? 'text-rose-600' : 'text-emerald-600'}>{formatarMoeda(orcamento.limite - usado)}</strong>
                  <button className="icon-btn" onClick={() => abrir(orcamento)} aria-label="Editar"><Edit3 size={16} /></button>
                  <button className="icon-btn" onClick={() => excluir(orcamento.id)} aria-label="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-full rounded-full ${passou ? 'bg-rose-500' : alerta ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(porcentagem, 100)}%` }} />
              </div>
              {(alerta || passou) && (
                <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${passou ? 'text-rose-600' : 'text-amber-600'}`}>
                  <AlertTriangle size={16} />{passou ? 'Limite ultrapassado' : 'Atencao: acima de 80%'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Modal aberto={modal} titulo={editando ? 'Editar orcamento' : 'Criar limite por categoria'} onFechar={() => setModal(false)}>
        <form className="grid gap-4" onSubmit={salvar}>
          <select className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {estado.categorias.filter((item) => item.tipo === 'despesa').map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
          <input className="input" type="number" min="1" value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
          <div className="grid gap-3 md:grid-cols-2">
            <button className="btn-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" type="submit">Salvar</button>
          </div>
        </form>
      </Modal>
    </Section>
  );
}
