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
  options?: { linkifyObjectId?: boolean; linkifyActivityId?: boolean; linkifyIdentityId?: boolean };
  anchorReference?: PopoverReference;
}) {
  if (options?.linkifyActivityId && options?.linkifyIdentityId) {
    throw Error('linkifyActivityId and linkifyIdentityId are mutually exclusive.');
  }
  if (!popover?.content) {
    return null;
  }
  let formattedContent;
  if (options?.linkifyActivityId) {
    const { id, combinedIds, hovered, ...content } = popover.content as Activity & {
      hovered: boolean;
    };
    formattedContent = formatJson({
      ...content,
      activityId: id,
      ...(combinedIds && { combined: combinedIds.map(activityId => ({ activityId })) }),
    });
  } else if (options?.linkifyIdentityId) {
    const { id, hovered, ...content } = popover.content as Identity & { hovered: boolean };
    formattedContent = formatJson({ ...content, identityId: id });
  } else {
    formattedContent = formatJson(popover.content);
  }

  const formattedContentWithObjectIdLink =
    options?.linkifyObjectId ?
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
    : formattedContent;

  let formattedContentWithLinks;
  if (options?.linkifyActivityId) {
    formattedContentWithLinks = (
      <LinkIt
        component={(firebaseId: string, key: number) => (
          <Link
            key={key}
            sx={linkSx}
            href={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/customers/${customerId}/activities/${firebaseId}`}
            target="_blank"
          >
            {firebaseId}
          </Link>
        )}
        regex={ACTIVITYID_REGEXP}
      >
        {formattedContentWithObjectIdLink}
      </LinkIt>
    );
  } else if (options?.linkifyIdentityId) {
    formattedContentWithLinks = (
      <LinkIt
        component={(firebaseId: string, key: number) => (
          <Link
            key={key}
            sx={linkSx}
            href={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/customers/${customerId}/identities/${firebaseId}`}
            target="_blank"
          >
            {firebaseId}
          </Link>
        )}
        regex={IDENTITYID_REGEXP}
      >
        {formattedContentWithObjectIdLink}
      </LinkIt>
    );
  } else {
    formattedContentWithLinks = formattedContentWithObjectIdLink;
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
      <Stack direction="row" mr={1} mt={1} mb={-3} display="flex" justifyContent="end">
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
        {formattedContentWithLinks}
      </Typography>
    </Popover>
  );
}
