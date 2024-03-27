import { SxProps } from '@mui/material';

export const ellipsisSx: SxProps = { overflow: 'hidden', textOverflow: 'ellipsis' };

export const stickySx: SxProps = {
  textWrap: 'nowrap',
  position: 'sticky',
  top: 60, // depends on header height
  maxHeight: 'calc(100vh - 75px)', // depends on header height
  overflowY: 'auto',
};

export const internalLinkSx: SxProps = {
  cursor: 'pointer',
  textDecoration: 'none',
  borderBottom: 'dotted 1px',
  ...ellipsisSx,
};

export const disabledNotOpaqueSx: SxProps = {
  ['&.Mui-disabled']: { opacity: 'initial' },
};

export const openUserActivity = (event: MouseEvent, userId: string) => {
  event.stopPropagation();
  const url = `/activity/user/${encodeURI(userId)}`;
  window.open(url, event.metaKey || event.ctrlKey ? '_blank' : '_self');
};

export const formatJson = (data: unknown) => JSON.stringify(data, undefined, 2);

export const renderJson = (data: unknown) => <pre>{formatJson(data)}</pre>;
