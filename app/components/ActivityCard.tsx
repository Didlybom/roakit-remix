import {
  PlaylistAddCheckCircle as CustomEventIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import {
  Box,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { LinkItUrl } from 'react-linkify-it';
import ConfluenceIcon from '../icons/Confluence';
import JiraIcon from '../icons/Jira';
import {
  getActivityActionDescription,
  getActivityDescription,
  getActivityUrl,
} from '../processors/activityDescription';
import { confluenceSourceName, gitHubSourceName, jiraSourceName } from '../processors/activityFeed';
import {
  CUSTOM_EVENT,
  type AccountToIdentityRecord,
  type Activity,
  type ActorRecord,
} from '../types/types';
import { jira2md } from '../utils/jira2md';
import { ellipsisSx, linkSx } from '../utils/jsxUtils';
import {
  convertEmojis,
  IMG_TAG_REGEXP_G,
  JIRA_IMAGE2_REGEXP_G,
  JIRA_IMAGE_REGEXP_G,
  LABEL_REGEXP,
  pluralizeMemo,
} from '../utils/stringUtils';
import theme from '../utils/theme';
import LabeledBox from './LabeledBox';
import {
  LinkifyJiraTicket,
  mdLinkifyGitHubAccount,
  mdLinkifyJiraAccount,
  mdLinkifyJiraTicket,
} from './Linkify';
import MarkdownText from './MarkdownText';

// see https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=all
const cleanupJiraMarkup = (content: string) =>
  content
    .replaceAll('|smart-link', '')
    .replace(JIRA_IMAGE_REGEXP_G, '(image)')
    .replace(JIRA_IMAGE2_REGEXP_G, '(image)')
    .replaceAll('(/)', '✅')
    .replaceAll('(flag)', '🚩');

const cleanupMarkup = (content: string) => content.replaceAll(IMG_TAG_REGEXP_G, '(image)');

const SubCard = ({
  content,
  eventType,
  meta,
}: {
  content: ReactNode;
  eventType?: string;
  meta?: { actors: ActorRecord; accountMap: AccountToIdentityRecord; ticketBaseUrl?: string };
}) => {
  let label;
  let contentNode;
  if (typeof content === 'string') {
    let description = content;
    const labelMatch = LABEL_REGEXP.exec(content);
    if (labelMatch) {
      label = labelMatch[1];
      description = content.slice(labelMatch[0].length);
    }
    if (eventType === 'jira') {
      description = cleanupJiraMarkup(description);
    }
    description = cleanupMarkup(description);
    if (eventType === 'jira') {
      description = jira2md(description);
    }
    if (eventType === 'jira' && meta) {
      description = mdLinkifyJiraAccount(description, meta);
    } else if (eventType === 'github' && meta) {
      description = mdLinkifyGitHubAccount(description, meta);
    }
    if (meta?.ticketBaseUrl && description.indexOf('http') === -1) {
      description = mdLinkifyJiraTicket(description, {
        ticketBaseUrl: meta.ticketBaseUrl,
      });
    }
    contentNode = <MarkdownText text={description} />;
  } else {
    contentNode = content;
  }

  return (
    <LabeledBox label={label} sx={{ color: theme.palette.grey[500], wordBreak: 'break-word' }}>
      <LinkItUrl>{contentNode}</LinkItUrl>
    </LabeledBox>
  );
};

export default function ActivityCard({
  format,
  activity,
  tabIndex,
  ticketBaseUrl,
  actors,
  accountMap,
  setPopover,
}: {
  format: 'Grid' | 'Feed';
  activity: Activity;
  tabIndex?: number;
  ticketBaseUrl?: string;
  actors: ActorRecord;
  accountMap: AccountToIdentityRecord;
  setPopover?: (element: HTMLElement, content: JSX.Element) => void;
}) {
  const description = getActivityDescription(activity, { format });
  let comment: ReactNode | string | null =
    activity.metadata?.comment || activity.metadata?.comments ?
      activity.event === 'comment_deleted' ?
        'Deleted comment'
      : 'Commented'
    : null;
  if (format === 'Feed' && comment) {
    if (activity.metadata?.comments?.some(c => c.body)) {
      comment = (
        <Stack spacing={1}>
          {activity.metadata.comments
            .filter(c => c.body)
            .map((comment, i) => (
              <SubCard
                key={i}
                content={`Comment: ${convertEmojis(comment.body)}`}
                eventType={activity.eventType}
                meta={{ actors, accountMap, ticketBaseUrl }}
              />
            ))}
        </Stack>
      );
    } else if (activity.metadata?.comment?.body) {
      comment = (
        <Stack spacing={1}>
          <SubCard
            content={`${
              activity.event === 'comment_deleted' ? 'Comment deleted' : 'Comment '
            }: ${convertEmojis(activity.metadata.comment.body)}`}
            eventType={activity.eventType}
            meta={{ actors, accountMap, ticketBaseUrl }}
          />
        </Stack>
      );
    }
  }
  const url = format === 'Grid' && activity.metadata ? getActivityUrl(activity) : undefined;
  let icon;
  let urlTitle = '';
  if (url) {
    if (url.type === 'jira') {
      icon = <JiraIcon color="primary" sx={{ width: 16, height: 16 }} />;
      urlTitle = jiraSourceName(activity.metadata);
    } else if (url.type === 'confluence') {
      icon = <ConfluenceIcon color="primary" sx={{ width: 15, height: 15 }} />;
      urlTitle = confluenceSourceName(activity.metadata);
    } else if (url.type === 'github') {
      icon = <GitHubIcon color="primary" sx={{ width: 18, height: 18 }} />;
      urlTitle = gitHubSourceName(activity.metadata);
    }
  } else if (activity.event === CUSTOM_EVENT && format === 'Grid') {
    icon = <CustomEventIcon sx={{ width: 20, height: 20, color: theme.palette.grey[400] }} />;
  }
  const link =
    url && icon ?
      <Box display="flex" alignItems="center" ml="-4px">
        <IconButton tabIndex={tabIndex} href={url.url} title={urlTitle} target="_blank">
          {icon}
        </IconButton>
      </Box>
    : null;

  const actionDescription =
    activity.metadata ? getActivityActionDescription(activity, { format }) : undefined;

  const commits = activity.metadata?.commits;

  const missingIconPadding = format === 'Grid' ? '28px' : undefined;

  return (
    <Stack direction="row" width="100%">
      {link}
      {!link && icon && (
        <Box display="flex" alignItems="center" mr="4px" ml="3px">
          {icon}
        </Box>
      )}
      {actionDescription || comment || commits ?
        <Stack mt="2px" pl={icon ? undefined : missingIconPadding} width="100%" minWidth={0}>
          <Box
            title={format === 'Grid' ? description : undefined}
            fontSize={format === 'Grid' ? 'small' : undefined}
            lineHeight={1.2}
            mb={format === 'Feed' ? '2px' : undefined}
            sx={{ wordBreak: 'break-word', ...(format === 'Grid' && ellipsisSx) }}
          >
            {ticketBaseUrl ?
              <LinkifyJiraTicket content={description} baseUrl={ticketBaseUrl} />
            : description}
          </Box>
          {actionDescription && actionDescription[0] && (
            <Typography
              component="div"
              fontSize={format === 'Grid' ? 'smaller' : 'small'}
              color={theme.palette.grey[500]}
              mt={format === 'Feed' ? '4px' : undefined}
              sx={format === 'Grid' ? ellipsisSx : undefined}
            >
              {format === 'Grid' ?
                actionDescription.join(', ')
              : <Stack spacing={1}>
                  {actionDescription.map((action, i) => (
                    <SubCard
                      key={i}
                      content={action}
                      eventType={activity.eventType}
                      meta={{ actors, accountMap, ticketBaseUrl }}
                    />
                  ))}
                </Stack>
              }
            </Typography>
          )}
          {comment && (
            <Typography
              component="div"
              fontSize={format === 'Grid' ? 'smaller' : 'small'}
              color={theme.palette.grey[500]}
              sx={{ wordBreak: 'break-word', ...(format === 'Grid' && ellipsisSx) }}
            >
              {comment}
            </Typography>
          )}
          {commits && commits.length > 1 && (
            <Box>
              <Link
                fontSize={format === 'Grid' ? 'smaller' : 'small'}
                onClick={e =>
                  setPopover?.(
                    e.currentTarget,
                    <List dense={true} disablePadding>
                      {commits?.map((commit, i) => (
                        <ListItem key={i} sx={{ alignItems: 'start' }}>
                          <Link href={commit.url} target="_blank">
                            <ListItemIcon sx={{ mt: '3px', minWidth: '28px' }}>
                              <GitHubIcon fontSize="small" color="primary" />
                            </ListItemIcon>
                          </Link>
                          <ListItemText>{commit.message}</ListItemText>
                        </ListItem>
                      ))}
                    </List>
                  )
                }
                sx={{ lineHeight: 1.5, ...linkSx }}
              >
                {`and ${commits.length - 1} more ${pluralizeMemo('commit', commits.length - 1)}`}
              </Link>
            </Box>
          )}
          {commits && commits.length === 1 && (
            <Typography
              component="div"
              title={actionDescription?.join(', ')}
              fontSize={format === 'Grid' ? 'smaller' : 'small'}
              color={theme.palette.grey[500]}
              sx={ellipsisSx}
            >
              {'Committed'}
            </Typography>
          )}
        </Stack>
      : <Box
          fontSize={format === 'Grid' ? 'small' : undefined}
          title={format === 'Grid' ? description : undefined}
          pl={icon ? undefined : missingIconPadding}
          mb={format === 'Feed' ? '2px' : undefined}
          sx={{ wordBreak: 'break-word', ...(format === 'Grid' && ellipsisSx) }}
        >
          {ticketBaseUrl ?
            <LinkifyJiraTicket content={description} baseUrl={ticketBaseUrl} />
          : description}
        </Box>
      }
    </Stack>
  );
}
