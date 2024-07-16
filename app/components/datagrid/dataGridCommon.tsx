import { DataObject as DataObjectIcon } from '@mui/icons-material';
import { Box, Link, Stack, Typography, styled } from '@mui/material';
import type {
  GridColDef,
  GridDensity,
  GridRenderCellParams,
  GridSortCellParams,
  GridSortDirection,
} from '@mui/x-data-grid';
import { GridActionsCellItem, gridStringOrNumberComparator } from '@mui/x-data-grid';
import { getActivityDescription } from '../../activityProcessors/activityDescription';
import { findTicket } from '../../activityProcessors/activityFeed';
import { type Account, type Activity } from '../../types/types';
import { formatMonthDayTime, formatRelative } from '../../utils/dateUtils';
import { ellipsisSx, linkSx } from '../../utils/jsxUtils';
import theme, { priorityColors, prioritySymbols } from '../../utils/theme';
import ActivityCard from '../ActivityCard';
import { AutoRefreshingRelativeDate } from '../AutoRefreshingRelativeData';

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

export const dateColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Date',
    type: 'dateTime',
    valueFormatter: (value: Date) => formatRelative(value),
    renderCell: (params: GridRenderCellParams<any, Date>) =>
      params.value ?
        <Box title={formatMonthDayTime(params.value)} fontSize="small" sx={ellipsisSx}>
          <AutoRefreshingRelativeDate date={params.value} />
        </Box>
      : null,
    ...colDef,
  }) as GridColDef;

export const actorColDef = (colDef?: GridColDef, showActivityLink = false) =>
  ({
    headerName: 'Contributor',
    sortComparator: (a: Account, b: Account) =>
      (a?.name ?? a?.id ?? '').localeCompare(b?.name ?? b?.id ?? ''),
    renderCell: (params: GridRenderCellParams<any, Account>) => {
      const account = params.value;
      if (showActivityLink) {
        return account ?
            <Link
              tabIndex={params.tabIndex}
              href={'/activity/' + encodeURI(account.id)}
              title={account.name}
              sx={linkSx}
            >
              {account.name}
            </Link>
          : null;
      }
      return account ? <Box title={account.name}>{account.name}</Box> : null;
    },
    ...colDef,
  }) as GridColDef;

export const actionColDef = (colDef?: GridColDef) =>
  ({
    headerName: 'Action',
    valueGetter: (value, row: Activity) => `${row.artifact} ${value as string}`,
    renderCell: (params: GridRenderCellParams<Activity, string>) => {
      const action = params.value;
      const activity = params.row;
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
            color={action === 'unknown' ? theme.palette.grey[400] : undefined}
            lineHeight={1}
          >
            {action}
          </Typography>
          <Typography
            fontSize="smaller"
            title={caption}
            variant="caption"
            color={theme.palette.grey[500]}
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
    renderCell: (params: GridRenderCellParams<Activity, number>) =>
      params.value != null ?
        <Box
          fontSize="large"
          fontWeight="600"
          color={priorityColors[params.value] ?? undefined}
          display="flex"
          justifyContent="center"
          sx={{ cursor: colDef?.editable ? 'pointer' : undefined }}
        >
          {prioritySymbols[params.value] ?? ''}
        </Box>
      : null,
    ...colDef,
  }) as GridColDef;

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
    renderCell: (params: GridRenderCellParams<Activity, number>) => (
      <ActivityCard
        format="Grid"
        activity={params.row}
        tabIndex={params.tabIndex}
        ticketBaseUrl={ticketBaseUrl}
        setPopover={setPopover}
      />
    ),
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
