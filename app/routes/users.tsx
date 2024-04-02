import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import grey from '@mui/material/colors/grey';
import { DataGrid, GridColDef, GridDensity, GridSortDirection } from '@mui/x-data-grid';
import { redirect, useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import pino from 'pino';
import { useEffect, useState } from 'react';
import { appActions } from '../appActions.server';
import App from '../components/App';
import { firestore } from '../firebase.server';
import { fetchIdentities } from '../firestore.server/fetchers.server';
import { IdentityData } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { internalLinkSx } from '../utils/jsxUtils';

const logger = pino({ name: 'route:identities' });

const MAX_IMPORT = 500;

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

  const imports = formData.get('imports')?.toString() ?? '';
  if (!imports) {
    return;
  }

  const identitiesColl = firestore.collection(
    'customers/' + sessionData.customerId + '/identities'
  );
  const batch = firestore.batch();

  const accounts = imports.split(/\r|\n/);

  if (accounts.length > MAX_IMPORT) {
    return { error: `You cannot import more than ${MAX_IMPORT} accounts at a time` };
  }
  const dateCreated = Date.now();
  for (const account of accounts) {
    const [jiraName, email, gitHubId, jiraId] = account.split(',');
    batch.set(identitiesColl.doc(), {
      dateCreated,
      displayName: jiraName,
      ...(email && { email }),
      accounts: [
        { feedId: 2, type: 'jira', id: jiraId, name: jiraName },
        { feedId: 1, type: 'github', id: gitHubId, name: '' },
      ],
    });
  }
  await batch.commit(); // up to 500 operations

  return null;
};

export default function Users() {
  const sessionData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [imports, setImports] = useState(
    'John Doe,jdoe@example.com,jdoe,qwerty123456\rJane Smith,smith@example.com,jsmith,asdfgh7890'
  );

  const [error, setError] = useState('');

  useEffect(() => {
    setError(actionData?.error ?? '');
  }, [actionData?.error]);

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
    sortingOrder: ['asc', 'desc'] as GridSortDirection[],
    initialState: {
      pagination: { paginationModel: { pageSize: 25 } },
      sorting: { sortModel: [{ field: 'id', sort: 'asc' as GridSortDirection }] },
    },
  };
  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'ROAKIT ID',
      minWidth: 200,
    },
    {
      field: 'displayName',
      headerName: 'Name',
      minWidth: 250,
      renderCell: params => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const id = params.row.id as string;
        return (
          <Link
            href={`/activity/user/${encodeURI(id)}`}
            title={params.value as string}
            sx={internalLinkSx}
          >
            {params.value}
          </Link>
        );
      },
    },
    { field: 'email', headerName: 'Email', minWidth: 250 },
    {
      field: 'accounts',
      headerName: 'Accounts',
      minWidth: 200,
      flex: 1,
      renderCell: params => {
        return (params.value as IdentityData['accounts']).map((account, i) => {
          return (
            <Stack key={i}>
              <Stack direction="row" spacing="10px" sx={{ textWrap: 'nowrap' }}>
                <Typography fontSize="small" color={!account.id ? 'error' : 'inherited'}>
                  <strong>{account.type}: </strong>
                  {account.id || '[no id]'}
                </Typography>
                {account.name && <Box>{account.name}</Box>}
                <Link href={account.url} target="_blank" sx={{ cursor: 'pointer' }}>
                  {account.url}
                </Link>
              </Stack>
            </Stack>
          );
        });
      },
    },
  ];

  return (
    <App
      isLoggedIn={true}
      isNavOpen={sessionData.isNavOpen}
      showProgress={navigation.state === 'submitting'}
      view="users"
    >
      <Stack sx={{ m: 3 }}>
        <DataGrid
          columns={columns}
          rows={sessionData.identities.list}
          {...dataGridProps}
          getRowHeight={() => 'auto'}
        />
        <TextField
          label="Import"
          value={imports}
          fullWidth
          multiline
          minRows={5}
          maxRows={15}
          helperText="Jira name,email,GitHub username,Jira ID"
          size="small"
          onChange={e => {
            setError('');
            setImports(e.target.value);
          }}
          inputProps={{
            style: {
              fontFamily: 'Roboto Mono, monospace',
              fontSize: '.8rem',
              backgroundColor: grey[200],
              padding: '5px',
            },
          }}
          sx={{ mt: 5 }}
        />
        <Button
          variant="contained"
          disabled={navigation.state === 'submitting'}
          sx={{ mt: 2, maxWidth: 150 }}
          onClick={() => submit({ imports }, { method: 'post' })}
        >
          Import
        </Button>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
