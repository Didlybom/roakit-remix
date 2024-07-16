import { Close as CloseIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { IconButton, Link, Popover, Stack, Typography, type PopoverReference } from '@mui/material';
import { Link as RemixLink } from '@remix-run/react';
import { LinkIt } from 'react-linkify-it';
import type { Activity, Identity } from '../types/types';
import { formatJson, linkSx } from '../utils/jsxUtils';
import theme from '../utils/theme';

const ACTIVITYID_REGEXP = /(?<="activityId": ")(.*)(?=")/;
const IDENTITYID_REGEXP = /(?<="identityId": ")(.*)(?=")/;
const OBJECTID_REGEXP = /(?<="objectId": ")(.*)(?=")/;

export interface CodePopoverContent {
  element: HTMLElement;
  content: unknown;
}

export default function CodePopover({
  popover,
  onClose,
  customerId,
  options,
  anchorReference = 'anchorEl',
}: {
  popover: CodePopoverContent | null;
  onClose: () => void;
  customerId?: number;
  options?: { linkifyActivityId?: boolean; linkifyIdentityId?: boolean };
  anchorReference?: PopoverReference;
}) {
  if (!popover?.content) {
    return null;
  }
  let formattedContent;
  if (options?.linkifyActivityId) {
    const { id, combinedIds, ...content } = popover.content as Activity;
    formattedContent = formatJson({
      ...content,
      activityId: id,
      ...(combinedIds && { combined: combinedIds.map(activityId => ({ activityId })) }),
    });
  } else if (options?.linkifyIdentityId) {
    const { id, ...content } = popover.content as Identity;
    formattedContent = formatJson({ ...content, identityId: id });
  } else {
    formattedContent = formatJson(popover.content);
  }
  return (
    <Popover
      id={popover.element ? 'popover' : undefined}
      open={!!popover?.element}
      onClose={onClose}
      anchorReference={anchorReference}
      anchorEl={anchorReference === 'anchorEl' ? popover?.element : undefined}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      sx={
        anchorReference ?
          { display: 'flex', justifyContent: 'center', alignItems: 'center' }
        : undefined
      }
    >
      <Stack direction="row" sx={{ m: 1, position: 'absolute', top: 2, right: 0 }}>
        <IconButton onClick={() => void navigator.clipboard.writeText(formattedContent)}>
          <CopyIcon />
        </IconButton>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Typography
        component="pre"
        fontSize="11px"
        fontFamily="Roboto Mono, monospace"
        color={theme.palette.grey[700]}
        sx={{
          p: 2,
          whiteSpace: 'pre-wrap',
          minWidth: '150px',
          minHeight: '70px',
        }}
      >
        {options?.linkifyActivityId || options?.linkifyIdentityId ?
          <LinkIt
            component={(firebaseId: string, key: number) => (
              <Link
                key={key}
                sx={linkSx}
                href={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/customers/${customerId}/${options.linkifyActivityId ? 'activities' : 'identities'}/${firebaseId}`}
                target="_blank"
              >
                {firebaseId}
              </Link>
            )}
            regex={options.linkifyActivityId ? ACTIVITYID_REGEXP : IDENTITYID_REGEXP}
          >
            {options?.linkifyActivityId ?
              <LinkIt
                component={(filePath: string, key: number) => (
                  <Link
                    component={RemixLink}
                    key={key}
                    sx={linkSx}
                    to={'/event/view/' + filePath}
                    target="_blank"
                  >
                    {filePath}
                  </Link>
                )}
                regex={OBJECTID_REGEXP}
              >
                {formattedContent}
              </LinkIt>
            : formattedContent}
          </LinkIt>
        : formattedContent}
      </Typography>
    </Popover>
  );
}
