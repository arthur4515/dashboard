import { useEffect, useState } from 'react';
import { AuthUser } from '../types/financeiro';
import { authUserFromSupabase, cadastrarSupabase, loginSupabase, logoutSupabase } from '../services/storage';
import { supabase, supabaseConfigurado } from '../services/supabaseClient';

export function useAuth() {
  const [usuario, setUsuario] = useState<AuthUser | null>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [erroAuth, setErroAuth] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado || !supabase) {
      setErroAuth('Supabase nao configurado. Crie um .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
      setCarregandoAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setErroAuth(error.message);
      setUsuario(data.session?.user ? authUserFromSupabase(data.session.user) : null);
      setCarregandoAuth(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ? authUserFromSupabase(session.user) : null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(email: string, senha: string) {
    const auth = await loginSupabase(email, senha);
    setUsuario(auth);
    return auth;
  }

  async function cadastro(nome: string, email: string, senha: string) {
    const auth = await cadastrarSupabase(nome, email, senha);
    setUsuario(auth);
    return auth;
  }

  async function sair() {
    await logoutSupabase();
    setUsuario(null);
  }

  return { usuario, setUsuario, carregandoAuth, erroAuth, login, cadastro, sair };
}
