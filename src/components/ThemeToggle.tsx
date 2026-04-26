import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ escuro, alternar }: { escuro: boolean; alternar: () => void }) {
  return (
    <button className="icon-btn" onClick={alternar} aria-label="Alternar tema" title="Alternar tema">
      {escuro ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
