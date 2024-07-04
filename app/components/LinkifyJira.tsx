import { Link } from '@mui/material';
import { useMemo } from 'react';
import { LinkIt } from 'react-linkify-it';
import { internalLinkSx } from '../utils/jsxUtils';
import { JIRA_TICKET_REGEXP } from '../utils/stringUtils';

export default function LinkifyJira({ content, baseUrl }: { content: string; baseUrl: string }) {
  return useMemo(
    () => (
      <LinkIt
        component={(jira: string, key: number) => (
          <Link key={key} href={baseUrl + jira} target="_blank" sx={internalLinkSx}>
            {jira}
          </Link>
        )}
        regex={JIRA_TICKET_REGEXP}
      >
        {content}
      </LinkIt>
    ),
    [baseUrl, content]
  );
}
