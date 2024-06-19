import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Unstable_Grid2 as Grid,
  Stack,
} from '@mui/material';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useNavigation } from '@remix-run/react';
import dayjs from 'dayjs';
import pino from 'pino';
import { useEffect, useState } from 'react';
import App from '../components/App';
import ActiveContributors from '../components/dashboard/ActiveContributors.';
import ActivitiesByInitiative from '../components/dashboard/ActivitiesByInitiative';
import ContributorsByInitiative from '../components/dashboard/ContributorsByInitiative';
import EffortByInitiative from '../components/dashboard/EffortByInitiative';
import Priorities from '../components/dashboard/Priorities';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
} from '../firestore.server/fetchers.server';
import { updateInitiativeCounters } from '../firestore.server/updaters.server';
import { identifyAccounts } from '../utils/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateRangeLabels, formatYYYYMMDD } from '../utils/dateUtils';
import { errorAlert, loaderErrorResponse, loginWithRedirectUrl } from '../utils/jsxUtils';
import { View } from '../utils/rbac';
import { GroupedActivitiesResponse } from './fetcher.grouped-activities';

const logger = pino({ name: 'route:dashboard' });

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Dashboard;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    // retrieve initiatives and users
    const [fetchedInitiatives, launchItems, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);

    // update initiative counters every hour at most [this could be done at ingestion time or triggered in a cloud function]
    const initiatives = await updateInitiativeCounters(sessionData.customerId!, fetchedInitiatives);

    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return { ...sessionData, actors, initiatives, launchItems };
  } catch (e) {
    logger.error(e);
    throw loaderErrorResponse(e);
  }
};

export default function Dashboard() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const groupedActivitiesFetcher = useFetcher();
  const groupedActivitiesResponse = groupedActivitiesFetcher.data as GroupedActivitiesResponse;
  const [dateFilter, setDateFilter] = useState(
    loaderData.dateFilter ?? { dateRange: DateRange.OneDay, endDay: formatYYYYMMDD(dayjs()) }
  );
  const dateRangeLabel = dateRangeLabels[dateFilter.dateRange];

  // load grouped activities
  useEffect(() => {
    groupedActivitiesFetcher.load(
      `/fetcher/grouped-activities/?dateRange=${dateFilter.dateRange}&endDay=${dateFilter.endDay}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  useEffect(() => {
    if (groupedActivitiesResponse?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [groupedActivitiesResponse?.error, navigate]);

  const charts = (
    <Stack spacing={3} m={3} onClick={e => e.stopPropagation()}>
      <Grid container spacing={5}>
        <EffortByInitiative
          type="initiatives"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <EffortByInitiative
          type="launchItems"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.launchItems}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <Priorities
          groupedActivities={groupedActivitiesResponse}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <ContributorsByInitiative
          type="initiatives"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <ContributorsByInitiative
          type="launchItems"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.launchItems}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
      </Grid>
      {!!groupedActivitiesResponse?.initiatives?.length && (
        <Accordion
          variant="outlined"
          disableGutters
          defaultExpanded={false}
          sx={{ '& .MuiAccordionSummary-content': { fontSize: 'small' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            Activity Categories by Goal
          </AccordionSummary>
          <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
            <Grid container spacing={5}>
              <ActivitiesByInitiative
                type="initiatives"
                groupedActivities={groupedActivitiesResponse}
                initiatives={loaderData.initiatives}
                dateRangeLabel={dateRangeLabel}
                isLoading={groupedActivitiesFetcher.state === 'loading'}
              />
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}
      {!!groupedActivitiesResponse?.launchItems?.length && (
        <Accordion
          variant="outlined"
          disableGutters
          defaultExpanded={false}
          sx={{ '& .MuiAccordionSummary-content': { fontSize: 'small' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            Activity Categories by Launch
          </AccordionSummary>
          <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
            <Grid container spacing={5}>
              <ActivitiesByInitiative
                type="launchItems"
                groupedActivities={groupedActivitiesResponse}
                initiatives={loaderData.launchItems}
                dateRangeLabel={dateRangeLabel}
                isLoading={groupedActivitiesFetcher.state === 'loading'}
              />
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}
      {groupedActivitiesResponse?.topActors &&
        Object.keys(groupedActivitiesResponse.topActors).length > 0 && (
          <Accordion
            variant="outlined"
            disableGutters
            defaultExpanded
            sx={{ '& .MuiAccordionSummary-content': { fontSize: 'small' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>Active Contributors</AccordionSummary>
            <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
              <Grid container spacing={5}>
                <ActiveContributors
                  groupedActivities={groupedActivitiesResponse}
                  actors={loaderData.actors}
                  isLoading={groupedActivitiesFetcher.state === 'loading'}
                />
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
    </Stack>
  );

  return (
    <App
      view={VIEW}
      role={loaderData.role}
      isLoggedIn={loaderData.isLoggedIn}
      isNavOpen={loaderData.isNavOpen}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={navigation.state !== 'idle' || groupedActivitiesFetcher.state !== 'idle'}
    >
      {errorAlert(groupedActivitiesResponse?.error?.message)}
      {charts}
    </App>
  );
}
