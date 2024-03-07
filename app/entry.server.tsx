import { CacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { EntryContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { ConfirmProvider } from 'material-ui-confirm';
import { renderToString } from 'react-dom/server';
import createEmotionCache from './utils/createEmotionCache';
import theme from './utils/theme';

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const cache = createEmotionCache();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { extractCriticalToChunks } = createEmotionServer(cache);

  function MuiRemixServer() {
    return (
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <ConfirmProvider>
            <CssBaseline />
            <RemixServer context={remixContext} url={request.url} />
          </ConfirmProvider>
        </ThemeProvider>
      </CacheProvider>
    );
  }

  // Render the component to a string.
  const html = renderToString(<MuiRemixServer />);

  // Grab the CSS from emotion
  const { styles } = extractCriticalToChunks(html);

  let stylesHTML = '';

  styles.forEach(({ key, ids, css }) => {
    const emotionKey = `${key} ${ids.join(' ')}`;
    const newStyleTag = `<style data-emotion="${emotionKey}">${css}</style>`;
    stylesHTML = `${stylesHTML}${newStyleTag}`;
  });

  // Add the Emotion style tags after the insertion point meta tag
  const markup = html.replace(
    /<meta(\s)*name="emotion-insertion-point"(\s)*content="emotion-insertion-point"(\s)*\/>/,
    `<meta name="emotion-insertion-point" content="emotion-insertion-point"/>${stylesHTML}`
  );

  responseHeaders.set('Content-Type', 'text/html');

  return new Response(`<!DOCTYPE html>${markup}`, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
