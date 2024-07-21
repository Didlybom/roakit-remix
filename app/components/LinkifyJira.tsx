import { Link } from '@mui/material';
import { useMemo } from 'react';
import { LinkIt } from 'react-linkify-it';
import type { AccountToIdentityRecord, ActorRecord } from '../types/types';
import { linkSx } from '../utils/jsxUtils';
import { JIRA_ACCOUNT_REGEXP_G, JIRA_TICKET_REGEXP } from '../utils/stringUtils';

export function LinkifyJiraTicket({ content, baseUrl }: { content: string; baseUrl: string }) {
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

export const linkifyJiraAccount = (
  content: string,
  meta: { actors: ActorRecord; accountMap: AccountToIdentityRecord }
) => {
  return content.replace(JIRA_ACCOUNT_REGEXP_G, (match: string, accountId: string) => {
    const identityId = meta.accountMap[accountId];
    if (!identityId) {
      return match;
    }
    return `<a href="/feed/${identityId}">${meta.actors[identityId]?.name || 'Unknown'}</a>`;
  });
};
