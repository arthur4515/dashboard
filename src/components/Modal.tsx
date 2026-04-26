import { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ aberto, titulo, onFechar, children }: { aberto: boolean; titulo: string; onFechar: () => void; children: ReactNode }) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-suave dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">{titulo}</h2>
          <button className="icon-btn" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
