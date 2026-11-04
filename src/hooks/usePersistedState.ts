import { useEffect, useRef, useState } from "react";

export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // ignore
    }
    return initial;
  });

  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [state, key]);

  return [state, setState];
}
