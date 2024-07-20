import {
  Attachment as AttachmentIcon,
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
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { GridActionsCellItem } from '@mui/x-data-grid';
import type { ReactNode } from 'react';
import {
  ACTIVITY_DESCRIPTION_LIST_SEPARATOR,
  getActivityActionDescription,
  getActivityDescription,
  getActivityUrl,
} from '../activityProcessors/activityDescription';
import ConfluenceIcon from '../icons/Confluence';
import JiraIcon from '../icons/Jira';
import { CUSTOM_EVENT, type Activity } from '../types/types';
import { ellipsisSx, linkSx } from '../utils/jsxUtils';
import { pluralizeMemo } from '../utils/stringUtils';
import theme from '../utils/theme';
import LinkifyJira from './LinkifyJira';

const SubCard = ({ text }: { text: string }) => (
  <Paper variant="outlined" square={false} sx={{ p: 1, wordBreak: 'break-word' }}>
    <Box color={theme.palette.grey[500]}>{text}</Box>
  </Paper>
);

export default function ActivityCard({
  format,
  activity,
  tabIndex,
  ticketBaseUrl,
  setPopover,
}: {
  format: 'Grid' | 'Feed';
  activity: Activity;
  tabIndex?: number;
  ticketBaseUrl?: string;
  setPopover?: (element: HTMLElement, content: JSX.Element) => void;
}) {
  const description = getActivityDescription(activity);
  let comment: ReactNode | string | null =
    activity.metadata?.comment || activity.metadata?.comments ? 'Commented' : null;
  if (format === 'Feed' && comment) {
    if (activity.metadata?.comments) {
      comment = (
        <Stack spacing={1}>
          <>Commented</>
          {activity.metadata.comments.map((comment, i) => (
            <SubCard key={i} text={comment.body} />
          ))}
        </Stack>
      );
    } else if (activity.metadata?.comment) {
      comment = (
        <Stack spacing={1}>
          <>Commented</>
          <SubCard text={activity.metadata.comment.body} />
        </Stack>
      );
    }
  }
  const url = activity.metadata ? getActivityUrl(activity) : undefined;
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
  } else if (activity.event === CUSTOM_EVENT) {
    icon = <CustomEventIcon fontSize="small" sx={{ color: theme.palette.grey[400], mr: '2px' }} />;
  }
  const link =
    url && icon ?
      <Box display="flex" alignItems={format === 'Grid' ? 'center' : 'start'} mr="4px">
        {format === 'Grid' && (
          <GridActionsCellItem
            tabIndex={tabIndex}
            icon={icon}
            label={urlTitle}
            // @ts-expect-error weird compile error with href
            href={url.url}
            title={urlTitle}
            target="_blank"
          />
        )}
        {format === 'Feed' && (
          <IconButton size="small" href={url.url} title={urlTitle} target="_blank">
            {icon}
          </IconButton>
        )}
      </Box>
    : null;

  const actionDescription =
    activity.metadata ?
      getActivityActionDescription(activity.metadata, { verbose: true })
    : undefined;

  const commits = activity.metadata?.commits;

  const missingIconPadding = format === 'Grid' ? '22px' : undefined;

  return (
    <Stack direction="row" width="100%">
      {link}
      {!link && (
        <Box display="flex" alignItems={format === 'Grid' ? 'center' : 'start'} ml="4px" mr="7px">
          {icon}
        </Box>
      )}
      {actionDescription || comment || commits ?
        <Stack mt={'2px'} pl={icon ? undefined : missingIconPadding} width="100%" minWidth={0}>
          <Box
            title={description}
            fontSize={format === 'Grid' ? 'small' : undefined}
            lineHeight={1.2}
            mb={format === 'Feed' ? '2px' : undefined}
            sx={format === 'Grid' ? ellipsisSx : undefined}
          >
            {ticketBaseUrl ?
              <LinkifyJira content={description} baseUrl={ticketBaseUrl} />
            : description}
          </Box>
          {actionDescription && actionDescription[0] && (
            <Typography
              component="div"
              fontSize={format === 'Grid' ? 'smaller' : 'small'}
              color={theme.palette.grey[500]}
              mt="4px"
              sx={format === 'Grid' ? ellipsisSx : undefined}
            >
              {actionDescription[0].startsWith('http') ?
                <Stack direction="row" spacing={1} maxWidth={'300px'}>
                  {actionDescription[0].split(ACTIVITY_DESCRIPTION_LIST_SEPARATOR).map((url, i) => (
                    <Link key={i} href={url} target="_blank">
                      <AttachmentIcon sx={{ fontSize: '14px' }} />
                    </Link>
                  ))}
                </Stack>
              : format === 'Grid' ?
                actionDescription.join(', ')
              : <Stack spacing={1}>
                  {actionDescription.map((action, i) => (
                    <SubCard key={i} text={action} />
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
          title={description}
          pl={icon ? undefined : missingIconPadding}
          mb={format === 'Feed' ? '2px' : undefined}
          sx={format === 'Grid' ? ellipsisSx : undefined}
        >
          {ticketBaseUrl ?
            <LinkifyJira content={description} baseUrl={ticketBaseUrl} />
          : description}
        </Box>
      }
    </Stack>
  );
}
