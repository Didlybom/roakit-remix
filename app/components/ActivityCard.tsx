import {
  Attachment as AttachmentIcon,
  PlaylistAddCheckCircle as CustomEventIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import {
  Box,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import type { ReactNode } from 'react';
import {
  getActivityActionDescription,
  getActivityDescription,
  getActivityUrl,
} from '../activityProcessors/activityDescription';
import ConfluenceIcon from '../icons/Confluence';
import JiraIcon from '../icons/Jira';
import {
  CUSTOM_EVENT,
  type AccountToIdentityRecord,
  type Activity,
  type ActorRecord,
} from '../types/types';
import { ellipsisSx, linkSx } from '../utils/jsxUtils';
import {
  convertEmojis,
  IMG_TAG_REGEXP_G,
  JIRA_IMAGE_REGEXP_G,
  pluralizeMemo,
} from '../utils/stringUtils';
import theme from '../utils/theme';
import {
  linkifyGitHubAccount,
  linkifyJiraAccount,
  linkifyJiraTicket,
  LinkifyJiraTicket,
} from './Linkify';
import MarkdownText from './MarkdownText';
const j2m = require('jira2md');

// see https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=all
const cleanupJiraMarkup = (content: string) =>
  content.replaceAll('|smart-link', '').replace(JIRA_IMAGE_REGEXP_G, '(image)');

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
  let linkifiedContent;
  let contentNode;
  if (typeof content === 'string') {
    if (eventType === 'jira' && meta) {
      linkifiedContent = linkifyJiraAccount(content, meta);
    } else if (eventType === 'github' && meta) {
      linkifiedContent = linkifyGitHubAccount(content, meta);
    } else {
      linkifiedContent = content;
    }
    if (meta?.ticketBaseUrl) {
      linkifiedContent = linkifyJiraTicket(linkifiedContent, { ticketBaseUrl: meta.ticketBaseUrl });
    }
    if (eventType === 'jira') {
      linkifiedContent = cleanupJiraMarkup(linkifiedContent);
    }
    linkifiedContent = cleanupMarkup(linkifiedContent);
    contentNode = <MarkdownText text={j2m.to_markdown(linkifiedContent)} />;
  } else {
    contentNode = content;
  }
  return (
    <Paper variant="outlined" square={false} sx={{ p: 1, wordBreak: 'break-word' }}>
      <Box color={theme.palette.grey[500]}>{contentNode}</Box>
    </Paper>
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
  const description = getActivityDescription(activity);
  let comment: ReactNode | string | null =
    activity.metadata?.comment || activity.metadata?.comments ? 'Commented' : null;
  if (format === 'Feed' && comment) {
    if (activity.metadata?.comments?.some(c => c.body)) {
      comment = (
        <Stack spacing={1}>
          <Box>Commented</Box>
          {activity.metadata.comments
            .filter(c => c.body)
            .map((comment, i) => (
              <SubCard
                key={i}
                content={convertEmojis(comment.body)}
                eventType={activity.eventType}
                meta={{ actors, accountMap, ticketBaseUrl }}
              />
            ))}
        </Stack>
      );
    } else if (activity.metadata?.comment?.body) {
      comment = (
        <Stack spacing={1}>
          <Box>Commented</Box>
          <SubCard
            content={convertEmojis(activity.metadata.comment.body)}
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
      icon = (
        <Box mr="2px">
          <JiraIcon fontSize="small" color={theme.palette.primary.main} />
        </Box>
      );
      urlTitle = 'Go to Jira page';
    } else if (url.type === 'confluence') {
      icon = (
        <Box mr="2px">
          <ConfluenceIcon fontSize="small" color={theme.palette.primary.main} />
        </Box>
      );
      urlTitle = 'Go to Confluence page';
    } else if (url.type === 'github') {
      icon = (
        <Box>
          <GitHubIcon fontSize="small" color="primary" />
        </Box>
      );
      urlTitle = 'Go to Github page';
    }
  } else if (activity.event === CUSTOM_EVENT && format === 'Grid') {
    icon = <CustomEventIcon fontSize="small" sx={{ color: theme.palette.grey[400], mr: '2px' }} />;
  }
  const link =
    url && icon ?
      <Box display="flex" alignItems={'center'} mr="4px">
        <GridActionsCellItem
          tabIndex={tabIndex}
          icon={icon}
          label={urlTitle}
          // @ts-expect-error weird compile error with href
          href={url.url}
          title={urlTitle}
          target="_blank"
        />
      </Box>
    : null;

  const actionDescription =
    activity.metadata ? getActivityActionDescription(activity, { format }) : undefined;

  const commits = activity.metadata?.commits;

  const missingIconPadding = format === 'Grid' ? '22px' : undefined;

  return (
    <Stack direction="row" width="100%">
      {link}
      {!link && icon && (
        <Box display="flex" alignItems="center" ml="4px" mr="7px">
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
            sx={format === 'Grid' ? ellipsisSx : undefined}
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
              {typeof actionDescription[0] === 'string' && actionDescription[0].startsWith('http') ?
                <Stack direction="row" spacing={1} maxWidth={'300px'}>
                  {actionDescription.map((url, i) => (
                    <Link key={i} href={url as string} target="_blank">
                      <AttachmentIcon sx={{ fontSize: '14px' }} />
                    </Link>
                  ))}
                </Stack>
              : format === 'Grid' ?
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
              sx={format === 'Grid' ? ellipsisSx : undefined}
            >
              {comment}
            </Typography>
          )}
          {commits && commits.length > 1 && (
            <Box>
              <Link
                fontSize={format === 'Grid' ? 'smaller' : 'small'}
                onClick={e => {
                  setPopover?.(
                    e.currentTarget,
                    <List dense={true} disablePadding>
                      {commits?.map((commit, i) => (
                        <ListItem key={i} sx={{ alignContent: 'top' }}>
                          <Link href={commit.url} target="_blank">
                            <ListItemIcon sx={{ minWidth: '28px' }}>
                              <GitHubIcon fontSize="small" color="primary" />
                            </ListItemIcon>
                          </Link>
                          <ListItemText>{commit.message}</ListItemText>
                        </ListItem>
                      ))}
                    </List>
                  );
                }}
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
          sx={format === 'Grid' ? ellipsisSx : undefined}
        >
          {ticketBaseUrl ?
            <LinkifyJiraTicket content={description} baseUrl={ticketBaseUrl} />
          : description}
        </Box>
      }
    </Stack>
  );
}
