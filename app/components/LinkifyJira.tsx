import { Link } from '@mui/material';
import { LinkIt } from 'react-linkify-it';
import { internalLinkSx } from '../utils/jsxUtils';
import { JIRA_REGEXP } from '../utils/stringUtils';

export default function LinkifyJira({
  content,
  onClick,
}: {
  content: string | JSX.Element | JSX.Element[] | undefined;
  onClick: (jira: string) => void;
}) {
  return (
    <LinkIt
      component={(jira: string /*, key: number*/) => (
        <Link
          // key={key}
          // using the key causes the first click to be eaten when the grid cell is re-rendered to indicate it's selected and LinkIt generates a new key
          onClick={() => onClick(jira)}
          sx={internalLinkSx}
        >
          {jira}
        </Link>
      )}
      regex={JIRA_REGEXP}
    >
      {content}
    </LinkIt>
  );
}
