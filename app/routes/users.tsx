import {
  Download as DownloadIcon,
  GitHub as GitHubIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { Alert, Box, Button, Link, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { DataGrid, GridColDef, GridSortDirection } from '@mui/x-data-grid';
import {
  Link as RemixLink,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import pino from 'pino';
import { useEffect, useState } from 'react';
import App from '../components/App';
import TabPanel from '../components/TabPanel';
import { firestore } from '../firebase.server';
import { fetchAccountsToReview, fetchIdentities } from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import { IdentityData } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { dataGridCommonProps } from '../utils/dataGridUtils';
import { postJsonOptions } from '../utils/httpUtils';
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
    const [identities, accountsToReview] = await Promise.all([
      fetchIdentities(sessionData.customerId!),
      fetchAccountsToReview(sessionData.customerId!),
    ]);
    return { ...sessionData, identities, accountsToReview };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

interface JsonRequest {
  imports?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const jsonRequest = (await request.json()) as JsonRequest;

  const imports = jsonRequest.imports;
  if (imports) {
    const identitiesColl = firestore.collection(`customers/${sessionData.customerId}/identities`);
    const batch = firestore.batch();

    const accounts = imports.split(/\r|\n/);

    if (accounts.length > MAX_IMPORT) {
      return { error: `You cannot import more than ${MAX_IMPORT} accounts at a time` };
    }
    const dateCreated = Date.now();
    for (const account of accounts) {
      const [email, jiraId, jiraName, gitHubId] = account.split(',');
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
  }

  return null;
};

export default function Users() {
  const sessionData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [tabValue, setTabValue] = useState(0);
  const [imports, setImports] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    setError(actionData?.error ?? '');
  }, [actionData?.error]);

  const identityCols: GridColDef[] = [
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
        const id = (params.row as IdentityData).id;
        return (
          <Link href={`/activity/user/${encodeURI(id)}`} title="View activity" sx={internalLinkSx}>
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
      sortable: false,
      renderCell: params => {
        return (params.value as IdentityData['accounts']).map((account, i) => {
          return (
            <Stack key={i}>
              <Stack direction="row" spacing="10px" sx={{ textWrap: 'nowrap' }}>
                <Typography fontSize="small" color={!account.id ? 'error' : 'inherited'}>
                  <Stack direction="row" alignItems={'center'}>
                    {account.type === 'github' && <GitHubIcon sx={{ fontSize: '12px' }} />}
                    {account.type === 'jira' && (
                      <Box component="span" sx={{ fontSize: '10px' }}>
                        <JiraIcon />
                      </Box>
                    )}
                    <Box sx={{ ml: 1 }}> {account.id || 'no id'}</Box>
                  </Stack>
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

  const accountReviewCols: GridColDef[] = [
    {
      field: 'id',
      headerName: 'Account ID',
      minWidth: 200,
    },
    { field: 'type', headerName: 'Source', minWidth: 80 },
    {
      field: 'name',
      headerName: 'Name',
      minWidth: 250,
      renderCell: params => {
        const id = (params.row as IdentityData).id;
        return (
          <Link href={`/activity/user/${encodeURI(id)}`} title="View activity" sx={internalLinkSx}>
            {params.value}
          </Link>
        );
      },
    },
  ];

  enum UsersTab {
    Directory,
    NeedsReview,
  }

  return (
    <App
      isLoggedIn={true}
      isNavOpen={sessionData.isNavOpen}
      showProgress={navigation.state !== 'idle'}
      view="users"
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 1 }}>
        <Tabs
          variant="scrollable"
          value={tabValue}
          onChange={(_, newValue: number) => setTabValue(newValue)}
        >
          <Tab label="Directory" id={`tab-${UsersTab.Directory}`} />
          <Tab label="To Review" id={`tab-${UsersTab.NeedsReview}`} />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={UsersTab.Directory}>
        <Stack>
          <DataGrid
            columns={identityCols}
            rows={sessionData.identities.list}
            {...dataGridCommonProps}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'name', sort: 'asc' as GridSortDirection }] },
            }}
            getRowHeight={() => 'auto'}
          />
          <Box>
            <Button
              component={RemixLink}
              to="csv"
              reloadDocument
              variant="text"
              sx={{ mt: 1, textWrap: 'nowrap' }}
              startIcon={<DownloadIcon />}
            >
              Download as CSV
            </Button>
          </Box>
          <TextField
            label=" CSV list to import"
            value={imports}
            fullWidth
            multiline
            minRows={5}
            maxRows={15}
            helperText="email,Jira ID,Jira name,GitHub username"
            placeholder="jdoe@example.com,l1b78K4798TBj3pPe47k,John Doe,jdoe
jsmith@example.com,qyXNw7qryWGENPNbTnZW,Jane Smith,jsmith"
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
          />{' '}
          <Box flex={0}>
            <Button
              variant="contained"
              disabled={navigation.state !== 'idle'}
              startIcon={<UploadIcon />}
              sx={{ mt: 2, textWrap: 'nowrap' }}
              onClick={() => submit({ imports }, postJsonOptions)}
            >
              Import
            </Button>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Stack>
      </TabPanel>
      <TabPanel value={tabValue} index={UsersTab.NeedsReview}>
        <Typography sx={{ mb: 2 }}>
          <em>We found activity for these accounts not listed in the directory.</em>
        </Typography>
        <DataGrid
          columns={accountReviewCols}
          rows={sessionData.accountsToReview}
          {...dataGridCommonProps}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: 'name', sort: 'asc' as GridSortDirection }] },
          }}
          rowHeight={50}
          autosizeOnMount
        />
      </TabPanel>
    </App>
  );
}
