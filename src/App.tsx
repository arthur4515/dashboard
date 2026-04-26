import { FormEvent, ReactElement, useEffect, useMemo, useState } from 'react';
import { BarChart3, Calculator, ChartNoAxesCombined, DatabaseZap, LayoutDashboard, LogOut, ReceiptText, Target, UserCog, WalletCards } from 'lucide-react';
import { Dashboard } from './pages/Dashboard';
import { Transacoes } from './pages/Transacoes';
import { Orcamentos } from './pages/Orcamentos';
import { Investimentos } from './pages/Investimentos';
import { Simulador } from './pages/Simulador';
import { Projecao } from './pages/Projecao';
import { Relatorios } from './pages/Relatorios';
import { AuthPage } from './pages/AuthPage';
import { Gerenciar } from './pages/Gerenciar';
import { ThemeToggle } from './components/ThemeToggle';
import { ToastHost } from './components/ToastHost';
import { LoadingState } from './components/LoadingState';
import { Modal } from './components/Modal';
import { useFinanceData } from './hooks/useFinanceData';
import { useToast } from './hooks/useToast';
import { useAuth } from './hooks/useAuth';
import { atualizarPerfilSupabase } from './services/storage';
import { resumoMensal } from './utils/calculos';
import { formatarMoeda, mesAtualISO } from './utils/formatadores';
import { Usuario } from './types/financeiro';

const telas = [
  { id: 'dashboard', nome: 'Dashboard', icon: LayoutDashboard },
  { id: 'transacoes', nome: 'Transacoes', icon: ReceiptText },
  { id: 'orcamentos', nome: 'Orcamento', icon: Target },
  { id: 'investimentos', nome: 'Investimentos', icon: WalletCards },
  { id: 'simulador', nome: 'Simulador', icon: Calculator },
  { id: 'projecao', nome: 'Projecao', icon: ChartNoAxesCombined },
  { id: 'relatorios', nome: 'Relatorios', icon: BarChart3 },
  { id: 'gerenciar', nome: 'Gerenciar', icon: DatabaseZap },
] as const;

type Tela = typeof telas[number]['id'];

