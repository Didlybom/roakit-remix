import { withEmotionCache } from '@emotion/react';
import {
  Alert,
  Box,
  Typography,
  unstable_useEnhancedEffect as useEnhancedEffect,
} from '@mui/material';
import {
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from '@remix-run/react';
import { ReactNode, useContext } from 'react';
import clientConfig, { ClientEnv } from './client-env/client-env.server';
import ClientStyleContext from './components/ClientStyleContext';
import Layout from './components/Layout';
import { errMsg } from './utils/errorUtils';
import theme from './utils/theme';

interface DocumentProps {
  children: ReactNode;
  title?: string;
}

// Set up client config
export function loader(): ClientEnv {
  return clientConfig;
}

const Document = withEmotionCache(({ children, title }: DocumentProps, emotionCache) => {
  const clientStyleData = useContext(ClientStyleContext);

  // Only executed on client
  useEnhancedEffect(() => {
    // re-link sheet container
    emotionCache.sheet.container = document.head;
    // re-inject tags
    const tags = emotionCache.sheet.tags;
    emotionCache.sheet.flush();
    tags.forEach(tag => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (emotionCache.sheet as any)._insertTag(tag);
    });
    // reset cache to reapply global styles
    clientStyleData.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content={theme.palette.primary.main} />
        {!!title && <title>{title}</title>}
        <Meta />
        <Links />
        <link rel="icon" href="data:;base64,=" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@300;400;500;600;700&display=swap"
        />
        <meta name="emotion-insertion-point" content="emotion-insertion-point" />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
});

// https://remix.run/docs/en/main/route/component
// https://remix.run/docs/en/main/file-conventions/routes
export default function App() {
  const clientEnv = useLoaderData<typeof loader>();
  return (
    <Document>
      <script
        // see https://remix.run/docs/en/1.19.3/guides/envvars#browser-environment-variables
        dangerouslySetInnerHTML={{
          __html: `window.ROAKIT_ENV = ${JSON.stringify(clientEnv)}`,
        }}
      />
      <Layout>
        <Outlet />
      </Layout>
    </Document>
  );
}

// https://remix.run/docs/en/main/route/error-boundary
export function ErrorBoundary() {
  let message;

  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 401:
        message = `Oops! Looks like you tried to visit a page that you do not have access to. [${error.status}: ${error.statusText}]`;
        break;
      case 404:
        message = `Oops! Looks like you tried to visit a page that does not exist. [${error.status}: ${error.statusText}]`;
        break;
      default:
        throw new Error((error.data as string) || error.statusText);
    }
  } else {
    message = errMsg(error, 'Unknown error');
  }
  return (
    <Document title="ROAKIT Error">
      <Layout>
        <Box sx={{ m: 4 }}>
          <Typography variant="h5">An error occured!</Typography>
          <Typography sx={{ mt: 2 }}>
            You can try to <Link to="/logout">logout</Link> and login again.
          </Typography>
          <Alert severity="error" sx={{ mt: 4 }}>
            {message}
          </Alert>
        </Box>
      </Layout>
    </Document>
  );
}
