import { Box } from '@mui/material';
import { GridDensity, GridSortDirection } from '@mui/x-data-grid';

export const ellipsisAttrs = { overflow: 'hidden', textOverflow: 'ellipsis' };

export const stickyAttrs = {
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
