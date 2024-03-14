import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import {
  GridColDef,
  GridDensity,
  GridFeatureMode,
  GridToolbarContainer,
  GridValueGetterParams,
} from '@mui/x-data-grid';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import {
  QueryDocumentSnapshot,
  collection,
  endBefore,
  getCountFromServer,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState } from 'react';
import usePrevious from 'use-previous';
import App from '../components/App';
import DataGridWithSingleClickEditing from '../components/DataGridWithSingleClickEditing';
import { sessionCookie } from '../cookies.server';
import { firestore as firestoreClient } from '../firebase.client';
import { firestore, auth as serverAuth } from '../firebase.server';
import { ActivityCount, ActivityData, Artifact, activitySchema } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { ParseError, errMsg } from '../utils/errorUtils';
import {
  fetchActorMap,
  fetchInitiativeMap,
  incrementInitiativeCounters,
} from '../utils/firestoreUtils.server';
import { actorColdDef, dateColdDef } from '../utils/jsxUtils';

const logger = pino({ name: 'route:activity.review' });

const MAX_BATCH = 500;
const PAGE_SIZE = 50;

// verify JWT, load activities
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve initiatives and users
    const [initiatives, actors] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId),
      fetchActorMap(sessionData.customerId),
    ]);
    return { customerId: sessionData.customerId, initiatives, actors };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

