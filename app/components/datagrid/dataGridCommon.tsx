import {
  Attachment as AttachmentIcon,
  PlaylistAddCheckCircle as CustomEventIcon,
  DataObject as DataObjectIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import {
  Box,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  styled,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import type {
  GridColDef,
  GridDensity,
  GridRenderCellParams,
  GridSortCellParams,
  GridSortDirection,
} from '@mui/x-data-grid';
import { GridActionsCellItem, gridStringOrNumberComparator } from '@mui/x-data-grid';
import memoize from 'fast-memoize';
import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import ConfluenceIcon from '../../icons/Confluence';
import JiraIcon from '../../icons/Jira';
import { CUSTOM_EVENT, type Account, type Activity } from '../../types/types';
import {
  ACTIVITY_DESCRIPTION_LIST_SEPARATOR,
  getActivityActionDescription,
  getActivityDescription,
  getActivityUrl,
} from '../../utils/activityDescription';
import { findTicket } from '../../utils/activityFeed';
import { formatMonthDayTime, formatRelative } from '../../utils/dateUtils';
import { ellipsisSx, linkSx } from '../../utils/jsxUtils';
import theme, { priorityColors, prioritySymbols } from '../../utils/theme';
import LinkifyJira from '../LinkifyJira';

export const dataGridCommonProps = {
  autosizeOnMount: true,
  autoHeight: true, // otherwise empty state looks ugly
  sx: { fontSize: 'small' },
  slots: {
    noRowsOverlay: () => (
      <Box height="75px" display="flex" alignItems="center" justifyContent="center">
        Nothing to show
      </Box>
    ),
  },
  rowHeight: 75,
  density: 'compact' as GridDensity,
  disableRowSelectionOnClick: true,
  disableColumnMenu: true,
  pageSizeOptions: [25, 50, 100],
  sortingOrder: ['asc', 'desc'] as GridSortDirection[],
  initialState: {
    pagination: { paginationModel: { pageSize: 25 } },
    sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' as GridSortDirection }] },
  },
};

export const sortComparatorKeepingNullAtTheBottom = (sortDirection: GridSortDirection) => {
  const modifier = sortDirection === 'desc' ? -1 : 1;
  return (
    a: string | number,
    b: string | number,
    aCellParams: GridSortCellParams,
    bCellParams: GridSortCellParams
  ) => {
    if (a == null) {
      return 1;
    }
    if (b == null) {
      return -1;
    }
    return modifier * gridStringOrNumberComparator(a, b, aCellParams, bCellParams);
  };
};

function AutoRefreshingRelativeDate({ date }: { date: Date }) {
  const [, setTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  return formatRelative(date);
}

export const dateColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Date',
    type: 'dateTime',
    valueFormatter: (value: Date) => formatRelative(value),
    renderCell: (params: GridRenderCellParams) => (
      <Box title={formatMonthDayTime(params.value as Date)} fontSize="small" sx={ellipsisSx}>
        <AutoRefreshingRelativeDate date={params.value as Date} />
      </Box>
    ),
    ...colDef,
  }) as GridColDef;

export const actorColDef = (colDef?: GridColDef, showActivityLink = false) =>
  ({
    headerName: 'Contributor',
    sortComparator: (a: Account, b: Account) =>
      (a?.name ?? a?.id ?? '').localeCompare(b?.name ?? b?.id ?? ''),
    renderCell: (params: GridRenderCellParams) => {
      const account = params.value as Account;
      if (showActivityLink) {
        return !account ? '' : (
            <Link
              tabIndex={params.tabIndex}
              href={'/activity/' + encodeURI(account.id)}
              title={account.name}
              sx={linkSx}
            >
              {account.name}
            </Link>
          );
      }
      return <Box title={account.name}>{account.name}</Box>;
    },
    ...colDef,
  }) as GridColDef;

export const actionColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Action',
    valueGetter: (value, row: Activity) => `${row.artifact} ${value as string}`,
    renderCell: (params: GridRenderCellParams) => {
      const action = params.value as string;
      const activity = params.row as Activity;
      const event = activity.event;
      const codeAction = activity.metadata?.codeAction;
      if (!event) {
        return action;
      }
      const caption = `${event} ${
        codeAction ?
          Array.isArray(codeAction) ?
            codeAction.join(', ')
          : codeAction
        : ''
      }`;
      return (
        <Stack mt="3px">
          <Typography
            fontSize="small"
            color={action === 'unknown' ? grey[400] : undefined}
            lineHeight={1}
          >
            {action}
          </Typography>
          <Typography
            fontSize="smaller"
            title={caption}
            variant="caption"
            color={grey[500]}
            sx={ellipsisSx}
          >
            {caption}
          </Typography>
        </Stack>
      );
    },
    ...colDef,
  }) as GridColDef;

