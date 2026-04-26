import { useState } from 'react';
import { Toast } from '../types/financeiro';
import { uid } from '../utils/calculos';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function mostrar(mensagem: string, tipo: Toast['tipo'] = 'sucesso') {
    const toast = { id: uid('toast'), mensagem, tipo };
    setToasts((atuais) => [...atuais, toast]);
    window.setTimeout(() => setToasts((atuais) => atuais.filter((item) => item.id !== toast.id)), 3200);
  }

  return { toasts, mostrar };
}
