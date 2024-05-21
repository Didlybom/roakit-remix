import {
  AddCircle as AddCircleIcon,
  Download as DownloadIcon,
  GitHub as GitHubIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Link,
  Snackbar,
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
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import type { UserRecord } from 'firebase-admin/auth';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import App from '../components/App';
import DataGridWithSingleClickEditing from '../components/DataGridWithSingleClickEditing';
import TabPanel from '../components/TabPanel';
import { auth, firestore } from '../firebase.server';
import { fetchAccountsToReview, fetchIdentities } from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import type { IdentityData } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { dataGridCommonProps } from '../utils/dataGridUtils';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, internalLinkSx } from '../utils/jsxUtils';

const logger = pino({ name: 'route:identities' });

const MAX_IMPORT = 500;
const UNSET_MANAGER_ID = '_UNSET_MANAGER_';

export const meta = () => [{ title: 'Contributors Admin | ROAKIT' }];

export const shouldRevalidate: ShouldRevalidateFunction = ({ actionResult }) => {
  const actionStatus = (actionResult as ActionResponse)?.status?.code;
  return actionStatus === 'imported' || actionStatus === 'firebaseUserCreated';
};

// verify JWT, load identities and Firebase users
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  try {
    const [identities, accountsToReview] = await Promise.all([
      fetchIdentities(sessionData.customerId!),
      fetchAccountsToReview(sessionData.customerId!),
    ]);

    // get Firebase users
    const roakitUsers = [...identities.list];
    const firebaseUsers: UserRecord[] = [];
    const getUserBatches = [];
    while (roakitUsers.length) {
      // firestore supports getting up to 100 users at a time
      const batch = roakitUsers.splice(0, 100);
      getUserBatches.push(
        auth
          .getUsers(batch.map(identity => ({ email: identity.email! })))
          .then(result => firebaseUsers.push(...result.users))
      );
    }
    await Promise.all(getUserBatches);

    firebaseUsers
      .filter(user => user.customClaims?.customerId == sessionData.customerId) // comes as a string from Firestore
      .forEach(user => {
        const identity = identities.list.find(i => i.email === user.email);
        if (identity) {
          identity.firebaseId = user.uid;
        }
      });

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
  createFirebaseUserForEmail?: string;
}

