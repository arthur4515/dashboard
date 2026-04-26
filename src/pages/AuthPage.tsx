import { FormEvent, useState } from 'react';
import { LockKeyhole, LogIn, UserPlus, WalletCards } from 'lucide-react';

type Props = {
  login: (email: string, senha: string) => Promise<unknown>;
  cadastro: (nome: string, email: string, senha: string) => Promise<unknown>;
  avisar: (msg: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  erroConfig?: string | null;
};

export function AuthPage({ login, cadastro, avisar, erroConfig }: Props) {
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: FormEvent) {
    event.preventDefault();
    try {
      if (!email.trim() || !senha.trim() || (modo === 'cadastro' && !nome.trim())) {
        avisar('Preencha todos os campos obrigatorios.', 'erro');
        return;
      }
      if (modo === 'cadastro' && senha.length < 6) {
        avisar('A senha precisa ter pelo menos 6 caracteres.', 'erro');
        return;
      }
      setEnviando(true);
      if (modo === 'login') {
        await login(email, senha);
        avisar('Login realizado.');
      } else {
        await cadastro(nome, email, senha);
        avisar('Conta criada com sucesso.');
      }
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : 'Nao foi possivel entrar.', 'erro');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_440px]">
          <section className="flex flex-col justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-suave">
              <WalletCards size={30} />
            </div>
            <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">FinanZen</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
              Um painel financeiro pessoal com login Supabase, dados na nuvem e sincronizacao entre computador e celular.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {['Supabase Auth', 'Dados por usuario', 'PC e celular'].map((item) => (
                <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold shadow-sm dark:border-slate-800 dark:bg-slate-900">{item}</div>
              ))}
            </div>
          </section>

          <section className="card p-6">
            <div className="mb-6 flex rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
              <button className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${modo === 'login' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900' : 'text-slate-500'}`} onClick={() => setModo('login')}>Entrar</button>
              <button className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${modo === 'cadastro' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900' : 'text-slate-500'}`} onClick={() => setModo('cadastro')}>Cadastrar</button>
            </div>
            {erroConfig && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{erroConfig}</div>}
            <form className="space-y-4" onSubmit={enviar}>
              {modo === 'cadastro' && (
                <label className="block text-sm font-semibold">Nome<input className="input mt-1" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" /></label>
              )}
              <label className="block text-sm font-semibold">Email<input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></label>
              <label className="block text-sm font-semibold">Senha<input className="input mt-1" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
              <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={enviando || !!erroConfig}>{modo === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}{enviando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}</button>
            </form>
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-bold"><LockKeyhole size={16} />Autenticacao real</div>
              <p className="mt-1">As contas sao criadas no Supabase Auth e os dados ficam salvos no banco do projeto.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
