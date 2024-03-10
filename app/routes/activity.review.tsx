import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import {
  GridColDef,
  GridDensity,
  GridSortDirection,
  GridToolbarContainer,
  GridValueGetterParams,
} from '@mui/x-data-grid';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import pino from 'pino';
import pluralize from 'pluralize';
import { useMemo, useState } from 'react';
import App from '../components/App';
import DataGridWithSingleClickEditing from '../components/DataGridWithSingleClickEditing';
import { sessionCookie } from '../cookies.server';
import { firestore, auth as serverAuth } from '../firebase.server';
import { ActivityData, activitySchema } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { fetchActorMap, fetchInitiatives } from '../utils/firestoreUtils.server';
import { actorColdDef, dateColdDef } from '../utils/jsxUtils';

const logger = pino({ name: 'route:activity.review' });

const MAX_BATCH = 500;

// verify JWT, load activities needing review
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  try {
    // retrieve initiatives
    const initiatives = await fetchInitiatives(sessionData.customerId);

    // retrieve users
    const actors = await fetchActorMap(sessionData.customerId);

    // retrieve activities
    const activitiesCollection = firestore
      .collection('customers/' + sessionData.customerId + '/activities')
      .where('initiative', '==', '')
      .limit(1000) // FIXME limit
      .withConverter({
        fromFirestore: snapshot => {
          const props = activitySchema.safeParse(snapshot.data());
          if (!props.success) {
            throw Error('Failed to parse activities. ' + props.error.message);
          }
          return {
            id: snapshot.id,
            action: props.data.action,
            actor: {
              id: props.data.actorId,
              name: actors[props.data.actorId]?.name ?? 'unknown',
            },
            type: props.data.type,
            date: props.data.date,
            initiative: '',
          };
        },
        toFirestore: activity => activity,
      });
    const activityDocs = await activitiesCollection.get();
    const activities: ActivityData[] = [];
    activityDocs.forEach(activity => {
      activities.push(activity.data());
    });
    return { activities, initiatives, actors };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const jwt = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  if (!jwt) {
    return redirect('/login');
  }
  try {
    const token = await serverAuth.verifySessionCookie(jwt);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const customerId = token.customerId;

    const form = await request.formData();
    const activityIds = form.get('activityIds')?.toString() ?? '';
    if (activityIds) {
      const initiative = form.get('initiativeId')?.toString() ?? '';
      const batch = firestore.batch();
      activityIds.split(',').forEach(activityId => {
        const doc = firestore.doc('customers/' + customerId + '/activities/' + activityId);
        batch.update(doc, { initiative });
      });
      await batch.commit(); // up to 500 operations
    }

    return null;
  } catch (e) {
    logger.error(e);
    return redirect('/logout');
  }
};

export default function ActivityReview() {
  const fetcher = useFetcher();

  const sessionData = useLoaderData<typeof loader>();

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [bulkInitiative, setBulkInitiative] = useState('');

  const [error, setError] = useState('');

  const dataGridProps = {
    autoHeight: true, // otherwise empty state looks ugly
    slots: {
      noRowsOverlay: () => (
        <Box height="75px" display="flex" alignItems="center" justifyContent="center">
          Nothing to show
        </Box>
      ),
    },
    density: 'compact' as GridDensity,
    disableRowSelectionOnClick: true,
    disableColumnMenu: true,
    pageSizeOptions: [25, 50, 100],
    initialState: {
      pagination: { paginationModel: { pageSize: 25 } },
      sorting: { sortModel: [{ field: 'date', sort: 'desc' as GridSortDirection }] },
    },
  };

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColdDef({
        valueGetter: (params: GridValueGetterParams) => new Date(params.value as number),
      }),
      actorColdDef({ headerName: 'Actor', width: 120 }),
      { field: 'action', headerName: 'Action', width: 100 },
      { field: 'type', headerName: 'Type', width: 100 },
      {
        field: 'initiative',
        headerName: 'Initiative',
        type: 'singleSelect',
        valueOptions: [
          ...sessionData.initiatives.map(i => {
            return { value: i.id, label: i.label };
          }),
        ],
        minWidth: 200,
        flex: 1,
        editable: true,
        renderCell: () => <EditIcon color="primary" fontSize="small" />,
      },
    ],
    [sessionData.initiatives]
  );

  function BulkToolbar() {
    return (
      <GridToolbarContainer>
        <Grid container spacing={1} sx={{ m: 1 }}>
          <Grid sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            {selectedRows.length} {pluralize('activity', selectedRows.length)} selected
          </Grid>
          <Grid>
            <FormControl size="small" sx={{ width: '100%' }}>
              <InputLabel id="initiative">Add to initiative</InputLabel>
              <Select
                labelId="initiative-label"
                id="initiative-select"
                value={bulkInitiative}
                label="Select an initiative"
                onChange={e => setBulkInitiative(e.target.value)}
                sx={{ minWidth: '250px' }}
              >
                {sessionData.initiatives.map((initiative, i) => (
                  <MenuItem key={i} value={initiative.id}>
                    {initiative.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid sx={{ display: 'flex' }}>
            <Button
              disabled={!bulkInitiative || selectedRows.length > MAX_BATCH}
              onClick={() =>
                fetcher.submit(
                  { initiativeId: bulkInitiative, activityIds: selectedRows },
                  { method: 'post' }
                )
              }
            >
              Save
            </Button>
          </Grid>
        </Grid>
        {selectedRows.length > MAX_BATCH && (
          <Alert severity="warning" sx={{ display: 'flex', bgcolor: 'inherit' }}>
            Please select no more than {MAX_BATCH} activities.
          </Alert>
        )}
      </GridToolbarContainer>
    );
  }

  return (
    <App view="activity.review" isLoggedIn={true} isNavOpen={true}>
      <Stack sx={{ m: 3 }}>
        {sessionData.activities.length && (
          <Typography sx={{ mb: 2 }}>Please set initiatives for these activities.</Typography>
        )}
        <DataGridWithSingleClickEditing
          columns={columns}
          rows={sessionData.activities}
          {...dataGridProps}
          slots={{ toolbar: selectedRows.length ? BulkToolbar : undefined }}
          checkboxSelection
          processRowUpdate={(updatedRow: ActivityData) => {
            fetcher.submit(
              { initiativeId: updatedRow.initiative, activityIds: [updatedRow.id] },
              { method: 'post' }
            );
            return updatedRow;
          }}
          onRowSelectionModelChange={rowSelectionModel => {
            setSelectedRows(rowSelectionModel as string[]);
            if (!rowSelectionModel.length) {
              setBulkInitiative('');
            }
          }}
          onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to update'))}
        />
        {error && (
          <Alert severity="error" variant="standard" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
