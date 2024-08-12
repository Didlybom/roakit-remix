import type { Params } from '@remix-run/react';
import type { SessionData } from './sessionCookie.server';

export enum View {
  Index,

  Dashboard,
  ActivitySummary,
  AllActivity,
  ActivityUser,
  Feed,
  Tickets,

  Status,
  Summary,

  Initiatives,
  LaunchItems,
  Users,
  Settings,

  Login,
  Logout,
  Info,

  RawEvent,
  UsersCSV,
  FetcherActivities,
  FetcherActivitiesPage,
  FetcherGroupedActivities,
  FetcherStatuses,
  FetcherSummaries,
  FetcherLaunchStats,
  FetcherTickets,

  Impersonation,
  AI,
  Developer,
}

export enum Role {
  Admin = 'admin',
  Monitor = 'monitor',
  Contributor = 'contributor',
}

export const Roles = [Role.Admin, Role.Monitor, Role.Contributor] as const;

export const DEFAULT_ROLE = Role.Contributor;

const throwIf = (condition: boolean) => {
  if (condition) {
    throw new Response(null, { status: 403 });
  }
};

export const checkAccess = (
  view: View,
  sessionData: SessionData,
  request: Request,
  params?: Params<string>
) => {
  switch (view) {
    case View.Dashboard:
    case View.ActivitySummary:
    case View.AllActivity:
    case View.ActivityUser:
    case View.RawEvent:
    case View.FetcherGroupedActivities:
    case View.FetcherLaunchStats:
    case View.Impersonation:
    case View.AI:
      throwIf(sessionData.role !== Role.Admin && sessionData.role !== Role.Monitor);
      break;

    case View.Status:
    case View.Summary:
    case View.FetcherStatuses:
    case View.FetcherSummaries:
    case View.FetcherActivities:
    case View.FetcherTickets:
      throwIf(!params);
      // userid param not allowed for non admins
      throwIf(
        sessionData.role !== Role.Admin && sessionData.role !== Role.Monitor && !!params?.userid
      );
      break;

    case View.Initiatives:
    case View.LaunchItems:
    case View.Users:
    case View.UsersCSV:
    case View.Settings:
      throwIf(sessionData.role !== Role.Admin);
      break;

    case View.Developer:
      throwIf(request.headers.get('host') !== 'localhost:3000');
      break;

    case View.Index:
    case View.Feed:
    case View.Tickets:
    case View.Login:
    case View.Logout:
    case View.Info:
    case View.FetcherActivitiesPage:
      // authorized to all
      break;
  }
};
