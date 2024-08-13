import { Close as CloseIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { IconButton, Link, Popover, Stack, Typography, type PopoverReference } from '@mui/material';
import { Link as RemixLink } from '@remix-run/react';
import type { ReactNode } from 'react';
import { LinkIt } from 'react-linkify-it';
import type { Activity, Identity, Ticket } from '../types/types';
import { formatJson, linkSx } from '../utils/jsxUtils';
import theme from '../utils/theme';

const ACTIVITYID_REGEXP = /(?<="activityId": ")(.*)(?=")/;
const IDENTITYID_REGEXP = /(?<="identityId": ")(.*)(?=")/;
const TICKETKEY_REGEXP = /(?<="ticketKey": ")(.*)(?=")/;
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
  options?: {
    linkifyObjectId?: boolean;
    linkifyActivityId?: boolean;
    linkifyIdentityId?: boolean;
    linkifyTicketKey?: boolean;
  };
  anchorReference?: PopoverReference;
}) {
  if (
    +(options?.linkifyActivityId ?? false) +
      +(options?.linkifyIdentityId ?? false) +
      +(options?.linkifyTicketKey ?? false) >
    1
  ) {
    throw Error('linkify options are mutually exclusive.');
  }
  if (!popover?.content) {
    return null;
  }
  let formattedContent;
  if (options?.linkifyActivityId) {
    const { id, hovered, ...content } = popover.content as Activity & {
      hovered: boolean;
    };
    formattedContent = formatJson({ ...content, activityId: id });
  } else if (options?.linkifyIdentityId) {
    const { id, hovered, ...content } = popover.content as Identity & { hovered: boolean };
    formattedContent = formatJson({ ...content, identityId: id });
  } else if (options?.linkifyTicketKey) {
    const { key, hovered, ...content } = popover.content as Ticket & { hovered: boolean };
    formattedContent = formatJson({ ...content, ticketKey: key });
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

  function LinkifyId({
    url,
    regex,
    children,
  }: {
    url: string;
    regex: RegExp;
    children: ReactNode;
  }) {
    return (
      <LinkIt
        component={(firebaseId: string, key: number) => (
          <Link key={key} sx={linkSx} href={`${url}/${firebaseId}`} target="_blank">
            {firebaseId}
          </Link>
        )}
        regex={regex}
      >
        {children}
      </LinkIt>
    );
  }

  let formattedContentWithLinks;
  if (options?.linkifyActivityId) {
    formattedContentWithLinks = (
      <LinkifyId
        url={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/customers/${customerId}/activities/`}
        regex={ACTIVITYID_REGEXP}
      >
        {formattedContentWithObjectIdLink}
      </LinkifyId>
    );
  } else if (options?.linkifyIdentityId) {
    formattedContentWithLinks = (
      <LinkifyId
        url={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/customers/${customerId}/identities/`}
        regex={IDENTITYID_REGEXP}
      >
        {formattedContentWithObjectIdLink}
      </LinkifyId>
    );
  } else if (options?.linkifyTicketKey) {
    formattedContentWithLinks = (
      <LinkifyId
        url={`https://console.cloud.google.com/firestore/databases/-default-/data/panel/customers/${customerId}/tickets/`}
        regex={TICKETKEY_REGEXP}
      >
        {formattedContentWithObjectIdLink}
      </LinkifyId>
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
