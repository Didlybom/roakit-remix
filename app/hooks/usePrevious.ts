import { useRef } from 'react';

export const usePrevious = <T>(value: T, isEqual?: (a: T, b: T) => boolean) => {
  const ref = useRef<{ current: T; previous: T | null }>({ current: value, previous: null });
  const current = ref.current.current;
  if (!isEqual?.(value, current) ?? value !== current) {
    ref.current = { current: value, previous: current };
  }
  return ref.current.previous;
};
