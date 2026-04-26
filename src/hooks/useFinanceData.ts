import { useEffect, useRef, useState } from 'react';
import { AppState, AuthUser } from '../types/financeiro';
import { carregarEstadoSupabase, resetarDadosSupabase, salvarEstadoSupabase } from '../services/storage';

export function useFinanceData(usuario: AuthUser | null) {
  const [estado, setEstado] = useState<AppState | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const carregouInicial = useRef(false);
  const salvando = useRef<number | null>(null);

  useEffect(() => {
    carregouInicial.current = false;
    setErroDados(null);
    if (!usuario) {
      setEstado(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    carregarEstadoSupabase(usuario)
      .then((dados) => {
        setEstado(dados);
        carregouInicial.current = true;
      })
      .catch((erro) => setErroDados(erro instanceof Error ? erro.message : 'Erro ao carregar dados.'))
      .finally(() => setCarregando(false));
  }, [usuario]);

  useEffect(() => {
    if (!usuario || !estado || !carregouInicial.current) return;
    if (salvando.current) window.clearTimeout(salvando.current);
    salvando.current = window.setTimeout(() => {
      salvarEstadoSupabase(usuario.id, estado).catch((erro) => setErroDados(erro instanceof Error ? erro.message : 'Erro ao salvar dados.'));
    }, 650);
    return () => {
      if (salvando.current) window.clearTimeout(salvando.current);
    };
  }, [estado, usuario]);

  async function resetarExemplos() {
    if (!usuario) return null;
    const dados = await resetarDadosSupabase(usuario);
    setEstado(dados);
    return dados;
  }

  return { estado, setEstado, carregando, erroDados, resetarExemplos };
}