export default function App() {
  const { usuario, setUsuario, carregandoAuth, erroAuth, login, cadastro, sair } = useAuth();
  const { estado, setEstado, carregando, erroDados, resetarExemplos } = useFinanceData(usuario);
  const { toasts, mostrar } = useToast();
  const [tela, setTela] = useState<Tela>('dashboard');
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [perfil, setPerfil] = useState<Pick<Usuario, 'nome' | 'email' | 'avatar' | 'tema' | 'metaEconomia'> | null>(null);

  useEffect(() => {
    const tema = estado?.usuario.tema ?? usuario?.tema ?? 'light';
    document.documentElement.classList.toggle('dark', tema === 'dark');
  }, [estado?.usuario.tema, usuario?.tema]);

  useEffect(() => {
    if (estado) {
      setPerfil({
        nome: estado.usuario.nome,
        email: estado.usuario.email,
        avatar: estado.usuario.avatar,
        tema: estado.usuario.tema,
        metaEconomia: estado.usuario.metaEconomia,
      });
    }
  }, [estado]);

  const resumo = useMemo(() => estado ? resumoMensal(estado, mesAtualISO()) : null, [estado]);
  const telaAtual = telas.find((item) => item.id === tela) ?? telas[0];

  if (carregandoAuth) {
    return <div className="min-h-screen bg-[#F8F7FF] p-6 dark:bg-[#0F0A1F]"><LoadingState /></div>;
  }

  if (!usuario) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0F0A1F]">
        <ToastHost toasts={toasts} />
        <AuthPage login={login} cadastro={cadastro} avisar={mostrar} erroConfig={erroAuth} />
      </div>
    );
  }

  if (erroDados && !estado && !carregando) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] p-6 text-slate-700 dark:bg-[#0F0A1F] dark:text-slate-200">
        <ToastHost toasts={toasts} />
        <div className="mx-auto mt-16 max-w-2xl rounded-lg border border-rose-200 bg-white p-6 shadow-suave dark:border-rose-900 dark:bg-[#17102A]">
          <h1 className="text-xl font-black text-violet-950 dark:text-white">Nao foi possivel carregar seus dados</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{erroDados}</p>
          <button className="btn-primary mt-5" onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!estado || carregando || !resumo) {
    return <div className="min-h-screen bg-[#F8F7FF] p-6 dark:bg-[#0F0A1F]"><LoadingState /></div>;
  }

  function alternarTema() {
    setEstado((atual) => atual && ({ ...atual, usuario: { ...atual.usuario, tema: atual.usuario.tema === 'dark' ? 'light' : 'dark' } }));
  }

  async function salvarPerfil(event: FormEvent) {
    event.preventDefault();
    if (!perfil || !perfil.nome.trim() || !perfil.email.trim()) {
      mostrar('Preencha nome e email.', 'erro');
      return;
    }
    try {
      const auth = await atualizarPerfilSupabase(usuario!.id, perfil);
      setUsuario(auth);
      setEstado((atual) => atual && ({ ...atual, usuario: { ...atual.usuario, ...perfil } }));
      setPerfilAberto(false);
      mostrar('Perfil atualizado.');
    } catch (erro) {
      mostrar(erro instanceof Error ? erro.message : 'Nao foi possivel salvar o perfil.', 'erro');
    }
  }

  const conteudo = {
    dashboard: <Dashboard estado={estado} />,
    transacoes: <Transacoes estado={estado} setEstado={setEstado} avisar={mostrar} />,
    orcamentos: <Orcamentos estado={estado} setEstado={setEstado} avisar={mostrar} />,
    investimentos: <Investimentos estado={estado} setEstado={setEstado} avisar={mostrar} />,
    simulador: <Simulador />,
    projecao: <Projecao estado={estado} />,
    relatorios: <Relatorios estado={estado} avisar={mostrar} />,
    gerenciar: <Gerenciar estado={estado} setEstado={setEstado} avisar={mostrar} resetarExemplos={() => { void resetarExemplos(); }} />,
  } satisfies Record<Tela, ReactElement>;

  return (
    <div className="min-h-screen bg-[#F8F7FF] text-slate-700 dark:bg-[#0F0A1F] dark:text-slate-200">
      <ToastHost toasts={toasts} />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-violet-100 bg-white/95 p-5 backdrop-blur dark:border-violet-950 dark:bg-[#17102A]/95 lg:block">
        <div className="flex items-center gap-3">
          <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-lg text-lg font-black">DF</div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-violet-950 dark:text-white">Dingaringa</h1>
            <p className="text-sm text-violet-500 dark:text-violet-300">Finance</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {telas.map((item) => {
            const Icon = item.icon;
            const ativo = item.id === tela;
            return (
              <button key={item.id} onClick={() => setTela(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${ativo ? 'bg-violet-50 text-violet-700 shadow-sm dark:bg-violet-500/10 dark:text-violet-200' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-300 dark:hover:bg-violet-950/60'}`}>
                <Icon size={19} />{item.nome}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-lg bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 dark:from-[#0F0A1F] dark:to-violet-950">
          <p className="text-sm text-violet-500 dark:text-violet-300">Saldo atual</p>
          <strong className="mt-1 block text-xl text-slate-950 dark:text-white">{formatarMoeda(resumo.saldoAtual)}</strong>
        </div>
      </aside>

      <main className="pb-24 lg:ml-72 lg:pb-8">
        <header className="sticky top-0 z-20 border-b border-violet-100 bg-[#F8F7FF]/90 px-4 py-4 backdrop-blur dark:border-violet-950 dark:bg-[#0F0A1F]/90 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Ola, {estado.usuario.nome.split(' ')[0]}</p>
              <h2 className="text-2xl font-black text-violet-950 dark:text-white">{telaAtual.nome}</h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden rounded-lg border border-violet-100 bg-white px-4 py-2 text-right shadow-sm dark:border-violet-900 dark:bg-[#17102A] sm:block">
                <p className="text-xs text-slate-500">Economia do mes</p>
                <strong className="text-sm text-emerald-600">{formatarMoeda(resumo.economia)}</strong>
              </div>
              <ThemeToggle escuro={estado.usuario.tema === 'dark'} alternar={alternarTema} />
              <button className="icon-btn" onClick={() => setPerfilAberto(true)} aria-label="Editar perfil" title="Editar perfil"><UserCog size={18} /></button>
              <button className="icon-btn" onClick={() => { void sair().then(() => mostrar('Sessao encerrada.', 'info')).catch((erro) => mostrar(erro instanceof Error ? erro.message : 'Erro ao sair.', 'erro')); }} aria-label="Sair" title="Sair"><LogOut size={18} /></button>
              <button className="brand-mark flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold" onClick={() => setPerfilAberto(true)}>{estado.usuario.avatar}</button>
            </div>
          </div>
        </header>

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {erroDados && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{erroDados}</div>}
          {conteudo[tela]}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-violet-100 bg-white/95 px-1 py-2 backdrop-blur dark:border-violet-950 dark:bg-[#17102A]/95 lg:hidden">
        {telas.slice(0, 8).map((item) => {
          const Icon = item.icon;
          const ativo = item.id === tela;
          return (
            <button key={item.id} onClick={() => setTela(item.id)} className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold transition ${ativo ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200' : 'text-slate-500'}`}>
              <Icon size={18} />
              <span className="max-w-full truncate">{item.nome}</span>
            </button>
          );
        })}
      </nav>

      <Modal aberto={perfilAberto && !!perfil} titulo="Area do usuario" onFechar={() => setPerfilAberto(false)}>
        {perfil && (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={salvarPerfil}>
            <input className="input" placeholder="Nome" value={perfil.nome} onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })} />
            <input className="input" type="email" placeholder="Email" value={perfil.email} onChange={(e) => setPerfil({ ...perfil, email: e.target.value })} />
            <input className="input" placeholder="Iniciais" value={perfil.avatar} maxLength={3} onChange={(e) => setPerfil({ ...perfil, avatar: e.target.value.toUpperCase() })} />
            <input className="input" type="number" min="0" max="100" value={perfil.metaEconomia} onChange={(e) => setPerfil({ ...perfil, metaEconomia: Number(e.target.value) })} />
            <select className="input md:col-span-2" value={perfil.tema} onChange={(e) => setPerfil({ ...perfil, tema: e.target.value as 'light' | 'dark' })}><option value="light">Tema claro</option><option value="dark">Tema escuro</option></select>
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              <button className="btn-secondary" type="button" onClick={() => setPerfilAberto(false)}>Cancelar</button>
              <button className="btn-primary" type="submit">Salvar perfil</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
