import { vitePlugin as remix } from '@remix-run/dev';
import { installGlobals } from '@remix-run/node';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

installGlobals();

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    tsconfigPaths(),
    remix({
      serverModuleFormat: 'cjs',
      appDirectory: 'app',
      assetsBuildDirectory: 'public/build',
      publicPath: '/',
      buildDirectory: 'functions/build/',
      serverBuildFile: 'remix.js',
      future: { unstable_singleFetch: false },
    }),
  ],
  ssr: {
    noExternal: ['@mui/x-charts', '@mui/utils', '@mui/x-charts-vendor'], // see https://github.com/mui/mui-x/issues/11016#issuecomment-2037404367
  },
});
