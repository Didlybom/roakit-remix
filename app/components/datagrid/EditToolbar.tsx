import { Add as AddIcon } from '@mui/icons-material';
import { Button } from '@mui/material';
import {
  GridRowModes,
  GridToolbarContainer,
  type GridRowModesModel,
  type GridRowsProp,
} from '@mui/x-data-grid';
import { v4 as uuidv4 } from 'uuid';

interface EditToolbarProps {
  labels: { add: string };
  setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void;
  setRowModesModel: (newModel: (oldModel: GridRowModesModel) => GridRowModesModel) => void;
}

export default function EditToolbar(props: EditToolbarProps) {
  const { labels, setRows, setRowModesModel } = props;

  const handleAddClick = () => {
    const id = uuidv4();
    setRows(oldRows => [...oldRows, { id, label: '', isNew: true }]);
    setRowModesModel(oldModel => ({
      ...oldModel,
      [id]: { mode: GridRowModes.Edit, fieldToFocus: 'key' },
    }));
  };

  return (
    <GridToolbarContainer>
      <Button color="primary" startIcon={<AddIcon />} onClick={handleAddClick}>
        {labels.add}
      </Button>
    </GridToolbarContainer>
  );
}