interface ActionResponse {
  status?: { code: 'imported' | 'userUpdated' | 'firebaseUserCreated'; message?: string };
  error?: string;
}

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<TypedResponse<never> | ActionResponse> => {
  const sessionData = await loadSession(request);
  const jsonRequest = (await request.json()) as JsonRequest;

  // update manager
  if (jsonRequest.identityId) {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/identities/${jsonRequest.identityId}`)
        .update({
          managerId: jsonRequest.managerId === UNSET_MANAGER_ID ? '' : jsonRequest.managerId,
        });
      return { status: { code: 'userUpdated', message: 'User updated' } };
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
      const message = `You cannot import more than ${MAX_IMPORT} accounts at a time`;
      return {
        error: message,
        status: { code: 'imported', message },
      };
    }
    const dateCreated = Date.now();
    let importCount = 0;
    for (const account of accounts) {
      const [managerId, email, jiraId, jiraName, gitHubId] = account.split(',');
      if (!email || gitHubId == null) {
        continue;
      }
      importCount++;
      batch.set(identitiesColl.doc(), {
        dateCreated,
        managerId,
        displayName: jiraName,
        ...(email && { email }),
        accounts: [
          { feedId: 2, type: 'jira', id: jiraId, name: jiraName },
          { feedId: 1, type: 'github', id: gitHubId, name: '' },
        ],
      });
    }
    await batch.commit(); // up to 500 operations
    return {
      status: {
        code: 'imported',
        message: `Imported ${importCount} ${pluralize('user', importCount)}`,
      },
    };
  }

  // create Firebase user
  if (jsonRequest.createFirebaseUserForEmail) {
    await auth.importUsers([
      {
        uid: uuidv4(),
        customClaims: { customerId: sessionData.customerId },
        email: jsonRequest.createFirebaseUserForEmail,
        emailVerified: true,
      },
    ]);
    await firestore.collection('users').add({
      customerId: sessionData.customerId,
      email: jsonRequest.createFirebaseUserForEmail,
    });
    return { status: { code: 'firebaseUserCreated', message: 'Firebase user created' } };
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

  const [confirmation, setConfirmation] = useState('false');
  const [error, setError] = useState('');

  useEffect(() => {
    setIdentities(loaderData.identities.list);
  }, [loaderData.identities.list]);

  useEffect(() => {
    setError(actionData?.error ?? '');
  }, [actionData?.error]);

  useEffect(() => {
    if (!actionData?.status) {
      setConfirmation('');
    } else if (actionData?.status?.message) {
      setConfirmation(actionData?.status?.message);
    }
  }, [actionData?.status]);

  const identityCols = useMemo<GridColDef[]>(() => {
    const findManagerName = (identityId: string) =>
      loaderData.identities.list.find(i => i.id === identityId)?.displayName ?? 'unknown';
    return [
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
              <Stack key={i} direction="row" spacing="10px" sx={{ textWrap: 'nowrap' }}>
                <Typography
                  component="div"
                  fontSize="small"
                  color={!account.id ? 'error' : 'inherited'}
                >
                  <Stack direction="row" spacing={1} alignItems={'center'}>
                    {account.type === 'github' && <GitHubIcon sx={{ fontSize: '12px' }} />}
                    {account.type === 'jira' && (
                      <Box component="span" sx={{ fontSize: '10px' }}>
                        <JiraIcon />
                      </Box>
                    )}
                    <Box> {account.id || 'n/a'}</Box>
                    {account.name && <Box sx={ellipsisSx}>{account.name}</Box>}
                    <Link
                      href={account.url}
                      target="_blank"
                      sx={{ cursor: 'pointer', ...ellipsisSx }}
                    >
                      {account.url}
                    </Link>
                  </Stack>
                </Typography>
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
        sortComparator: (a: string, b: string) => {
          const aName = a === UNSET_MANAGER_ID ? 'ZZZ' : findManagerName(a);
          const bName = b === UNSET_MANAGER_ID ? 'ZZZ' : findManagerName(b);
          return aName.localeCompare(bName);
        },
        valueOptions: params => [
          { value: UNSET_MANAGER_ID, label: '[unset]' },
          ...loaderData.identities.list
            .filter(i => i.id !== (params.row as IdentityData).id)
            .map(identity => ({ value: identity.id, label: identity.displayName })),
        ],
        editable: true,
        renderCell: params => (
          <Box fontSize="small" sx={{ cursor: 'pointer' }}>
            {params.value && params.value !== UNSET_MANAGER_ID ?
              findManagerName(params.value as string)
            : '...'}
          </Box>
        ),
      },
      { field: 'id', headerName: 'Roakit ID', minWidth: 150 },
      {
        field: 'firebaseId',
        headerName: 'Firebase ID',
        minWidth: 150,
        renderCell: params => {
          return params.value ?
              <Box whiteSpace="noWrap" sx={ellipsisSx}>
                {params.value as string}
              </Box>
            : <IconButton
                title="Allow the user to login to ROAKIT"
                onClick={() =>
                  submit(
                    { createFirebaseUserForEmail: (params.row as IdentityData).email ?? null },
                    postJsonOptions
                  )
                }
              >
                <AddCircleIcon fontSize="small" />
              </IconButton>;
        },
      },
    ];
  }, [loaderData.identities, submit]);

  const accountReviewCols = useMemo<GridColDef[]>(
    () => [
      { field: 'id', headerName: 'Account ID', minWidth: 200 },
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
      <Snackbar
        open={!!confirmation}
        autoHideDuration={3000}
        onClose={(_, reason?: string) => {
          if (reason === 'clickaway') {
            return;
          }
          setConfirmation('');
        }}
        message={confirmation}
      />
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
          {!!error && (
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
            rowHeight={65}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'name', sort: 'asc' as GridSortDirection }] },
            }}
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
        <Alert severity="warning" sx={{ mb: 2 }}>
          We found activity for these accounts although they are not listed in the directory.
        </Alert>
        <DataGrid
          columns={accountReviewCols}
          rows={loaderData.accountsToReview}
          {...dataGridCommonProps}
          rowHeight={50}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: 'name', sort: 'asc' as GridSortDirection }] },
          }}
        />
      </TabPanel>
    </App>
  );
}
