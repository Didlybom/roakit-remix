import { Alert, Box, Stack, Tooltip } from '@mui/material';
import { GridColDef, GridDensity, GridSortDirection, useGridApiRef } from '@mui/x-data-grid';
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

    const activityId = form.get('activityId')?.toString() ?? '';
    if (activityId) {
      const initiative = form.get('initiativeId')?.toString() ?? '';
      const doc = firestore.doc('customers/' + customerId + '/activities/' + activityId);
      await doc.update({ initiative });
    }

    return null;
  } catch (e) {
    logger.error(e);
    return redirect('/logout');
  }
};

export default function Info() {
  const submit = useSubmit();
  const gridApi = useGridApiRef();

  const sessionData = useLoaderData<typeof loader>();

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
      },
    ],
    [sessionData.initiatives]
  );

  return (
    <>
      <Header isLoggedIn={true} view="activity.review" />
      <Stack sx={{ m: 3 }}>
        <DataGridWithSingleClickEditing
          columns={columns}
          rows={sessionData.activities}
          {...dataGridProps}
          apiRef={gridApi}
          processRowUpdate={(updatedRow: ActivityData) => {
            submit(
              { activityId: updatedRow.id, initiativeId: updatedRow.initiative },
              { method: 'post' }
            );
            return updatedRow;
          }}
          onProcessRowUpdateError={e => setError(errMsg(e, 'Failed to save initiative'))}
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
