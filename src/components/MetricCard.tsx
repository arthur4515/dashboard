import { LucideIcon } from 'lucide-react';

type Props = {
  titulo: string;
  valor: string;
  variacao: string;
  tom?: 'verde' | 'vermelho' | 'azul' | 'ambar';
  icon: LucideIcon;
};

const tons = {
  verde: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  vermelho: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  azul: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  ambar: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
};

export function MetricCard({ titulo, valor, variacao, tom = 'verde', icon: Icon }: Props) {
  return (
    <div className="card p-5 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{titulo}</p>
          <strong className="mt-2 block text-2xl font-bold text-slate-950 dark:text-white">{valor}</strong>
        </div>
        <span className={`rounded-lg p-2.5 ${tons[tom]}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{variacao}</p>
    </div>
  );
}
