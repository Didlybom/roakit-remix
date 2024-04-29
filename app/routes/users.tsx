import {
  Download as DownloadIcon,
  GitHub as GitHubIcon,
  OpenInNew as OpenInNewIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Link,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { DataGrid, GridColDef, GridSortDirection } from '@mui/x-data-grid';
import {
  Link as RemixLink,
  ShouldRevalidateFunction,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import { useEffect, useMemo, useState } from 'react';
import App from '../components/App';
import DataGridWithSingleClickEditing from '../components/DataGridWithSingleClickEditing';
import TabPanel from '../components/TabPanel';
import { firestore } from '../firebase.server';
import { fetchAccountsToReview, fetchIdentities } from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import type { IdentityData } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { dataGridCommonProps } from '../utils/dataGridUtils';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { internalLinkSx } from '../utils/jsxUtils';

const logger = pino({ name: 'route:identities' });

const MAX_IMPORT = 500;
const UNSET_MANAGER_ID = '_UNSET_MANAGER_';

export const meta = () => [{ title: 'Contributors Admin | ROAKIT' }];

export const shouldRevalidate: ShouldRevalidateFunction = ({ actionResult }) => {
  return (actionResult as ActionResponse)?.status === 'imported';
};

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
  identityId?: string;
  managerId?: string;
  imports?: string;
}

interface ActionResponse {
  status?: 'imported' | 'userUpdated';
  error?: string;
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<TypedResponse<never> | ActionResponse> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const jsonRequest = (await request.json()) as JsonRequest;

  // update manager
  if (jsonRequest.identityId) {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/identities/${jsonRequest.identityId}`)
        .update({
          managerId: jsonRequest.managerId === UNSET_MANAGER_ID ? '' : jsonRequest.managerId,
        });
      return { status: 'userUpdated' };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save user') };
    }
  }

  // import
  if (jsonRequest.imports) {
    const identitiesColl = firestore.collection(`customers/${sessionData.customerId}/identities`);
    const batch = firestore.batch();

    const accounts = jsonRequest.imports.split(/\r|\n/);

    if (accounts.length > MAX_IMPORT) {
      return {
        error: `You cannot import more than ${MAX_IMPORT} accounts at a time`,
        status: 'imported',
      };
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
    return { status: 'imported' };
  }

  return {};
};

export default function Users() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [tabValue, setTabValue] = useState(0);
  const [identities, setIdentities] = useState(loaderData.identities.list);
  const [imports, setImports] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    setIdentities(loaderData.identities.list);
  }, [loaderData.identities.list]);

  useEffect(() => {
    setError(actionData?.error ?? '');
  }, [actionData?.error]);

  const identityCols = useMemo<GridColDef[]>(
    () => [
      {
        field: 'displayName',
        headerName: 'Name',
        minWidth: 200,
        renderCell: params => {
          const id = (params.row as IdentityData).id;
          return (
            <Link
              href={`/activity/user/${encodeURI(id)}`}
              title="View activity"
              sx={internalLinkSx}
            >
              {params.value}
            </Link>
          );
        },
      },
      {
        field: 'summary-ui',
        headerName: 'Summary UI',
        minWidth: 60,
        renderCell: params => {
          const id = (params.row as IdentityData).id;
          return (
            <IconButton href={`/summary/user/${encodeURI(id)}`} title="Summary UI" size="small">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
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
                  <Typography
                    component="div"
                    fontSize="small"
                    color={!account.id ? 'error' : 'inherited'}
                  >
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
      {
        field: 'managerId',
        headerName: 'Team',
        minWidth: 200,
        type: 'singleSelect',
        valueOptions: params => [
          { value: UNSET_MANAGER_ID, label: '[unset]' },
          ...loaderData.identities.list
            .filter(i => i.id !== (params.row as IdentityData).id)
            .map(identity => ({ value: identity.id, label: identity.displayName })),
        ],
        editable: true,
        renderCell: params =>
          params.value && params.value !== UNSET_MANAGER_ID ?
            <Box sx={{ cursor: 'pointer' }}>
              {loaderData.identities.list.find(i => i.id === params.value)?.displayName ??
                'unknown'}
            </Box>
          : <Box sx={{ cursor: 'pointer' }}>{'...'}</Box>,
      },
      {
        field: 'id',
        headerName: 'Roakit ID',
        minWidth: 200,
      },
    ],
    [loaderData.identities]
  );

  const accountReviewCols = useMemo<GridColDef[]>(
    () => [
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
            <Link
              href={`/activity/user/${encodeURI(id)}`}
              title="View activity"
              sx={internalLinkSx}
            >
              {params.value}
            </Link>
          );
        },
      },
    ],
    []
  );

  enum UsersTab {
    Directory,
    NeedsReview,
  }

  return (
    <App
      isLoggedIn={true}
      isNavOpen={loaderData.isNavOpen}
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
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <DataGridWithSingleClickEditing
            columns={identityCols}
            rows={identities.map(identity => ({
              ...identity,
              managerId: identity.managerId ?? UNSET_MANAGER_ID,
            }))}
            {...dataGridCommonProps}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'name', sort: 'asc' as GridSortDirection }] },
            }}
            getRowHeight={() => 'auto'}
            processRowUpdate={(updatedRow: IdentityData, oldRow: IdentityData) => {
              if (updatedRow.managerId !== oldRow.managerId) {
                setIdentities(
                  identities.map(identity =>
                    identity.id === updatedRow.id ?
                      { ...identity, managerId: updatedRow.managerId }
                    : identity
                  )
                );
                submit(
                  { identityId: updatedRow.id, managerId: updatedRow.managerId ?? null },
                  postJsonOptions
                );
              }
              return updatedRow;
            }}
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
            helperText="manager ID,email,Jira ID,Jira name,GitHub username"
            placeholder="x7jfRAz1sSko911234,jdoe@example.com,l1b78K4798TBj3pPe47k,John Doe,jdoe
,jsmith@example.com,qyXNw7qryWGENPNbTnZW,Jane Smith,jsmith"
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
        </Stack>
      </TabPanel>
      <TabPanel value={tabValue} index={UsersTab.NeedsReview}>
        <Typography sx={{ mb: 2 }}>
          <em>We found activity for these accounts not listed in the directory.</em>
        </Typography>
        <DataGrid
          columns={accountReviewCols}
          rows={loaderData.accountsToReview}
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
