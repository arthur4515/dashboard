export function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="card h-32 animate-pulse bg-gradient-to-r from-slate-100 to-white dark:from-slate-800 dark:to-slate-900" />
      ))}
    </div>
  );
}
