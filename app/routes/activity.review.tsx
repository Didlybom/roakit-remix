import DoneAllIcon from '@mui/icons-material/DoneAll';
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
  Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';

import { GridColDef, GridDensity, GridSortDirection } from '@mui/x-data-grid';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData, useSubmit } from '@remix-run/react';
import pino from 'pino';
import { useMemo, useState } from 'react';
import DataGridWithSingleClickEditing from '~/components/DataGridWithSingleClickEditing';
import Header from '~/components/Header';
import { sessionCookie } from '~/cookies.server';
import { firestore, auth as serverAuth } from '~/firebase.server';
import { ActivityData, activitySchema } from '~/schemas/schemas';
import { loadSession } from '~/utils/authUtils.server';
import { formatMonthDayTime, formatRelative } from '~/utils/dateUtils';
import { errMsg } from '~/utils/errorUtils';
import { fetchInitiatives } from '~/utils/firestoreUtils.server';
import { ellipsisAttrs } from '~/utils/jsxUtils';

const logger = pino({ name: 'route:activity.review' });

const MAX_BATCH = 500;

// verify JWT, load activities needing review
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  try {
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
          const data = props.data;
          return {
            id: snapshot.id,
            action: data.action,
            actorId: data.actorId,
            type: data.type,
            date: data.date,
            initiative: '',
          };
        },
        toFirestore: activity => activity,
      });
    const activityDocs = await activitiesCollection.get();
    const activities: ActivityData[] = [];
    activityDocs.forEach(activity => activities.push(activity.data()));

    // retrieve initiatives
    const initiatives = await fetchInitiatives(sessionData.customerId);

    return { activities, initiatives };
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

export default function Info() {
  const submit = useSubmit();

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
      {
        field: 'date',
        headerName: 'Date',
        type: 'dateTime',
        width: 100,
        valueGetter: params => new Date(params.value as number),
        valueFormatter: params => formatRelative(params.value as Date),
        renderCell: params => {
          return (
            <Tooltip title={formatMonthDayTime(params.value as Date)}>
              <Box sx={{ ...ellipsisAttrs }}>{formatRelative(params.value as Date)}</Box>
            </Tooltip>
          );
        },
      },
      { field: 'actorId', headerName: 'Actor', width: 100 },
      { field: 'action', headerName: 'Action', width: 100 },
      { field: 'type', headerName: 'Type', width: 100 },
      {
        field: 'initiative',
        headerName: 'Initiative',
        type: 'singleSelect',
        valueOptions: [
          { value: '', label: 'n/a' },
          ...sessionData.initiatives.map(i => {
            return { value: i.id, label: i.label };
          }),
        ],
        minWidth: 200,
        flex: 1,
        editable: true,
        renderCell: () => <EditIcon color="secondary" fontSize="small" />,
      },
    ],
    [sessionData.initiatives]
  );

  return (
    <>
      <Header isLoggedIn={true} view="activity.review" />
      {!!selectedRows.length && (
        <>
          <Grid container spacing={2} sx={{ m: 2 }}>
            <Grid>
              <FormControl size="small" sx={{ width: '100%' }}>
                <InputLabel id="Initiative">Initiative</InputLabel>
                <Select
                  labelId="initiative-label"
                  id="initiative-select"
                  value={bulkInitiative}
                  label="Initiative"
                  onChange={e => setBulkInitiative(e.target.value)}
                  sx={{ minWidth: '200px' }}
                >
                  {sessionData.initiatives.map((initiative, i) => (
                    <MenuItem key={i} value={initiative.id}>
                      {initiative.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid>
              <Button
                disabled={!bulkInitiative || selectedRows.length > MAX_BATCH}
                color="secondary"
                variant="contained"
                startIcon={<DoneAllIcon />}
                onClick={() =>
                  submit(
                    { initiativeId: bulkInitiative, activityIds: selectedRows },
                    { method: 'post' }
                  )
                }
              >
                Bulk assign selected activities
              </Button>
            </Grid>
          </Grid>
          {selectedRows.length > MAX_BATCH && (
            <Alert severity="warning" sx={{ mx: 3 }}>
              Please select no more than {MAX_BATCH} activities.
            </Alert>
          )}
        </>
      )}
      <Stack sx={{ m: 3 }}>
        <DataGridWithSingleClickEditing
          columns={columns}
          rows={sessionData.activities}
          {...dataGridProps}
          checkboxSelection
          processRowUpdate={(updatedRow: ActivityData) => {
            submit(
              { initiativeId: updatedRow.initiative, activityIds: [updatedRow.id] },
              { method: 'post' }
            );
            return updatedRow;
          }}
          onRowSelectionModelChange={rowSelectionModel => {
            setSelectedRows(rowSelectionModel as string[]);
          }}
          onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to update initiative'))}
        ></DataGridWithSingleClickEditing>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </>
  );
}