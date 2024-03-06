import {
  DataGrid,
  DataGridProps,
  GridCellModes,
  GridCellModesModel,
  GridCellParams,
} from '@mui/x-data-grid';
import { useCallback, useState } from 'react';

// see https://mui.com/x/react-data-grid/recipes-editing/#single-click-editing
export default function DataGridWithSingleClickEditing(props: DataGridProps) {
  const [cellModesModel, setCellModesModel] = useState<GridCellModesModel>({});

  const handleCellClick = useCallback((params: GridCellParams, event: React.MouseEvent) => {
    if (!params.isEditable) {
      return;
    }

    // Ignore portal
    if (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      (event.target as any).nodeType === 1 &&
      !event.currentTarget.contains(event.target as Element)
    ) {
      return;
    }

    setCellModesModel(prevModel => {
      return {
        // Revert the mode of the other cells from other rows
        ...Object.keys(prevModel).reduce(
          (acc, id) => ({
            ...acc,
            [id]: Object.keys(prevModel[id]).reduce(
              (acc2, field) => ({ ...acc2, [field]: { mode: GridCellModes.View } }),
              {}
            ),
          }),
          {}
        ),
        [params.id]: {
          // Revert the mode of other cells in the same row
          ...Object.keys(prevModel[params.id] || {}).reduce(
            (acc, field) => ({ ...acc, [field]: { mode: GridCellModes.View } }),
            {}
          ),
          [params.field]: { mode: GridCellModes.Edit },
        },
      };
    });
  }, []);

  const handleCellModesModelChange = useCallback((newModel: GridCellModesModel) => {
    setCellModesModel(newModel);
  }, []);

  return (
    <DataGrid
      {...props}
      cellModesModel={cellModesModel}
      onCellModesModelChange={handleCellModesModelChange}
      onCellClick={handleCellClick}
    />
  );
}