type ActivityPayload = { id: string; artifact: Artifact; createdTimestamp: number }[];

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
    const initiativeCountersLastUpdated =
      form.get('initiativeCountersLastUpdated')?.toString() ?? '';
    if (!activitiesJson || !initiativeId) {
      return null;
    }
    const activities = JSON.parse(activitiesJson) as ActivityPayload;
    const counters: ActivityCount = { code: 0, codeOrg: 0, task: 0, taskOrg: 0 };
    const batch = firestore.batch();
    activities.forEach(activity => {
      if (
        initiativeCountersLastUpdated &&
        activity.createdTimestamp < +initiativeCountersLastUpdated
      ) {
        counters[activity.artifact]++;
      }
      const activityDoc = firestore.doc('customers/' + customerId + '/activities/' + activity.id);
      batch.update(activityDoc, { initiativeId });
    });
    await batch.commit(); // up to 500 operations

    //  update the initiative counters
    await incrementInitiativeCounters(customerId, initiativeId, counters);
    // FIXME decrement the activity that had an initiative and were changed

    return null;
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export default function ActivityReview() {
  const fetcher = useFetcher();
  const sessionData = useLoaderData<typeof loader>();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [bulkInitiative, setBulkInitiative] = useState('');
  const [rowTotal, setRowTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: PAGE_SIZE });
  const prevPaginationModel = usePrevious(paginationModel);
  const [boundaryDocs, setBoundaryDocs] = useState<{
    first: QueryDocumentSnapshot;
    last: QueryDocumentSnapshot;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      const activitiesCollection = collection(
        firestoreClient,
        `customers/${sessionData.customerId}/activities`
      );
      let activitiesCount;
      let activitiesQuery;
      if (!showAllActivity) {
        activitiesCount = (
          await getCountFromServer(query(activitiesCollection, where('initiativeId', '==', '')))
        ).data().count;
        activitiesQuery = query(
          activitiesCollection,
          where('initiativeId', '==', ''),
          orderBy('createdTimestamp', 'desc')
        );
      } else {
        activitiesCount = (await getCountFromServer(activitiesCollection)).data().count;
        activitiesQuery = query(activitiesCollection, orderBy('createdTimestamp', 'desc'));
      }
      if (prevPaginationModel && boundaryDocs) {
        if (prevPaginationModel?.page < paginationModel.page) {
          activitiesQuery = query(
            activitiesQuery,
            startAfter(boundaryDocs.last),
            limit(paginationModel.pageSize)
          );
        }
        if (prevPaginationModel?.page > paginationModel.page) {
          activitiesQuery = query(
            activitiesQuery,
            endBefore(boundaryDocs.first),
            limitToLast(paginationModel.pageSize)
          );
        }
      } else {
        activitiesQuery = query(activitiesQuery, limit(paginationModel.pageSize));
      }
      const activityDocs = await getDocs(activitiesQuery);
      const activityData: ActivityData[] = [];
      activityDocs.forEach(activity => {
        const fields = activitySchema.safeParse(activity.data());
        if (!fields.success) {
          throw new ParseError('Failed to parse activities. ' + fields.error.message);
        }
        activityData.push({
          id: activity.id,
          action: fields.data.action,
          actorId: fields.data.actorAccountId,
          artifact: fields.data.artifact,
          createdTimestamp: fields.data.createdTimestamp,
          initiativeId: fields.data.initiativeId ?? '',
        });
      });
      setActivities(activityData);
      setRowTotal(activitiesCount);
      if (activityDocs.docs.length > 0) {
        setBoundaryDocs({
          first: activityDocs.docs[0],
          last: activityDocs.docs[activityDocs.docs.length - 1],
        });
      }
      setLoading(false);
    };
    void fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData.customerId, showAllActivity, paginationModel]); // prevPaginationModel and boundaryDocs must be omitted

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
    paginationMode: 'server' as GridFeatureMode,
    pageSizeOptions: [PAGE_SIZE],
  };

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColdDef({
        field: 'createdTimestamp',
        sortable: false,
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
        sortable: false,
        width: 120,
      }),
      { field: 'action', headerName: 'Action', width: 100, sortable: false },
      { field: 'artifact', headerName: 'Artifact', width: 100, sortable: false },
      {
        field: 'initiativeId',
        headerName: 'Initiative',
        type: 'singleSelect',
        valueOptions: Object.keys(sessionData.initiatives).map(initiativeId => {
          const initiative = sessionData.initiatives[initiativeId];
          return { value: initiativeId, label: initiative.label };
        }),
        minWidth: 200,
        flex: 1,
        editable: true,
        sortable: false,
        renderCell: params =>
          params.value ?
            <Box className="MuiDataGrid-cellContent">
              {sessionData.initiatives[params.value as string].label ?? 'unknown'}
            </Box>
          : <EditIcon color="primary" fontSize="small" />,
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
                {Object.keys(sessionData.initiatives).map(initiativeId => (
                  <MenuItem key={initiativeId} value={initiativeId}>
                    {sessionData.initiatives[initiativeId].label}
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
                    initiativeCountersLastUpdated:
                      sessionData.initiatives[bulkInitiative].countersLastUpdated,
                    activities: JSON.stringify(
                      selectedRows.map(id => {
                        return {
                          id,
                          artifact: activities.find(a => a.id === id)!.artifact,
                        };
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

  return loading ?
      <App view="activity.review" isLoggedIn={true} isNavOpen={true} showProgress={true} />
    : <App view="activity.review" isLoggedIn={true} isNavOpen={true} showProgress={false}>
        <Stack sx={{ m: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showAllActivity}
                onChange={e => {
                  setPaginationModel({ page: 0, pageSize: PAGE_SIZE });
                  setBoundaryDocs(null);
                  setShowAllActivity(e.target.checked);
                }}
              />
            }
            label="Show all activities"
            sx={{ mb: 2, justifyContent: 'right' }}
          />
          <DataGridWithSingleClickEditing
            columns={columns}
            rows={activities}
            {...dataGridProps}
            rowCount={rowTotal}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            slots={{ toolbar: selectedRows.length ? BulkToolbar : undefined }}
            checkboxSelection
            processRowUpdate={(updatedRow: ActivityData) => {
              fetcher.submit(
                {
                  initiativeId: updatedRow.initiativeId,
                  initiativeCountersLastUpdated:
                    sessionData.initiatives[updatedRow.initiativeId].countersLastUpdated,
                  activities: JSON.stringify([
                    {
                      id: updatedRow.id,
                      artifact: updatedRow.artifact,
                      createdTimestamp: updatedRow.createdTimestamp,
                    },
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
      </App>;
}
