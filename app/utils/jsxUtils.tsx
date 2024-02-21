import { Link } from '@mui/material';
import { LinkIt } from 'react-linkify-it';
import { JIRA_REGEXP } from './stringUtils';

export const linkifyJira = (
  content: string | JSX.Element | JSX.Element[] | undefined,
  onClick: (jira: string) => void
) => (
  <>
    <LinkIt
      // FIXME if we don't use jira (which might not be ubnique...) for the Link key, it requires 2 clicks!!
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      component={(jira: string, key: number) => (
        <Link key={jira} onClick={() => onClick(jira.split('-')[0])} sx={{ cursor: 'pointer' }}>
          {jira}
        </Link>
      )}
      regex={JIRA_REGEXP}
    >
      {content}
    </LinkIt>
  </>
);
