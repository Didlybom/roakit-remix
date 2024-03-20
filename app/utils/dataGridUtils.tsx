import DataObjectIcon from '@mui/icons-material/DataObject';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  GridActionsCellItem,
  GridColDef,
  GridDensity,
  GridRenderCellParams,
  GridSortDirection,
} from '@mui/x-data-grid';
import JiraIcon from '../icons/Jira';
import { getSummary, getUrl } from '../schemas/activityFeed';
import { ActorData } from '../schemas/schemas';
import { formatMonthDayTime, formatRelative } from './dateUtils';
import { ellipsisSx } from './jsxUtils';
import theme, { priorityColors, priorityLabels } from './theme';

export const dataGridCommonProps = {
  autoHeight: true, // otherwise empty state looks ugly
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

export const dateColdDef = (colDef?: GridColDef) => {
  return {
    headerName: 'Date',
    type: 'dateTime',
    width: 120,
    valueFormatter: (value: Date) => formatRelative(value),
    renderCell: (params: GridRenderCellParams) => (
      <Tooltip title={formatMonthDayTime(params.value as Date)}>
        <Box sx={{ ...ellipsisSx }}>{formatRelative(params.value as Date)}</Box>
      </Tooltip>
    ),
    ...colDef,
  } as GridColDef;
};

export const actorColdDef = (colDef?: GridColDef) => {
  return {
    headerName: 'Author',
    width: 120,
    sortComparator: (a: ActorData, b: ActorData) =>
      (a?.name ?? a?.id ?? '').localeCompare(b?.name ?? b?.id ?? ''),
    renderCell: (params: GridRenderCellParams) => {
      const fields = params.value as ActorData;
      return !fields ? '' : (
          <Box sx={{ ...ellipsisSx }} title={fields.name ?? fields.id}>
            {fields.name}
          </Box>
        );
    },
    ...colDef,
  } as GridColDef;
};

export const priorityColDef = (colDef?: GridColDef) => {
  return {
    headerName: 'Priority',
    width: 80,
    sortComparator: (a: number, b: number) => (b ?? 999) - (a ?? 999),
    renderCell: params => {
      const priority = params.value as number;
      return (
        <Typography
          component="span"
          fontSize="small"
          color={priorityColors[priority] ?? theme.palette.grey[400]}
        >
          {priorityLabels[priority] ?? 'unknown'}
        </Typography>
      );
    },
    ...colDef,
  } as GridColDef;
};

export const summaryColDef = (colDef?: GridColDef) => {
  return {
    headerName: 'Summary',
    minWidth: 300,
    flex: 1,
    renderCell: params => {
      const summary = getSummary(params.value);
      const url = getUrl(params.value);
      const link =
        url ?
          <IconButton
            href={url.url}
            title={url.type === 'jira' ? 'Go to Jira page' : 'Go to GitHub page'}
            target="_blank"
            sx={{ mr: '4px' }}
          >
            {url.type === 'jira' ?
              <JiraIcon fontSize="18px" color={theme.palette.primary.main} />
            : <GitHubIcon fontSize="small" color="primary" />}
          </IconButton>
        : <></>;
      return (
        <Stack direction="row">
          {link}
          <Box title={summary} sx={{ ...ellipsisSx }}>
            {summary}
          </Box>
        </Stack>
      );
    },
    ...colDef,
  } as GridColDef;
};

export const metadataActionsColDef = (
  colDef: Omit<GridColDef, 'field'>,
  onClick: (element: HTMLElement, metadata: unknown) => void
) => {
  return {
    field: 'actions',
    type: 'actions',
    width: 50,
    cellClassName: 'actions',
    getActions: params => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const metadata = params.row.metadata as unknown;
      return [
        <GridActionsCellItem
          key={1}
          icon={<DataObjectIcon />}
          label="View metadata"
          onClick={e => onClick(e.currentTarget, metadata)}
        />,
      ];
    },
    ...colDef,
  } as GridColDef;
};
