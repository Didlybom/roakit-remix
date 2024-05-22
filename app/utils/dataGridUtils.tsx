import DataObjectIcon from '@mui/icons-material/DataObject';
import GitHubIcon from '@mui/icons-material/GitHub';
import {
  Box,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import {
  GridActionsCellItem,
  GridColDef,
  GridDensity,
  GridRenderCellParams,
  GridSortDirection,
} from '@mui/x-data-grid';
import memoize from 'fast-memoize';
import pluralize from 'pluralize';
import JiraIcon from '../icons/Jira';
import { findTicket, getSummary, getSummaryAction, getUrl } from '../types/activityFeed';
import type { AccountData, ActivityData } from '../types/types';
import { formatMonthDayTime, formatRelative } from './dateUtils';
import { ellipsisSx } from './jsxUtils';
import theme, { priorityColors, priorityLabels } from './theme';

export const dataGridCommonProps = {
  autosizeOnMount: true,
  autoHeight: true, // otherwise empty state looks ugly
  sx: { fontSize: 'small' },
  slots: {
    noRowsOverlay: () => (
      <Box height="100px" display="flex" alignItems="center" justifyContent="center">
        Nothing to show for these dates
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
    sorting: { sortModel: [{ field: 'date', sort: 'desc' as GridSortDirection }] },
  },
};

export const dateColdDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Date',
    type: 'dateTime',
    valueFormatter: (value: Date) => formatRelative(value),
    renderCell: (params: GridRenderCellParams) => (
      <Tooltip title={formatMonthDayTime(params.value as Date)}>
        <Box fontSize="small" sx={{ ...ellipsisSx }}>
          {formatRelative(params.value as Date)}
        </Box>
      </Tooltip>
    ),
    ...colDef,
  }) as GridColDef;

export const actorColdDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Author',
    sortComparator: (a: AccountData, b: AccountData) =>
      (a?.name ?? a?.id ?? '').localeCompare(b?.name ?? b?.id ?? ''),
    renderCell: (params: GridRenderCellParams) => {
      const fields = params.value as AccountData;
      return !fields ? '' : (
          <Box sx={{ ...ellipsisSx }} title={fields.name ?? fields.id}>
            {fields.name}
          </Box>
        );
    },
    ...colDef,
  }) as GridColDef;

export const actionColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Action',
    valueGetter: (value, row: ActivityData) => `${row.artifact} ${value as string}`,
    renderCell: (params: GridRenderCellParams) => {
      const action = params.value as string;
      const activity = params.row as ActivityData;
      const event = activity.event;
      const codeAction = activity.metadata?.codeAction;
      return !event ? action : (
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
              title={`${event} ${codeAction ?? ''}`}
              variant="caption"
              sx={ellipsisSx}
            >
              {event} {codeAction}
            </Typography>
          </Stack>
        );
    },
    ...colDef,
  }) as GridColDef;

export const priorityColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Priority',
    sortComparator: (a: number, b: number) => (b ?? 999) - (a ?? 999),
    renderCell: params => {
      const priority = params.value as number;
      return (
        <Box fontSize="small" color={priorityColors[priority] ?? grey[400]}>
          {priorityLabels[priority] ?? 'unknown'}
        </Box>
      );
    },
    ...colDef,
  }) as GridColDef;

const pluralizeMemo = memoize(pluralize);

export const summaryColDef = (
  colDef?: GridColDef,
  setPopover?: (element: HTMLElement, content: JSX.Element) => void
) =>
  ({
    headerName: 'Summary',
    minWidth: 300,
    flex: 1,
    valueGetter: (_, row: ActivityData) => findTicket(row.metadata) ?? getSummary(row),
    renderCell: params => {
      const activity = params.row as ActivityData;
      const summary = getSummary(activity);
      const comment = activity.metadata?.comment?.body;
      const url = activity.metadata ? getUrl(activity.metadata) : undefined;
      const link =
        url ?
          <IconButton
            href={url.url}
            title={url.type === 'jira' ? 'Go to Jira page' : 'Go to GitHub page'}
            target="_blank"
            sx={{ mr: '4px' }}
          >
            {url.type === 'jira' ?
              <JiraIcon fontSize="small" color={theme.palette.primary.main} />
            : <GitHubIcon fontSize="small" color="primary" />}
          </IconButton>
        : <></>;

      const summaryAction = activity.metadata ? getSummaryAction(activity.metadata) : undefined;

      const commits = activity.metadata?.commits;
      return (
        <Stack direction="row">
          {link}
          {summaryAction || comment || commits ?
            <Stack mt={'3px'} minWidth={0}>
              <Box title={summary} fontSize="small" lineHeight={1.1} sx={{ ...ellipsisSx }}>
                {summary}
              </Box>
              {summaryAction && (
                <Typography title={summaryAction} fontSize="smaller" sx={{ ...ellipsisSx }}>
                  {summaryAction}
                </Typography>
              )}
              {comment && (
                <Typography title={comment} fontSize="smaller" sx={{ ...ellipsisSx }}>
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
                            <ListItemButton component="a" href={commit.url} target="_blank">
                              <ListItemIcon sx={{ minWidth: '28px' }}>
                                <GitHubIcon fontSize="small" color="primary" />
                              </ListItemIcon>
                              <ListItemText>{commit.message}</ListItemText>
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    );
                  }}
                  sx={{ lineHeight: 1.5, cursor: 'pointer' }}
                >
                  {`and ${commits.length - 1} more ${pluralizeMemo('commit', commits.length - 1)}`}
                </Link>
              )}
              {commits && commits.length === 1 && (
                <Typography title={summaryAction} fontSize="smaller" sx={{ ...ellipsisSx }}>
                  {'Committed'}
                </Typography>
              )}
            </Stack>
          : <Box fontSize="small" title={summary} sx={{ ...ellipsisSx }}>
              {summary}
            </Box>
          }
        </Stack>
      );
    },
    ...colDef,
  }) as GridColDef;

export const metadataActionsColDef = (
  colDef: Omit<GridColDef, 'field'>,
  onClick: (element: HTMLElement, data: unknown) => void
) =>
  ({
    field: 'actions',
    type: 'actions',
    cellClassName: 'actions',
    getActions: params => {
      return [
        <GridActionsCellItem
          key={1}
          icon={<DataObjectIcon />}
          label="View metadata"
          onClick={e => onClick(e.currentTarget, params.row)}
        />,
      ];
    },
    ...colDef,
  }) as GridColDef;
