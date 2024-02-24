import { Link } from '@mui/material';
import { LinkIt } from 'react-linkify-it';
import { JIRA_REGEXP } from './stringUtils';

export default function LinkifyJira({
  content,
  onClick,
}: {
  content: string | JSX.Element | JSX.Element[] | undefined;
  onClick: (jira: string) => void;
}) {
  return (
    <LinkIt
      component={(jira: string, key: number) => {
        return (
          <Link
            key={key}
            onClick={() => onClick(jira)}
            sx={{
              cursor: 'pointer',
              textDecoration: 'none',
              borderBottom: 'dotted 1px',
            }}
          >
            {jira}
          </Link>
        );
      }}
      regex={JIRA_REGEXP}
    >
      {content}
    </LinkIt>
  );
}
