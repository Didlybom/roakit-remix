import { Link } from '@mui/material';
import { useMemo } from 'react';
import { LinkIt } from 'react-linkify-it';
import { linkSx } from '../utils/jsxUtils';
import { JIRA_TICKET_REGEXP } from '../utils/stringUtils';

export default function LinkifyJira({ content, baseUrl }: { content: string; baseUrl: string }) {
  return useMemo(
    () => (
      <LinkIt
        component={(jira: string, key: number) => (
          <Link key={key} href={baseUrl + jira} target="_blank" sx={{ ...linkSx, fontWeight: 500 }}>
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
