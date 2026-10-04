import { useEffect, useState } from 'react';

// Navigazione basata sull'hash (es. #/documenti/12): nessuna dipendenza aggiuntiva
// e nessuna configurazione lato server per le pagine del frontend.
const readRoute = () => {
  const [page = '', param = null] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { page, param };
};

export function useHashRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export const navigate = (path) => {
  window.location.hash = `/${path}`;
};
