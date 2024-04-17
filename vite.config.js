import { vitePlugin as remix } from '@remix-run/dev';
import { installGlobals } from '@remix-run/node';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

installGlobals();

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    tsconfigPaths(),
    remix({
      appDirectory: 'app',
      assetsBuildDirectory: 'public/build',
      publicPath: '/',
      buildDirectory: 'functions/build/',
      serverBuildFile: 'remix.js',
      serverDependenciesToBundle: 'all',
    }),
  ],
});
