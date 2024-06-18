import {
  AddCircle as AddCircleIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Download as DownloadIcon,
  GitHub as GitHubIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Divider,
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
import { DataGrid, GridActionsCellItem, GridColDef, GridSortDirection } from '@mui/x-data-grid';
import {
  Link as RemixLink,
  ShouldRevalidateFunction,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react';
import { ActionFunctionArgs, LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState } from 'react';
import App from '../components/App';
import CodePopover, { type CodePopoverContent } from '../components/CodePopover';
import TabPanel from '../components/TabPanel';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import {
  dataGridCommonProps,
  dateColDef,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import { auth, firestore } from '../firebase.server';
import { fetchAccountsToReview, fetchIdentities } from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import {
  CONFLUENCE_FEED_TYPE,
  FEED_TYPES,
  GITHUB_FEED_TYPE,
  JIRA_FEED_TYPE,
  type Account,
  type Identity,
} from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, errorAlert, internalLinkSx, loaderErrorResponse } from '../utils/jsxUtils';
import { Role, View } from '../utils/rbac';

const logger = pino({ name: 'route:identities' });

const MAX_IMPORT = 500;
const UNSET_MANAGER_ID = '_UNSET_MANAGER_';

const UNKNOWN_EMAIL_IMPORT = '<EMAIL_REPLACE_ME>';

const roleLabels = [
  { value: Role.Admin, label: 'Administrator' },
  { value: Role.Monitor, label: 'Monitor' },
  { value: Role.Contributor, label: 'Contributor' },
];

export const meta = () => [{ title: 'Contributors Admin | ROAKIT' }];

export const shouldRevalidate: ShouldRevalidateFunction = ({ actionResult }) => {
  const actionStatus = (actionResult as ActionResponse)?.status?.code;
  return actionStatus === 'imported' || actionStatus === 'firebaseUserCreated';
};

const VIEW = View.Users;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  if (sessionData.role !== Role.Admin) {
    throw new Response(null, { status: 403 });
  }
  try {
    const [identities, fetchedAccountsToReview] = await Promise.all([
      fetchIdentities(sessionData.customerId!),
      fetchAccountsToReview(sessionData.customerId!),
    ]);
    const accountsFromIdentities = Object.keys(identities.accountMap);
    const dedupe = new Set<string>();
    const accountsToReview: Account[] = [];

    fetchedAccountsToReview.forEach(account => {
      if (dedupe.has(account.id)) {
        return;
      }
      dedupe.add(account.id);
      if (!accountsFromIdentities.includes(account.id)) {
        accountsToReview.push(account);
      }
    });
    return { ...sessionData, identities, accountsToReview };
  } catch (e) {
    logger.error(e);
    throw loaderErrorResponse(e);
  }
};

interface JsonRequest {
  identityId?: string;
  managerId?: string;
  userId?: string;
  role?: Role;
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
  const sessionData = await loadSession(request, VIEW);
  const jsonRequest = (await request.json()) as JsonRequest;

  // update manager
  if (jsonRequest.identityId) {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/identities/${jsonRequest.identityId}`)
        .update({
          managerId: jsonRequest.managerId === UNSET_MANAGER_ID ? '' : jsonRequest.managerId,
        });
      return { status: { code: 'userUpdated', message: "User's team updated" } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save user') };
    }
  }

  // update role
  if (jsonRequest.userId && jsonRequest.role) {
    try {
      await firestore.doc(`users/${jsonRequest.userId}`).update({ role: jsonRequest.role });
      return { status: { code: 'userUpdated', message: "User's role updated" } };
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
      const [email, displayName, managerId, jiraId, gitHubId] = account
        .split(',')
        .map(f => f.trim());
      if (!email || email === UNKNOWN_EMAIL_IMPORT) {
        continue;
      }
      importCount++;
      batch.set(identitiesColl.doc(), {
        dateCreated,
        managerId,
        displayName,
        email,
        accounts: [
          { feedId: 2, type: 'jira', id: jiraId, name: displayName },
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
    const user = await auth.createUser({
      email: jsonRequest.createFirebaseUserForEmail,
      emailVerified: true,
    });
    await auth.setCustomUserClaims(user.uid, { customerId: sessionData.customerId });
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
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [confirmation, setConfirmation] = useState('false');
  const [error, setError] = useState('');

  useEffect(() => {
    setIdentities(loaderData.identities.list);
  }, [loaderData.identities.list]);

  useEffect(() => {
    if (!actionData?.status) {
      setConfirmation('');
    } else if (actionData?.status?.message) {
      setConfirmation(actionData?.status?.message);
      setImports('');
    }
  }, [actionData?.status]);

  const identityCols = useMemo<GridColDef[]>(() => {
    const findManagerName = (identityId: string) =>
      loaderData.identities.list.find(i => i.id === identityId)?.displayName ?? 'unknown';
    return [
      {
        field: 'displayName',
        headerName: 'Name',
        renderCell: params => {
          const id = (params.row as Identity).id;
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
      { field: 'email', headerName: 'Email' },
      {
        field: 'accounts',
        headerName: 'Accounts',
        flex: 1,
        sortable: false,
        renderCell: params => {
          return (params.value as Identity['accounts']).map((account, i) => {
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
                    <Box>{account.id || 'n/a'}</Box>
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
        type: 'singleSelect',
        sortComparator: (a: string, b: string) => {
          const aName = a === UNSET_MANAGER_ID ? 'ZZZ' : findManagerName(a);
          const bName = b === UNSET_MANAGER_ID ? 'ZZZ' : findManagerName(b);
          return aName.localeCompare(bName);
        },
        valueOptions: params => [
          { value: UNSET_MANAGER_ID, label: '[unset]' },
          ...loaderData.identities.list
            .filter(i => i.id !== (params.row as Identity).id)
            .map(identity => ({ value: identity.id, label: identity.displayName })),
        ],
        editable: true,
        renderCell: params => (
          <Box height="45px" display="flex" alignItems="center">
            <Button endIcon={<ArrowDropDownIcon />} sx={{ ml: -1, textTransform: 'none' }}>
              {params.value && params.value !== UNSET_MANAGER_ID ?
                findManagerName(params.value as string)
              : '...'}
            </Button>
          </Box>
        ),
      },
      { field: 'id', headerName: 'Roakit ID', minWidth: 150 },
      {
        field: 'firebaseId',
        headerName: 'Login ID',
        valueGetter: (_, row: Identity) => row.user!.id,
        renderCell: params => {
          return params.value ?
              <Box whiteSpace="noWrap" sx={ellipsisSx}>
                {params.value as string}
              </Box>
            : <Box display="flex" height="100%" alignItems="center">
                <IconButton
                  title="Allow the user to login to ROAKIT"
                  onClick={() =>
                    submit(
                      { createFirebaseUserForEmail: (params.row as Identity).email ?? null },
                      postJsonOptions
                    )
                  }
                  sx={{ ml: -1 }}
                >
                  <AddCircleIcon fontSize="small" />
                </IconButton>
              </Box>;
        },
      },
      {
        field: 'role',
        headerName: 'Role',
        type: 'singleSelect',
        minWidth: 150,
        editable: true,
        valueGetter: (v_, row: Identity) => row.user!.role,
        valueSetter: (value: Role, row: Identity) => ({
          ...row,
          user: { ...row.user, role: value },
        }),
        valueOptions: () => roleLabels,
        renderCell: params => {
          const user = (params.row as Identity).user;
          return user?.id ?
              <Box height="45px" display="flex" alignItems="center">
                <Button endIcon={<ArrowDropDownIcon />} sx={{ ml: -1, textTransform: 'none' }}>
                  {roleLabels.find(r => r.value === params.value)?.label}
                </Button>
              </Box>
            : null;
        },
      },
      viewJsonActionsColDef({}, (element: HTMLElement, content: unknown) =>
        setCodePopover({ element, content })
      ),
    ];
  }, [loaderData.identities, submit]);

  const accountReviewCols = useMemo<GridColDef[]>(
    () => [
      {
        field: 'id',
        headerName: 'Account ID',
        flex: 1,
        renderCell: params => {
          const id = (params.row as Identity).id;
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
        field: 'type',
        headerName: 'Source',
        minWidth: 80,
        valueGetter: value => (value ? FEED_TYPES.find(f => f.type === value)?.label : value),
      },
      { field: 'name', headerName: 'Name', minWidth: 250 },
      dateColDef({
        field: 'createdTimestamp',
        valueGetter: value => (value ? new Date(value) : value),
      }),
      {
        field: 'actions',
        type: 'actions',
        getActions: params => [
          <GridActionsCellItem
            key={1}
            icon={<UploadIcon fontSize="small" />}
            onClick={() => {
              const account = params.row as Account;
              setImports(
                (imports ? `${imports}\n` : '') +
                  UNKNOWN_EMAIL_IMPORT +
                  ',' +
                  (account.name ?? '') +
                  ',' +
                  (account.type === JIRA_FEED_TYPE || account.type === CONFLUENCE_FEED_TYPE ?
                    account.id
                  : '') +
                  ',' +
                  (account.type === GITHUB_FEED_TYPE ? account.id : '')
              );
            }}
            label="Prefill Import List"
          />,
        ],
      },
    ],
    [imports]
  );

  enum UsersTab {
    Directory,
    NeedsReview,
  }

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      showProgress={navigation.state !== 'idle'}
    >
      {errorAlert(actionData?.error)}
      {errorAlert(error)}
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{ linkifyIdentityId: true }}
      />
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
      <Stack>
        <Stack direction="row" mx={3}>
          <TextField
            label=" CSV list to import"
            value={imports}
            fullWidth
            multiline
            minRows={3}
            maxRows={15}
            helperText={
              <Stack direction="row">
                <Box fontWeight={600} mr={2}>
                  Format:
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  divider={<Divider orientation="vertical" flexItem />}
                >
                  <Box>email (required)</Box>
                  <Box>name</Box>
                  <Box>manager Roakit ID</Box>
                  <Box>Jira ID</Box>
                  <Box>GitHub username</Box>
                </Stack>
              </Stack>
            }
            placeholder="jdoe@example.com, John Doe, x7jfRAz1sSko911234, l1b78K4798TBj3pPe47k, jdoe
jsmith@example.com, Jane Smith,, qyXNw7qryWGENPNbTnZW,"
            size="small"
            onChange={e => {
              setError('');
              setImports(e.target.value);
            }}
            inputProps={{
              style: {
                fontFamily: 'Roboto Mono, monospace',
                fontSize: '.8rem',
                backgroundColor: grey[100],
                padding: '5px',
              },
            }}
            sx={{ mt: 5 }}
          />
          <Box ml={3} mb={4} alignSelf="flex-end">
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
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 1 }}>
          <Tabs
            variant="scrollable"
            value={tabValue}
            onChange={(_, newValue: number) => setTabValue(newValue)}
          >
            <Tab label="Directory" id={`tab-${UsersTab.Directory}`} />
            <Tab label="Needs Review" id={`tab-${UsersTab.NeedsReview}`} />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={UsersTab.Directory}>
          <Stack>
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
              processRowUpdate={(updatedRow: Identity, oldRow: Identity) => {
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
                } else if (updatedRow.user?.role && updatedRow.user.role !== oldRow.user?.role) {
                  if (!oldRow.user?.id) {
                    return oldRow;
                  }
                  setIdentities(
                    identities.map(identity =>
                      identity.id === updatedRow.id ?
                        { ...identity, user: updatedRow.user }
                      : identity
                    )
                  );
                  submit(
                    { userId: updatedRow.user.id ?? null, role: updatedRow.user.role ?? null },
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
              sorting: {
                sortModel: [{ field: 'createdTimestamp', sort: 'desc' as GridSortDirection }],
              },
            }}
          />
        </TabPanel>
      </Stack>
    </App>
  );
}
