import {
  AccountCircle as AccountIcon,
  AddCircle as AddCircleIcon,
  Download as DownloadIcon,
  GitHub as GitHubIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid2 as Grid,
  IconButton,
  Link,
  Pagination,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type {
  GridColDef,
  GridRenderCellParams,
  GridRowParams,
  GridSortDirection,
  GridValueOptionsParams,
} from '@mui/x-data-grid';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import type { ShouldRevalidateFunction } from '@remix-run/react';
import {
  Link as RemixLink,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/server-runtime';
import pluralize from 'pluralize';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import App from '../components/App';
import CodePopover, { type CodePopoverContent } from '../components/CodePopover';
import TabPanel from '../components/TabPanel';
import DataGridWithSingleClickEditing from '../components/datagrid/DataGridWithSingleClickEditing';
import EditMultipleSelect from '../components/datagrid/EditMultipleSelect';
import EditableCellField from '../components/datagrid/EditableCellField';
import {
  dataGridCommonProps,
  dateColDef,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import SearchField from '../components/forms/SearchField';
import { auth, firestore } from '../firebase.server';
import {
  fetchAccountsToReview,
  fetchGroups,
  fetchIdentities,
} from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import { accountUrlToWeb } from '../processors/activityFeed';
import {
  CONFLUENCE_FEED_TYPE,
  FEED_TYPES,
  GITHUB_FEED_TYPE,
  JIRA_FEED_TYPE,
  type Account,
  type Identity,
} from '../types/types';
import { loadAndValidateSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, errorAlert, linkSx, loaderErrorResponse } from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { areArrayEqual } from '../utils/mapUtils';
import { Role, View } from '../utils/rbac';
import theme from '../utils/theme';

const MAX_IMPORT = 500;

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
  const sessionData = await loadAndValidateSession(request, VIEW);
  try {
    const [identities, groups, fetchedAccountsToReview] = await Promise.all([
      fetchIdentities(sessionData.customerId!),
      fetchGroups(sessionData.customerId!),
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
    return { ...sessionData, identities, groups, accountsToReview };
  } catch (e) {
    getLogger('route:users').error(e);
    throw loaderErrorResponse(e);
  }
};

interface ActionRequest {
  identityId?: string;
  managerId?: string;
  groups?: string[];
  userId?: string;
  role?: Role;
  imports?: string;
  createFirebaseUserForEmail?: string;
}

interface ActionResponse {
  status?: { code: 'imported' | 'userUpdated' | 'firebaseUserCreated'; message?: string };
  error?: string;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadAndValidateSession(request, VIEW);
  const actionRequest = (await request.json()) as ActionRequest;

  // update manager
  if (actionRequest.managerId != null) {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/identities/${actionRequest.identityId}`)
        .update({
          managerId: actionRequest.managerId,
        });
      return { status: { code: 'userUpdated', message: "User's team updated" } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save user') };
    }
  }

  // update groups
  if (actionRequest.groups != null) {
    try {
      await firestore
        .doc(`customers/${sessionData.customerId!}/identities/${actionRequest.identityId}`)
        .update({ groups: actionRequest.groups ?? [] });
      return { status: { code: 'userUpdated', message: "User's groups updated" } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save user') };
    }
  }

  // update role
  if (actionRequest.userId && actionRequest.role) {
    try {
      await firestore.doc(`users/${actionRequest.userId}`).update({ role: actionRequest.role });
      return { status: { code: 'userUpdated', message: "User's role updated" } };
    } catch (e) {
      return { error: errMsg(e, 'Failed to save user') };
    }
  }

  // import
  if (actionRequest.imports) {
    const identitiesColl = firestore.collection(`customers/${sessionData.customerId}/identities`);
    const batch = firestore.batch();

    const accounts = actionRequest.imports.split(/\r|\n/);

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
        displayName,
        email,
        managerId: managerId ?? '',
        accounts: [
          ...(jiraId ? [{ feedId: 2, type: 'jira', id: jiraId, name: displayName }] : []),
          ...(gitHubId ? [{ feedId: 1, type: 'github', id: gitHubId, name: '' }] : []),
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
  if (actionRequest.createFirebaseUserForEmail) {
    const user = await auth.createUser({
      email: actionRequest.createFirebaseUserForEmail,
      emailVerified: true,
    });
    await auth.setCustomUserClaims(user.uid, { customerId: sessionData.customerId });
    await firestore.collection('users').add({
      customerId: sessionData.customerId,
      email: actionRequest.createFirebaseUserForEmail,
    });
    return { status: { code: 'firebaseUserCreated', message: 'Firebase user created' } };
  }

  return {};
};

type IdentityRow = Identity & { hovered?: boolean };

export default function Users() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [tabValue, setTabValue] = useState(0);
  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [imports, setImports] = useState('');
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [searchTerm] = useDebounce(searchFilter.trim().toLowerCase(), 50);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setIdentities(
      loaderData.identities.list.map(i => ({
        ...i,
        groupId: i.groups?.length ? i.groups[0] : undefined,
      }))
    );
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
    const findGroupName = (groupId: string) =>
      loaderData.groups.find(i => i.id === groupId)?.name ?? 'unknown';

    return [
      {
        field: 'displayName',
        headerName: 'Name',
        flex: 1,
        renderCell: (params: GridRenderCellParams<Identity, string>) => (
          <Link
            tabIndex={params.tabIndex}
            href={`/feed/${encodeURI(params.row.id)}`}
            title="View feed"
            sx={linkSx}
          >
            {params.value}
          </Link>
        ),
      },
      { field: 'email', headerName: 'Email', flex: 1 },
      {
        field: 'accounts',
        headerName: 'Accounts',
        sortable: false,
        renderCell: (params: GridRenderCellParams<Identity, Account[]>) =>
          params.value ?
            <Stack direction="row" spacing={1} height="100%" alignItems={'center'}>
              {params.value.map((account, i) => {
                const color = !account.id ? theme.palette.error.main : 'inherited';
                let icon;
                if (account.type === 'github') {
                  icon = <GitHubIcon sx={{ color, fontSize: '12px' }} />;
                } else if (account.type === 'jira') {
                  icon = <JiraIcon sx={{ color, fontSize: '12px' }} />;
                } else {
                  icon = <AccountIcon sx={{ fontSize: '12px' }} />;
                }
                return (
                  <Tooltip
                    key={i}
                    title={account.id ? `${account.id} ${account.name}` : 'No account'}
                  >
                    {account.url ?
                      <Link
                        href={account.url}
                        target="_blank"
                        sx={{ cursor: 'pointer', ...ellipsisSx }}
                      >
                        {icon}
                      </Link>
                    : icon}
                  </Tooltip>
                );
              })}
            </Stack>
          : null,
      },
      {
        field: 'managerId',
        headerName: 'Team',
        type: 'singleSelect',
        flex: 1,
        sortComparator: (a: string, b: string) => {
          const aName = !a ? 'ZZZ' : findManagerName(a);
          const bName = !b ? 'ZZZ' : findManagerName(b);
          return aName.localeCompare(bName);
        },
        valueOptions: (params: GridValueOptionsParams<IdentityRow>) => [
          { value: '', label: '[unset]' },
          ...loaderData.identities.list
            .filter(i => i.id !== params.row?.id)
            .map(identity => ({ value: identity.id, label: identity.displayName })),
        ],
        editable: true,
        renderCell: (params: GridRenderCellParams<IdentityRow, string>) => (
          <Box height="100%" display="flex" alignItems="center">
            <EditableCellField
              layout="dropdown"
              hovered={params.row.hovered}
              label={params.value ? findManagerName(params.value) : null}
            />
          </Box>
        ),
      },
      {
        field: 'groups',
        headerName: 'Group',
        type: 'singleSelect', // actually multiple
        flex: 1,
        sortComparator: (a: string, b: string) => {
          const aName = !a ? 'ZZZ' : findGroupName(a);
          const bName = !b ? 'ZZZ' : findGroupName(b);
          return aName.localeCompare(bName);
        },
        valueOptions: () => [
          { value: '', label: '[unset]' },
          ...loaderData.groups.map(group => ({ value: group.id, label: group.name })),
        ],
        editable: true,
        renderEditCell: params => (
          <EditMultipleSelect
            {...params}
            options={loaderData.groups.map(group => ({ value: group.id, label: group.name }))}
          />
        ),
        renderCell: (params: GridRenderCellParams<IdentityRow, string[]>) => (
          <Box height="100%" display="flex" alignItems="center">
            <EditableCellField
              layout="dropdown"
              hovered={params.row.hovered}
              label={
                params.value ? params.value.map(value => findGroupName(value)).join(', ') : null
              }
            />
          </Box>
        ),
      },
      { field: 'id', headerName: 'Roakit ID', minWidth: 150 },
      {
        field: 'firebaseId',
        headerName: 'Login ID',
        valueGetter: (_, row: Identity) => row.user!.id,
        renderCell: (params: GridRenderCellParams<IdentityRow, string>) => {
          return params.value ?
              <Box whiteSpace="noWrap" sx={ellipsisSx}>
                {params.value}
              </Box>
            : <Box display="flex" height="100%" alignItems="center">
                <IconButton
                  tabIndex={params.tabIndex}
                  title="Allow the user to login to ROAKIT"
                  onClick={() =>
                    submit(
                      { createFirebaseUserForEmail: params.row.email ?? null },
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
        sortComparator: (a: string, b: string) => {
          return (a ?? 'ZZZ').localeCompare(b ?? 'ZZZ');
        },
        valueGetter: (_, row: IdentityRow) => (row.user!.id ? row.user!.role : undefined),
        valueSetter: (value: Role, row: IdentityRow) => ({
          ...row,
          user: { ...row.user, role: value },
        }),
        valueOptions: () => roleLabels,
        renderCell: (params: GridRenderCellParams<IdentityRow, string>) =>
          params.row.user?.id ?
            <Box height="100%" display="flex" alignItems="center">
              <EditableCellField
                layout="dropdown"
                hovered={params.row.hovered}
                label={roleLabels.find(r => r.value === params.value)?.label}
              />
            </Box>
          : null,
      },
      viewJsonActionsColDef({}, (element: HTMLElement, content: unknown) =>
        setCodePopover({ element, content })
      ),
    ];
  }, [loaderData.groups, loaderData.identities.list, submit]);

  const accountReviewCols = useMemo<GridColDef[]>(
    () => [
      {
        field: 'id',
        headerName: 'Account ID',
        flex: 1,
        renderCell: (params: GridRenderCellParams<Account, string>) => (
          <Link
            tabIndex={params.tabIndex}
            href={`/feed/${encodeURI(params.row.id)}`}
            title="View feed"
            sx={linkSx}
          >
            {params.value}
          </Link>
        ),
      },
      {
        field: 'type',
        headerName: 'Source',
        minWidth: 80,
        valueGetter: value => (value ? FEED_TYPES.find(f => f.type === value)?.label : value),
        renderCell: (params: GridRenderCellParams<Account, string>) =>
          params.row.url ?
            <Link
              tabIndex={params.tabIndex}
              href={accountUrlToWeb(params.row)}
              title="View account source"
              target="_blank"
              sx={linkSx}
            >
              {params.value}
            </Link>
          : params.value,
      },
      { field: 'name', headerName: 'Name', minWidth: 250 },
      dateColDef({
        field: 'createdTimestamp',
        valueGetter: value => (value ? new Date(value) : value),
      }),
      {
        field: 'actions',
        type: 'actions',
        getActions: (params: GridRowParams<Account>) => [
          <GridActionsCellItem
            key={1}
            icon={<UploadIcon fontSize="small" />}
            onClick={() => {
              const account = params.row;
              setImports(
                (imports ? `${imports}\n` : '') +
                  UNKNOWN_EMAIL_IMPORT +
                  ',' +
                  (account.name ?? '') +
                  ',,' + // empty manager id
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

  const searchBar = useCallback(
    (rowCount: number) => (
      <Grid container alignItems="center" rowSpacing={2} mb={1}>
        <Grid>
          <SearchField
            title="Search"
            value={searchFilter}
            setValue={setSearchFilter}
            sx={{ width: '12ch', minWidth: { xs: '110px', sm: '250px' } }}
          />
        </Grid>
        <Grid flex={1} />
        <Grid>
          <Pagination
            siblingCount={0}
            count={Math.round(rowCount / paginationModel.pageSize)}
            page={paginationModel.page + 1}
            showFirstButton
            showLastButton
            onChange={(_, page) => setPaginationModel({ ...paginationModel, page: page - 1 })}
            size="small"
          />
        </Grid>
      </Grid>
    ),
    [paginationModel, searchFilter]
  );

  const filteredIdentities =
    (tabValue as UsersTab) === UsersTab.Directory ?
      identities.filter(
        identity =>
          !searchTerm ||
          (identity.displayName && identity.displayName.toLowerCase().indexOf(searchTerm) >= 0) ||
          (identity.email && identity.email.toLowerCase().indexOf(searchTerm) >= 0) ||
          identity.id.toLowerCase().indexOf(searchTerm) >= 0 ||
          identity.accounts.some(
            account =>
              account.id.toLowerCase().indexOf(searchTerm) >= 0 ||
              (account.name && account.name.toLowerCase().indexOf(searchTerm) >= 0)
          )
      )
    : [];

  const filteredAccounts =
    (tabValue as UsersTab) === UsersTab.NeedsReview ?
      loaderData.accountsToReview.filter(
        account =>
          !searchTerm ||
          (account.name && account.name.toLowerCase().indexOf(searchTerm) >= 0) ||
          (account.id && account.id.toLowerCase().indexOf(searchTerm) >= 0)
      )
    : [];

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
        onClose={(_, reason) => (reason === 'clickaway' ? null : setConfirmation(''))}
        message={confirmation}
      />
      <Stack>
        <Stack direction="row" mx={3} mt={3}>
          <Stack width="100%">
            <TextField
              label=" CSV list to import"
              value={imports}
              fullWidth
              multiline
              minRows={3}
              maxRows={15}
              placeholder="jdoe@example.com, John Doe, x7jfRAz1sSko911234, l1b78K4798TBj3pPe47k, jdoe
jsmith@example.com, Jane Smith,, qyXNw7qryWGENPNbTnZW,"
              size="small"
              onChange={e => {
                setError('');
                setImports(e.target.value);
              }}
              slotProps={{
                htmlInput: {
                  style: {
                    fontFamily: 'Roboto Mono, monospace',
                    fontSize: '.8rem',
                    backgroundColor: theme.palette.grey[100],
                    padding: '5px',
                  },
                },
              }}
            />
            <Typography variant="caption">
              <Stack direction="row" mt="4px">
                <Box fontWeight={600} mx={2}>
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
            </Typography>
          </Stack>
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
            {searchBar(filteredIdentities.length)}
            <DataGridWithSingleClickEditing
              columns={identityCols}
              rows={filteredIdentities}
              {...dataGridCommonProps}
              rowHeight={50}
              slotProps={{
                row: {
                  onMouseEnter: e => {
                    const identityId = e.currentTarget.getAttribute('data-id');
                    setIdentities(
                      identities.map(identity => ({
                        ...identity,
                        hovered: identity.id === identityId,
                      }))
                    );
                  },
                  onMouseLeave: () =>
                    setIdentities(identities.map(identity => ({ ...identity, hovered: false }))),
                },
              }}
              paginationModel={paginationModel}
              onPaginationModelChange={newPaginationModel => setPaginationModel(newPaginationModel)}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: 'name', sort: 'asc' as GridSortDirection }] },
              }}
              processRowUpdate={(updatedRow: IdentityRow, oldRow: IdentityRow) => {
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
                } else if (!areArrayEqual(updatedRow.groups, oldRow.groups)) {
                  setIdentities(
                    identities.map(identity =>
                      identity.id === updatedRow.id ?
                        { ...identity, groups: updatedRow.groups }
                      : identity
                    )
                  );
                  submit(
                    { identityId: updatedRow.id, groups: updatedRow.groups ?? null },
                    postJsonOptions
                  );
                } else if (updatedRow.user?.role && updatedRow.user.role !== oldRow.user?.role) {
                  if (!oldRow.user?.id) {
                    return oldRow;
                  }
                  setIdentities(
                    identities.map(i =>
                      i.id === updatedRow.id ? { ...i, user: updatedRow.user } : i
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
          {searchBar(filteredAccounts.length)}
          <DataGrid
            columns={accountReviewCols}
            rows={filteredAccounts}
            {...dataGridCommonProps}
            rowHeight={50}
            paginationModel={paginationModel}
            onPaginationModelChange={newPaginationModel => setPaginationModel(newPaginationModel)}
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