export const priorityColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Prio.',
    getSortComparator: sortDirection => {
      // keep not prioritized at the bottom
      return (a: number, b: number) => {
        if (sortDirection === 'asc') {
          return (b ?? -1) - (a ?? -1);
        }
        return (a === -1 || a == null ? 9999 : a) - (b === -1 || b == null ? 9999 : b);
      };
    },
    renderCell: params => {
      const priority = params.value as number;
      return (
        <Box
          fontSize="large"
          fontWeight="600"
          color={priorityColors[priority] ?? undefined}
          display="flex"
          justifyContent="center"
          sx={{ cursor: colDef?.editable ? 'pointer' : undefined }}
        >
          {prioritySymbols[priority] ?? ''}
        </Box>
      );
    },
    ...colDef,
  }) as GridColDef;

const pluralizeMemo = memoize(pluralize);

export const descriptionColDef = (
  colDef?: GridColDef,
  setPopover?: (element: HTMLElement, content: JSX.Element) => void,
  ticketBaseUrl?: string
) =>
  ({
    headerName: 'Description',
    minWidth: 300,
    flex: 1,
    valueGetter: (_, row: Activity) => findTicket(row.metadata) ?? getActivityDescription(row),
    renderCell: params => {
      const activity = params.row as Activity;
      const description = getActivityDescription(activity);
      const comment =
        activity.metadata?.comment || activity.metadata?.comments ? 'Commented' : null;
      const url = activity.metadata ? getActivityUrl(activity) : undefined;
      let icon;
      let urlTitle = '';
      if (url) {
        if (url.type === 'jira') {
          icon = (
            <Box mr="2px">
              <JiraIcon color={theme.palette.primary.main} />
            </Box>
          );
          urlTitle = 'Go to Jira page';
        } else if (url.type === 'confluence') {
          icon = (
            <Box mr="2px">
              <ConfluenceIcon color={theme.palette.primary.main} />{' '}
            </Box>
          );
          urlTitle = 'Go to Confluence page';
        } else if (url.type === 'github') {
          icon = <GitHubIcon color="primary" />;
          urlTitle = 'Go to Github page';
        }
      } else if (activity.event === CUSTOM_EVENT) {
        icon = <CustomEventIcon fontSize="small" sx={{ color: grey[400], mr: '2px' }} />;
      }
      const link =
        url && icon ?
          <Box display="flex" alignItems="center" mr="4px">
            <GridActionsCellItem
              tabIndex={params.tabIndex}
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
        activity.metadata ? getActivityActionDescription(activity.metadata) : undefined;

      const commits = activity.metadata?.commits;

      return (
        <Stack direction="row" useFlexGap>
          {link}
          {!link && (
            <Box display="flex" alignItems="center" ml="4px" mr="7px">
              {icon}
            </Box>
          )}
          {actionDescription || comment || commits ?
            <Stack mt={'2px'} pl={icon ? undefined : '22px'} minWidth={0}>
              <Box title={description} fontSize="small" lineHeight={1.2} sx={ellipsisSx}>
                {ticketBaseUrl ?
                  <LinkifyJira content={description} baseUrl={ticketBaseUrl} />
                : description}
              </Box>
              {actionDescription && (
                <Typography
                  component="div"
                  title={actionDescription.startsWith('http') ? undefined : actionDescription}
                  fontSize="smaller"
                  color={grey[500]}
                  sx={ellipsisSx}
                >
                  {actionDescription.startsWith('http') ?
                    <Stack direction="row" spacing={1} maxWidth={'300px'}>
                      {actionDescription
                        .split(ACTIVITY_DESCRIPTION_LIST_SEPARATOR)
                        .map((url, i) => (
                          <Link key={i} href={url} target="_blank">
                            <AttachmentIcon sx={{ fontSize: '14px' }} />
                          </Link>
                        ))}
                    </Stack>
                  : actionDescription}
                </Typography>
              )}
              {comment && (
                <Typography fontSize="smaller" color={grey[500]} sx={ellipsisSx}>
                  {comment}
                </Typography>
              )}
              {commits && commits.length > 1 && (
                <Link
                  fontSize="smaller"
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
              )}
              {commits && commits.length === 1 && (
                <Typography
                  title={actionDescription}
                  fontSize="smaller"
                  color={grey[500]}
                  sx={ellipsisSx}
                >
                  {'Committed'}
                </Typography>
              )}
            </Stack>
          : <Box
              fontSize="small"
              title={description}
              pl={icon ? undefined : '35px'}
              sx={ellipsisSx}
            >
              {ticketBaseUrl ?
                <LinkifyJira content={description} baseUrl={ticketBaseUrl} />
              : description}
            </Box>
          }
        </Stack>
      );
    },
    ...colDef,
  }) as GridColDef;

export const viewJsonActionsColDef = (
  colDef: Omit<GridColDef, 'field'>,
  onClick: (element: HTMLElement, data: unknown) => void
) =>
  ({
    field: 'actions',
    type: 'actions',
    cellClassName: 'actions',
    getActions: params => [
      <GridActionsCellItem
        key={1}
        icon={<DataObjectIcon />}
        label="View JSON"
        onClick={e => onClick(e.currentTarget, params.row)}
      />,
    ],
    ...colDef,
  }) as GridColDef;

export const StyledMuiError = styled('div')(({ theme }) => ({
  '& .Mui-error': { backgroundColor: '#ffecf0', color: theme.palette.error.main },
}));
