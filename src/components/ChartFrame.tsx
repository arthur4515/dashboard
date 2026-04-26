import { ReactElement, useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

type Props = {
  children: ReactElement;
  className?: string;
};

export function ChartFrame({ children, className = 'h-[300px]' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const atualizar = () => {
      const { width, height } = elemento.getBoundingClientRect();
      setPronto(width > 0 && height > 0);
    };

    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`w-full min-w-0 ${className}`}>
      {pronto ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
