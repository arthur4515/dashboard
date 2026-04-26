import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Toast } from '../types/financeiro';

export function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-32px))] flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = toast.tipo === 'sucesso' ? CheckCircle2 : toast.tipo === 'erro' ? AlertCircle : Info;
        return (
          <div key={toast.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-suave dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <Icon size={20} className={toast.tipo === 'erro' ? 'text-rose-500' : toast.tipo === 'info' ? 'text-violet-500' : 'text-emerald-500'} />
            {toast.mensagem}
          </div>
        );
      })}
    </div>
  );
}
