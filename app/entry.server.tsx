import { CacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { type EntryContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { ConfirmProvider } from 'material-ui-confirm';
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import createEmotionCache from './utils/createEmotionCache';
import { createReadableStreamFromReadWrite } from './utils/stream.server';
import theme from './utils/theme';

const handleRequest = (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) =>
  isbot(request.headers.get('user-agent')) ?
    handleBotRequest(request, responseStatusCode, responseHeaders, remixContext)
  : handleBrowserRequest(request, responseStatusCode, responseHeaders, remixContext);
export default handleRequest;

const ABORT_DELAY = 5000;

const handleBotRequest = (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) =>
  new Promise((resolve, reject) => {
    let shellRendered = false;
    const emotionCache = createEmotionCache();

    const MuiRemixServer = () => (
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={theme}>
          <ConfirmProvider>
            <CssBaseline />
            <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />
          </ConfirmProvider>
        </ThemeProvider>
      </CacheProvider>
    );

    const { pipe, abort } = renderToPipeableStream(<MuiRemixServer />, {
      onAllReady: () => {
        shellRendered = true;
        const reactBody = new PassThrough();
        const emotionServer = createEmotionServer(emotionCache);
        const bodyWithStyles = emotionServer.renderStylesToNodeStream();
        reactBody.pipe(bodyWithStyles);
        responseHeaders.set('Content-Type', 'text/html');
        resolve(
          new Response(createReadableStreamFromReadWrite(bodyWithStyles), {
            headers: responseHeaders,
            status: responseStatusCode,
          })
        );

        pipe(reactBody);
      },
      onShellError: (error: unknown) => {
        reject(error);
      },
      onError: (error: unknown) => {
        responseStatusCode = 500;
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      },
    });

    setTimeout(abort, ABORT_DELAY);
  });

const handleBrowserRequest = (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) =>
  new Promise((resolve, reject) => {
    let shellRendered = false;
    const emotionCache = createEmotionCache();
    const MuiRemixServer = () => (
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={theme}>
          <ConfirmProvider>
            <CssBaseline />
            <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />
          </ConfirmProvider>
        </ThemeProvider>
      </CacheProvider>
    );

    const { pipe, abort } = renderToPipeableStream(<MuiRemixServer />, {
      onShellReady: () => {
        shellRendered = true;
        const reactBody = new PassThrough();
        const emotionServer = createEmotionServer(emotionCache);
        const bodyWithStyles = emotionServer.renderStylesToNodeStream();
        reactBody.pipe(bodyWithStyles);
        responseHeaders.set('Content-Type', 'text/html');
        resolve(
          new Response(createReadableStreamFromReadWrite(bodyWithStyles), {
            headers: responseHeaders,
            status: responseStatusCode,
          })
        );

        pipe(reactBody);
      },
      onShellError: (error: unknown) => {
        reject(error);
      },
      onError: (error: unknown) => {
        responseStatusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          // eslint-disable-next-line no-console
          console.error(error);
        }
      },
    });

    setTimeout(abort, ABORT_DELAY);
  });
