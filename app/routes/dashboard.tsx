import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Unstable_Grid2 as Grid,
  Stack,
} from '@mui/material';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useNavigation } from '@remix-run/react';
import dayjs from 'dayjs';
import { useEffect, useState, type ReactNode } from 'react';
import App from '../components/App';
import type { GroupedActivities } from '../processors/activityGrouper';
import { identifyAccounts } from '../processors/activityIdentifier';
// import ActiveContributors from '../components/dashboard/ActiveContributors.';
import ArtifactsByInitiative from '../components/dashboard/ArtifactsByInitiative';
import ContributorsByInitiative from '../components/dashboard/ContributorsByInitiative';
import EffortByInitiative from '../components/dashboard/EffortByInitiative';
import PhasesByInitiative from '../components/dashboard/PhasesByInitiative';
import Priorities from '../components/dashboard/Priorities';
import TicketsByInitiative from '../components/dashboard/TicketsByInitiative';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchLaunchItemMap,
} from '../firestore.server/fetchers.server';
import type { GroupedLaunchStats } from '../processors/initiativeGrouper';
import { loadSession } from '../utils/authUtils.server';
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
import type { GroupedLaunchStatsResponse } from './fetcher.launch-stats';

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Dashboard;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    // retrieve initiatives and users
    const [launchItems, accounts, identities] = await Promise.all([
      // fetchInitiativeMap(sessionData.customerId!),
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);

    // update initiative counters every hour at most [this could be done at ingestion time or triggered in a cloud function]
    // const initiatives = await updateInitiativeCounters(sessionData.customerId!, fetchedInitiatives);

    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return { ...sessionData, actors, launchItems };
  } catch (e) {
    getLogger('route:dashboard').error(e);
    throw loaderErrorResponse(e);
  }
};

function AccordionBox({
  title,
  children,
  expanded = true,
}: {
  title: string;
  children: ReactNode;
  expanded?: boolean;
}) {
  return (
    <Accordion
      variant="outlined"
      disableGutters
      defaultExpanded={expanded}
      sx={{ '& .MuiAccordionSummary-content': { fontSize: 'small' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>{title}</AccordionSummary>
      <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
        <Grid container spacing={5}>
          {children}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
}

export default function Dashboard() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const groupedActivitiesFetcher = useFetcher<GroupedActivitiesResponse>();
  const groupedActivitiesResponse = groupedActivitiesFetcher.data as GroupedActivities;
  const launchStatsFetcher = useFetcher<GroupedLaunchStatsResponse>();
  const launchStatsFetcherResponse = launchStatsFetcher.data as GroupedLaunchStats;
  const [dateFilter, setDateFilter] = useState(
    loaderData.dateFilter ?? { dateRange: DateRange.OneDay, endDay: formatYYYYMMDD(dayjs()) }
  );
  const dateRangeLabel = dateRangeLabels[dateFilter.dateRange];

  // load grouped activities and launch stats
  useEffect(() => {
    groupedActivitiesFetcher.load(
      `/fetcher/grouped-activities/?dateRange=${dateFilter.dateRange}&endDay=${dateFilter.endDay}`
    );
    const startDay = dateFilterToStartDate(dateFilter.dateRange, dayjs(dateFilter.endDay));
    if (startDay) {
      launchStatsFetcher.load(
        `/fetcher/launch-stats/?start=${formatYYYYMMDD(startDay)}&end=${dateFilter.endDay}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  useEffect(() => {
    if (
      groupedActivitiesFetcher.data?.error?.status === 401 ||
      launchStatsFetcher.data?.error?.status === 401
    ) {
      navigate(loginWithRedirectUrl());
    }
  }, [
    groupedActivitiesFetcher.data?.error?.status,
    launchStatsFetcher.data?.error?.status,
    navigate,
  ]);

  const charts = (
    <Stack spacing={3} m={3} onClick={e => e.stopPropagation()}>
      <Grid container spacing={5}>
        {/* <EffortByInitiative
          type="initiatives"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        /> */}
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
        {/* <ContributorsByInitiative
          type="initiatives"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        /> */}
        <ContributorsByInitiative
          type="launchItems"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.launchItems}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
      </Grid>
      {/* {!!groupedActivitiesResponse?.initiatives?.length && (
      <AccordionBox title="Activity Categories by Goal">
        <ArtifactsByInitiative
          type="initiatives"
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          dateRangeLabel={dateRangeLabel}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
      </AccordionBox>
      )} */}
      {!!launchStatsFetcherResponse?.launches && (
        <AccordionBox title="Ticket Status by Launch">
          <TicketsByInitiative
            stats={launchStatsFetcherResponse}
            initiatives={loaderData.launchItems}
            dateRangeLabel={dateRangeLabel}
            isLoading={launchStatsFetcher.state === 'loading'}
          />
        </AccordionBox>
      )}
      {!!groupedActivitiesResponse?.launchItems?.length && (
        <AccordionBox title="Activity Categories by Launch">
          <ArtifactsByInitiative
            type="launchItems"
            groupedActivities={groupedActivitiesResponse}
            initiatives={loaderData.launchItems}
            dateRangeLabel={dateRangeLabel}
            isLoading={groupedActivitiesFetcher.state === 'loading'}
          />
        </AccordionBox>
      )}
      {!!groupedActivitiesResponse?.launchItems?.length && (
        <AccordionBox title=" Activity Phases by Launch">
          <PhasesByInitiative
            type="launchItems"
            groupedActivities={groupedActivitiesResponse}
            initiatives={loaderData.launchItems}
            dateRangeLabel={dateRangeLabel}
            isLoading={groupedActivitiesFetcher.state === 'loading'}
          />
        </AccordionBox>
      )}
      {/* {groupedActivitiesResponse?.topActors &&
        Object.keys(groupedActivitiesResponse.topActors).length > 0 && (
         <AccordionBox title="Active Contributors">
            <ActiveContributors
              groupedActivities={groupedActivitiesResponse}
              actors={loaderData.actors}
              isLoading={groupedActivitiesFetcher.state === 'loading'}
            />
        </AccordionBox>
        )} */}
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
