import { ReactElement, useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

type Props = {
  children: ReactElement;
  className?: string;
};

export function ChartFrame({ children, className = 'h-[300px]' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dimensoes, setDimensoes] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    let frame = 0;
    const atualizar = () => {
      const { width, height } = elemento.getBoundingClientRect();
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setDimensoes({
          width: Math.max(0, Math.floor(width)),
          height: Math.max(0, Math.floor(height)),
        });
      });
    };

    atualizar();
    const observer = new ResizeObserver(atualizar);
    observer.observe(elemento);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const pronto = dimensoes.width >= 1 && dimensoes.height >= 1;

  return (
    <div ref={ref} className={`w-full min-w-[1px] ${className}`} style={{ minHeight: 1 }}>
      {pronto ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={1}
          minHeight={1}
          initialDimension={{ width: dimensoes.width, height: dimensoes.height }}
        >
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
