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
import ConfluenceIcon from '../../icons/Confluence';
import JiraIcon from '../../icons/Jira';
import { findTicket, getSummary, getSummaryAction, getUrl } from '../../types/activityFeed';
import type { AccountData, Activity } from '../../types/types';
import { formatMonthDayTime, formatRelative } from '../../utils/dateUtils';
import { ellipsisSx } from '../../utils/jsxUtils';
import theme, { priorityColors, prioritySymbols } from '../../utils/theme';

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

export const dateColDef = (colDef?: GridColDef) =>
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

export const actorColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Contributor',
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
    sortComparator: (a: number, b: number) => (b ?? 999) - (a ?? 999),
    renderCell: params => {
      const priority = params.value as number;
      return (
        <Box
          fontSize="large"
          fontWeight="600"
          color={priorityColors[priority] ?? undefined}
          display="flex"
          justifyContent="center"
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
  setPopover?: (element: HTMLElement, content: JSX.Element) => void
) =>
  ({
    headerName: 'Description',
    minWidth: 300,
    flex: 1,
    valueGetter: (_, row: Activity) => findTicket(row.metadata) ?? getSummary(row),
    renderCell: params => {
      const activity = params.row as Activity;
      const summary = getSummary(activity);
      const comment = activity.metadata?.comment?.body;
      const url = activity.metadata ? getUrl(activity) : undefined;
      let icon;
      let urlTitle;
      if (url) {
        if (url.type === 'jira') {
          icon = <JiraIcon width="18px" height="18px" color={theme.palette.primary.main} />;
          urlTitle = 'Go to Jira page';
        } else if (url.type === 'confluence') {
          icon = <ConfluenceIcon width="18px" height="18px" color={theme.palette.primary.main} />;
          urlTitle = 'Go to Confluence page';
        } else if (url.type === 'github') {
          icon = <GitHubIcon color="primary" sx={{ width: '18px', height: '18px' }} />;
          urlTitle = 'Go to Github page';
        }
      }
      const link =
        url && icon ?
          <IconButton href={url.url} title={urlTitle} target="_blank" sx={{ mr: '4px' }}>
            {icon}
          </IconButton>
        : <></>;

      const summaryAction = activity.metadata ? getSummaryAction(activity.metadata) : undefined;

      const commits = activity.metadata?.commits;
      return (
        <Stack direction="row">
          {link}
          {summaryAction || comment || commits ?
            <Stack mt={'3px'} pl={url && icon ? undefined : '40px'} minWidth={0}>
              <Box title={summary} fontSize="small" lineHeight={1.1} sx={{ ...ellipsisSx }}>
                {summary}
              </Box>
              {summaryAction && (
                <Typography
                  component="div"
                  title={summaryAction}
                  fontSize="smaller"
                  color={grey[500]}
                  sx={{ ...ellipsisSx }}
                >
                  {summaryAction.startsWith('http') ?
                    <Box maxWidth={'300px'} sx={ellipsisSx}>
                      <Link href={summaryAction} target="_blank">
                        {summaryAction}
                      </Link>
                    </Box>
                  : summaryAction}
                </Typography>
              )}
              {comment && (
                <Typography
                  title={comment}
                  fontSize="smaller"
                  color={grey[500]}
                  sx={{ ...ellipsisSx }}
                >
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
                <Typography
                  title={summaryAction}
                  fontSize="smaller"
                  color={grey[500]}
                  sx={{ ...ellipsisSx }}
                >
                  {'Committed'}
                </Typography>
              )}
            </Stack>
          : <Box
              fontSize="small"
              title={summary}
              pl={url && icon ? undefined : '40px'}
              sx={{ ...ellipsisSx }}
            >
              {summary}
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
    getActions: params => {
      return [
        <GridActionsCellItem
          key={1}
          icon={<DataObjectIcon />}
          label="View JSON"
          onClick={e => onClick(e.currentTarget, params.row)}
        />,
      ];
    },
    ...colDef,
  }) as GridColDef;
