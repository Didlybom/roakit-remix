import type { SxProps } from '@mui/material';
import { Alert } from '@mui/material';
import { errMsg } from './errorUtils';

export type SelectOption = { value: string; label?: string; color?: string | null };

export const mobileDisplaySx: SxProps = { display: { xs: 'flex', sm: 'none' } };
export const desktopDisplaySx: SxProps = { display: { xs: 'none', sm: 'flex' } };

export const ellipsisSx: SxProps = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const HEADER_HEIGHT = 51;

export const verticalStickyBarSx: SxProps = {
  textWrap: 'nowrap',
  position: 'sticky',
  top: HEADER_HEIGHT + 9,
  maxHeight: `calc(100vh - ${HEADER_HEIGHT + 24}px)`,
  overflowY: 'auto',
};

export const linkSx: SxProps = {
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
  ...ellipsisSx,
};

export const windowOpen = (event: MouseEvent | React.MouseEvent, url: string) => {
  event.stopPropagation();
  window.open(url, event.metaKey || event.ctrlKey ? '_blank' : '_self');
};

export const formatJson = (data: unknown) => JSON.stringify(data, undefined, 2);

export const renderJson = (data: unknown) => <pre>{formatJson(data)}</pre>;

export const randomNumber = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

export const errorAlert = (message?: string | null) =>
  !!message && (
    <Alert severity="error" sx={{ m: 3 }}>
      {message}
    </Alert>
  );

export const loaderErrorResponse = (e: unknown) =>
  new Response(errMsg(e, 'Failed to load data.'), {
    status: (e as any).httpStatus ?? (e as any).status ?? 500,
  });

export const loginWithRedirectUrl = () =>
  `/login?redirect=${encodeURI(location.pathname + location.search)}`;

export const getSearchParam = (prev: URLSearchParams, param: string, values: string | string[]) => {
  if (Array.isArray(values)) {
    if (values.length) {
      prev.set(param, values.join(','));
    } else {
      prev.delete(param);
    }
  } else {
    if (values) {
      prev.set(param, values);
    } else {
      prev.delete(param);
    }
  }
  return prev;
};
