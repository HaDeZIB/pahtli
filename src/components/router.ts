import { useEffect, useState } from 'react';

export type Route = 'capture' | 'preguntas' | 'resultado' | 'historial' | 'tablero' | 'config';

const MAP: Record<string, Route> = {
  '': 'capture', '/': 'capture', '/preguntas': 'preguntas', '/resultado': 'resultado',
  '/historial': 'historial', '/tablero': 'tablero', '/config': 'config',
};
export const PATHS: Record<Route, string> = {
  capture: '#/', preguntas: '#/preguntas', resultado: '#/resultado',
  historial: '#/historial', tablero: '#/tablero', config: '#/config',
};

function parse(): Route {
  const h = window.location.hash.replace(/^#/, '').split('?')[0];
  return MAP[h] ?? 'capture';
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const on = () => { setR(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(r: Route, replace = false): void {
  if (replace) window.location.replace(PATHS[r]);
  else window.location.hash = PATHS[r];
}
