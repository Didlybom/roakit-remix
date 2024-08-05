import { Link } from '@mui/material';
import { useMemo } from 'react';
import { LinkIt } from 'react-linkify-it';
import type { AccountToIdentityRecord, ActorRecord } from '../types/types';
import { linkSx } from '../utils/jsxUtils';
import {
  JIRA_ACCOUNT_REGEXP_G,
  JIRA_FAKE_TICKET_REGEXP,
  JIRA_TICKET_REGEXP,
  JIRA_TICKET_REGEXP_G,
  MENTION_REGEXP_G,
} from '../utils/stringUtils';

export function LinkifyJiraTicket({ content, baseUrl }: { content: string; baseUrl: string }) {
  return useMemo(
    () => (
      <LinkIt
        component={(jira: string, key: number) => (
          <Link
            key={key}
            href={baseUrl + jira.replace(JIRA_FAKE_TICKET_REGEXP, '$1')}
            target="_blank"
            sx={{ ...linkSx, fontWeight: 500 }}
          >
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

export const mdLinkifyJiraTicket = (content: string, meta: { ticketBaseUrl: string }) => {
  return content.replace(JIRA_TICKET_REGEXP_G, (_, ticket: string) => {
    const key = ticket.replace(JIRA_FAKE_TICKET_REGEXP, '$1');
    return `[${ticket}](${meta.ticketBaseUrl}${key})`;
  });
};

export const mdLinkifyJiraAccount = (
  content: string,
  meta: { actors: ActorRecord; accountMap: AccountToIdentityRecord }
) => {
  return content.replace(JIRA_ACCOUNT_REGEXP_G, (match: string, accountId: string) => {
    const identityId = meta.accountMap[accountId];
    if (!identityId) {
      return match;
    }
    return `[${meta.actors[identityId]?.name || 'Unknown'}](/feed/${identityId})`;
  });
};

export const mdLinkifyGitHubAccount = (
  content: string,
  meta: { actors: ActorRecord; accountMap: AccountToIdentityRecord }
) => {
  return content.replace(MENTION_REGEXP_G, (match: string, accountId: string) => {
    const identityId = meta.accountMap[accountId];
    if (!identityId) {
      return match;
    }
    return `[${meta.actors[identityId]?.name || 'Unknown'}](/feed/${identityId})`;
  });
};
