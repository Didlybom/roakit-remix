// A config read from the server that root.tsx can use to hand off to the browser in a <script>
// See https://remix.run/docs/en/1.19.3/guides/envvars#browser-environment-variables

import defaultConfig from './default-config';
import defaultConfigLocal from './default-config.local';
import productionConfig from './production-config';
import productionConfigLocal from './production-config.local';

export interface ClientEnv {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}

declare global {
  interface Window {
    ROAKIT_ENV: ClientEnv;
  }
}

let clientEnv: ClientEnv;

if (process.env.ROAKIT_ENV === 'production') {
  clientEnv = productionConfig;
} else if (process.env.ROAKIT_ENV === 'production.local') {
  clientEnv = productionConfigLocal;
} else if (process.env.ROAKIT_ENV === 'default.local') {
  clientEnv = defaultConfigLocal;
} else {
  clientEnv = defaultConfig;
}

export default clientEnv;
