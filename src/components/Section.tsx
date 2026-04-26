import { ReactNode } from 'react';

export function Section({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
