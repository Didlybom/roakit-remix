import { Box, SxProps, Tooltip } from '@mui/material';
import {
  GridColDef,
  GridDensity,
  GridRenderCellParams,
  GridSortDirection,
  GridValueFormatterParams,
} from '@mui/x-data-grid';
import { ActorData } from '../schemas/schemas';
import { formatMonthDayTime, formatRelative } from './dateUtils';

export const ellipsisSx: SxProps = { overflow: 'hidden', textOverflow: 'ellipsis' };

export const stickySx: SxProps = {
  textWrap: 'nowrap',
  position: 'sticky',
  top: 60, // depends on header height
  maxHeight: '100vh',
  overflowY: 'auto',
};

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
  initialState: {
    pagination: { paginationModel: { pageSize: 25 } },
    sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' as GridSortDirection }] },
  },
};

export const dateColdDef = (colDef?: Omit<GridColDef, 'field'>) => {
  return {
    field: 'date',
    headerName: 'Date',
    type: 'dateTime',
    width: 120,
    valueFormatter: (params: GridValueFormatterParams) => formatRelative(params.value as Date),
    renderCell: (params: GridRenderCellParams) => (
      <Tooltip title={formatMonthDayTime(params.value as Date)}>
        <Box sx={{ ...ellipsisSx }}>{formatRelative(params.value as Date)}</Box>
      </Tooltip>
    ),
    ...colDef,
  };
};

export const actorColdDef = (colDef?: Omit<GridColDef, 'field'>) => {
  return {
    field: 'actor',
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
  };
};

export const disabledNotOpaqueSx: SxProps = {
  ['&.Mui-disabled']: { opacity: 'initial' },
};

export const renderJson = (data: unknown) => <pre>{JSON.stringify(data, undefined, 2)}</pre>;
