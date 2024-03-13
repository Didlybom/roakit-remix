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
import { ActivityCount, ActivityData, ActivityType, activitySchema } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { ParseError, errMsg } from '../utils/errorUtils';
import {
  fetchActorMap,
  fetchInitiatives,
  incrementInitiativeCounters,
} from '../utils/firestoreUtils.server';
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
    // retrieve initiatives, users, and activities
    const [initiatives, actors, activities] = await Promise.all([
      fetchInitiatives(sessionData.customerId),
      fetchActorMap(sessionData.customerId),
      (async () => {
        const activitiesCollection = firestore
          .collection('customers/' + sessionData.customerId + '/activities')
          .where('initiativeId', '==', '')
          .limit(1000) // FIXME limit
          .withConverter({
            fromFirestore: snapshot => {
              const props = activitySchema.safeParse(snapshot.data());
              if (!props.success) {
                throw new ParseError('Failed to parse activities. ' + props.error.message);
              }
              return {
                id: snapshot.id,
                action: props.data.action,
                actorId: props.data.actorId,
                type: props.data.type,
                date: props.data.date,
                initiativeId: '',
              };
            },
            toFirestore: activity => activity,
          });
        const activityDocs = await activitiesCollection.get();
        const activities: ActivityData[] = [];
        activityDocs.forEach(activity => {
          activities.push(activity.data());
        });
        return activities;
      })(),
    ]);
    return { activities, initiatives, actors };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

type ActivityPayload = { id: string; type: ActivityType }[];

export const action = async ({ request }: ActionFunctionArgs) => {
  const jwt = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  if (!jwt) {
    return redirect('/login');
  }
  try {
    const token = await serverAuth.verifySessionCookie(jwt);
    const customerId = token.customerId as string;

    const form = await request.formData();
    const activitiesJson = form.get('activities')?.toString() ?? '';
    const initiativeId = form.get('initiativeId')?.toString() ?? '';
    if (!activitiesJson || !initiativeId) {
      return null;
    }

    const activities = JSON.parse(activitiesJson) as ActivityPayload;
    const counters: ActivityCount = { code: 0, codeOrg: 0, task: 0, taskOrg: 0 };
    const batch = firestore.batch();
    activities.forEach(activity => {
      counters[activity.type]++;
      const activityDoc = firestore.doc('customers/' + customerId + '/activities/' + activity.id);
      batch.update(activityDoc, { initiativeId });
    });
    await batch.commit(); // up to 500 operations

    //  update the initiative counters
    await incrementInitiativeCounters(customerId, initiativeId, counters);

    return null;
  } catch (e) {
    logger.error(e);
    throw e;
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
      actorColdDef({
        valueGetter: (params: GridValueGetterParams) => {
          const fields = params.row as ActivityData;
          return {
            id: fields.actorId,
            name: sessionData.actors[fields.actorId]?.name ?? 'unknown',
          };
        },
        headerName: 'Actor',
        width: 120,
      }),
      { field: 'action', headerName: 'Action', width: 100 },
      { field: 'type', headerName: 'Type', width: 100 },
      {
        field: 'initiativeId',
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
    [sessionData.actors, sessionData.initiatives]
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
                  {
                    initiativeId: bulkInitiative,
                    activities: JSON.stringify(
                      selectedRows.map(id => {
                        return { id, type: sessionData.activities.find(a => a.id === id)!.type };
                      }) as ActivityPayload
                    ),
                  },
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
              {
                initiativeId: updatedRow.initiativeId,
                activities: JSON.stringify([
                  { id: updatedRow.id, type: updatedRow.type },
                ] as ActivityPayload),
              },
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
