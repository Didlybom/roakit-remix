import { Alert, Box, Divider, Link, Stack } from '@mui/material';
import { DataGrid, GridColDef, GridDensity, GridSortDirection } from '@mui/x-data-grid';
import { redirect, useLoaderData } from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import pino from 'pino';
import { useState } from 'react';
import { appActions } from '../appActions.server';
import App from '../components/App';
import { fetchIdentities } from '../firestore.server/fetchers.server';
import { IdentityData } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { internalLinkSx } from '../utils/jsxUtils';

const logger = pino({ name: 'route:identities' });

interface IdentityRow {
  id: string;
  email?: string;
  displayName?: string;
  accounts?: { feedId: number; type: string; id: string; name?: string; url?: string }[];
  isNew?: boolean;
}

export const meta = () => [{ title: 'Contributors Admin | ROAKIT' }];

// verify JWT, load identities
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    return { ...sessionData, identities };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const formData = await request.formData();

  const appAction = await appActions(request, formData);
  if (appAction) {
    return appAction;
  }
};

export default function Users() {
  const sessionData = useLoaderData<typeof loader>();

  const [rows] = useState<IdentityRow[]>(sessionData.identities.list);
  const [error] = useState('');

  const dataGridProps = {
    autosizeOnMount: true,
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
    sortingOrder: ['asc', 'desc'] as GridSortDirection[],
    initialState: {
      pagination: { paginationModel: { pageSize: 25 } },
      sorting: { sortModel: [{ field: 'id', sort: 'asc' as GridSortDirection }] },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  // const accounts = params.row.accounts as IdentityData['accounts'];
  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      renderCell: params => {
        return (
          <Link
            href={`/activity/user/${encodeURI(params.value as string)}`}
            title={params.value as string}
            sx={internalLinkSx}
          >
            {params.value}
          </Link>
        );
      },
    },
    { field: 'email', headerName: 'Email' },
    { field: 'displayName', headerName: 'Name' },
    {
      field: 'accounts',
      headerName: 'Accounts',
      renderCell: params => {
        return (params.value as IdentityData['accounts']).map((account, i) => {
          return (
            <Stack key={i}>
              <Stack
                direction="row"
                divider={<Divider orientation="vertical" flexItem />}
                spacing="10px"
                sx={{ textWrap: 'nowrap' }}
              >
                <strong>{account.type}:</strong>
                <Box>{account.id}</Box>
                <Box>{account.name ?? account.id}</Box>
                <Box>{account.url}</Box>
              </Stack>
            </Stack>
          );
        });
      },
    },
  ];

  return (
    <App isLoggedIn={true} isNavOpen={sessionData.isNavOpen} view="users">
      <Stack sx={{ m: 3 }}>
        <DataGrid columns={columns} rows={rows} {...dataGridProps} getRowHeight={() => 'auto'} />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
