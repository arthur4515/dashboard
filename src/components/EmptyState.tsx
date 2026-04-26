import { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, titulo, texto }: { icon: LucideIcon; titulo: string; texto: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
      <Icon className="text-slate-400" size={34} />
      <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{titulo}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{texto}</p>
    </div>
  );
}
