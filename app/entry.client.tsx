import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { RemixBrowser } from '@remix-run/react';
import { ConfirmProvider } from 'material-ui-confirm';
import type { ReactNode} from 'react';
import { startTransition, useMemo, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import ClientStyleContext from './components/ClientStyleContext';
import theme from './utils/theme';

interface ClientCacheProviderProps {
  children: ReactNode;
}
function ClientCacheProvider({ children }: ClientCacheProviderProps) {
  const [cache, setCache] = useState(createCache({ key: 'css' }));

  const clientStyleContextValue = useMemo(
    () => ({
      reset() {
        setCache(createCache({ key: 'css' }));
      },
    }),
    []
  );

  return (
    <ClientStyleContext.Provider value={clientStyleContextValue}>
      <CacheProvider value={cache}>{children}</CacheProvider>
    </ClientStyleContext.Provider>
  );
}

const hydrate = () => {
  startTransition(() => {
    hydrateRoot(
      document,
      <ClientCacheProvider>
        <ThemeProvider theme={theme}>
          <ConfirmProvider>
            <CssBaseline />
            <RemixBrowser />
          </ConfirmProvider>
        </ThemeProvider>
      </ClientCacheProvider>
    );
  });
};

if (window.requestIdleCallback) {
  window.requestIdleCallback(hydrate);
} else {
  // Safari doesn't support requestIdleCallback
  // https://caniuse.com/requestidlecallback
  window.setTimeout(hydrate, 1);
}
