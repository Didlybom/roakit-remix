import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { IconButton, Link, Popover, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { LinkIt } from 'react-linkify-it';
import { formatJson, internalLinkSx } from '../utils/jsxUtils';
import theme from '../utils/theme';

const OBJECTID_REGEXP = /(?<="storageId": ")(.*)(?=")/;

export interface PopoverContent {
  element: HTMLElement;
  content: unknown;
}

export default function CodePopover({
  popover,
  onClose,
}: {
  popover: PopoverContent | null;
  onClose: () => void;
}) {
  const [contentOverride, setContentOverride] = useState<unknown>(null);
  if (!popover?.content) {
    return null;
  }
  const formattedContent = formatJson(contentOverride ?? popover.content);
  return (
    <Popover
      id={popover.element ? 'popover' : undefined}
      open={!!popover?.element}
      anchorEl={popover?.element}
      onClose={() => {
        setContentOverride(null);
        onClose();
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Stack direction="row" sx={{ m: 1, position: 'absolute', top: 2, right: 0 }}>
        <IconButton onClick={() => void navigator.clipboard.writeText(formattedContent)}>
          <ContentCopyIcon />
        </IconButton>
        <IconButton
          onClick={() => {
            setContentOverride(null);
            onClose();
          }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>
      <Typography
        component="pre"
        fontSize="small"
        fontFamily="monospace"
        color={theme.palette.grey[700]}
        sx={{ p: 2, overflowX: 'auto', minWidth: '150px', minHeight: '70px' }}
      >
        <LinkIt
          component={(filePath: string, key: number) => (
            <Link
              key={key}
              sx={internalLinkSx}
              href={'https://storage.cloud.google.com/' + filePath}
              target="_blank"
            >
              {filePath}
            </Link>
          )}
          regex={OBJECTID_REGEXP}
        >
          {formattedContent}
        </LinkIt>
      </Typography>
    </Popover>
  );
}
