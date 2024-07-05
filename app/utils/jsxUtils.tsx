import type { SxProps } from '@mui/material';
import { Alert } from '@mui/material';
import { errMsg } from './errorUtils';

export type SelectOption = { value: string; label?: string; color?: string | null };

export const ellipsisSx: SxProps = { overflow: 'hidden', textOverflow: 'ellipsis' };

export const verticalStickyBarSx: SxProps = {
  textWrap: 'nowrap',
  position: 'sticky',
  top: 60, // depends on header height
  maxHeight: 'calc(100vh - 75px)', // depends on header height
  overflowY: 'auto',
};

export const internalLinkSx: SxProps = {
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { borderBottom: 'dotted 1px' },
  ...ellipsisSx,
};

export const windowOpen = (event: MouseEvent, url: string) => {
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
  new Response(`Failed to load data. ${errMsg(e)}`, { status: 500 });

export const loginWithRedirectUrl = () =>
  `/login?redirect=${encodeURI(location.pathname + location.search)}`;
