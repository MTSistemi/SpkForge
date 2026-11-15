// Fades a section in the first time it scrolls into view. Without
// IntersectionObserver, or with reduced motion, content is simply shown.

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Reveal({ children, as: Tag = 'div', className = '', ...rest }: { children: ReactNode; as?: 'div' | 'section'; className?: string; id?: string; 'aria-labelledby'?: string; tabIndex?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref as never} className={`reveal ${inView ? 'is-in' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
