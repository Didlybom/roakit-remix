import { Unstable_Grid2 as Grid, Stack } from '@mui/material';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useNavigation } from '@remix-run/react';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import AccordionBox from '../components/AccordionBox';
import App from '../components/App';
import ActiveContributors from '../components/dashboard/ActiveContributors.';
import ArtifactsByInitiative from '../components/dashboard/ArtifactsByInitiative';
import ContributorsByInitiative from '../components/dashboard/ContributorsByInitiative';
import EffortByInitiative from '../components/dashboard/EffortByInitiative';
import PhasesByInitiative from '../components/dashboard/PhasesByInitiative';
import Priorities from '../components/dashboard/Priorities';
import TicketsByInitiative from '../components/dashboard/TicketsByInitiative';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import type { GroupedActivities } from '../processors/activityGrouper';
import { identifyAccounts } from '../processors/activityIdentifier';
import type { GroupedInitiativeStats } from '../processors/initiativeGrouper';
import { loadAndValidateSession } from '../utils/authUtils.server';
import {
  dateFilterToStartDate,
  DateRange,
  dateRangeLabels,
  formatYYYYMMDD,
} from '../utils/dateUtils';
import { errorAlert, loaderErrorResponse, loginWithRedirectUrl } from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import type { GroupedActivitiesResponse } from './fetcher.grouped-activities';
import type { GroupedInitiativeStatsResponse } from './fetcher.initiative-stats';

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Dashboard;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadAndValidateSession(request, VIEW);
  try {
    // retrieve initiatives and users
    const [initiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return { ...sessionData, actors, initiatives };
  } catch (e) {
    getLogger('route:dashboard').error(e);
    throw loaderErrorResponse(e);
  }
};

export default function Dashboard() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const groupedActivitiesFetcher = useFetcher<GroupedActivitiesResponse>();
  const groupedActivitiesResponse = groupedActivitiesFetcher.data as GroupedActivities;
  const initiativeStatsFetcher = useFetcher<GroupedInitiativeStatsResponse>();
  const initiativeStatsResponse = initiativeStatsFetcher.data as GroupedInitiativeStats;
  const [dateFilter, setDateFilter] = useState(
    loaderData.dateFilter ?? { dateRange: DateRange.OneDay, endDay: formatYYYYMMDD(dayjs()) }
  );
  const dateRangeLabel = dateRangeLabels[dateFilter.dateRange];

  // load grouped activities and initiative stats
  useEffect(() => {
    groupedActivitiesFetcher.load(
      `/fetcher/grouped-activities/?dateRange=${dateFilter.dateRange}&endDay=${dateFilter.endDay}`
    );
    const startDay = dateFilterToStartDate(dateFilter.dateRange, dayjs(dateFilter.endDay));
    if (startDay) {
      initiativeStatsFetcher.load(
        `/fetcher/initiative-stats/?start=${formatYYYYMMDD(startDay)}&end=${dateFilter.endDay}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  useEffect(() => {
    if (
      groupedActivitiesFetcher.data?.error?.status === 401 ||
      initiativeStatsFetcher.data?.error?.status === 401
    ) {
      navigate(loginWithRedirectUrl());
    }
  }, [
    groupedActivitiesFetcher.data?.error?.status,
    initiativeStatsFetcher.data?.error?.status,
    navigate,
  ]);

  const charts = (
    <Stack spacing={3} m={3} onClick={e => e.stopPropagation()}>
      <Grid container spacing={5}>
        <EffortByInitiative
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <Priorities
          groupedActivities={groupedActivitiesResponse}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <ContributorsByInitiative
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
      </Grid>
      {!!initiativeStatsResponse?.initiatives && (
        <AccordionBox title="Ticket Status by Initiative">
          <TicketsByInitiative
            stats={initiativeStatsResponse}
            initiatives={loaderData.initiatives}
            dateRangeLabel={dateRangeLabel}
            isLoading={initiativeStatsFetcher.state === 'loading'}
          />
        </AccordionBox>
      )}
      {!!groupedActivitiesResponse?.initiatives?.length && (
        <AccordionBox title="Activity Types by Initiative">
          <ArtifactsByInitiative
            groupedActivities={groupedActivitiesResponse}
            initiatives={loaderData.initiatives}
            dateRangeLabel={dateRangeLabel}
            isLoading={groupedActivitiesFetcher.state === 'loading'}
          />
        </AccordionBox>
      )}
      {!!groupedActivitiesResponse?.initiatives?.length && (
        <AccordionBox title=" Activity Phases by Initiative">
          <PhasesByInitiative
            groupedActivities={groupedActivitiesResponse}
            initiatives={loaderData.initiatives}
            dateRangeLabel={dateRangeLabel}
            isLoading={groupedActivitiesFetcher.state === 'loading'}
          />
        </AccordionBox>
      )}
      {groupedActivitiesResponse?.topActors &&
        Object.keys(groupedActivitiesResponse.topActors).length > 0 && (
          <AccordionBox title="Active Contributors">
            <ActiveContributors
              groupedActivities={groupedActivitiesResponse}
              actors={loaderData.actors}
              isLoading={groupedActivitiesFetcher.state === 'loading'}
            />
          </AccordionBox>
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
      {errorAlert(groupedActivitiesFetcher.data?.error?.message)}
      {charts}
    </App>
  );
}
