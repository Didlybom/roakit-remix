// see https://github.com/sergiodxa/remix-utils/blob/main/src/react/use-hydrated.ts

import { useSyncExternalStore } from 'react';

function subscribe() {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  return () => {};
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
