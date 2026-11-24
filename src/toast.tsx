import { useEffect, useState } from 'react';

// App-wide short messages ("Saved", "Budget 80% used", ...).
let show: ((m: string) => void) | null = null;
export const toast = (m: string) => show?.(m);

export function ToastHost() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    show = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(''), 3500);
    };
    return () => {
      show = null;
    };
  }, []);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}
