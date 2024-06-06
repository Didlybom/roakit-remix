import type { Params } from '@remix-run/react';
import type { SessionData } from './sessionCookie.server';

export enum View {
  Index,

  Dashboard,
  ActivitySummaries,
  Activity,
  ActivityUser,

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
  FetcherSummaries,

  SummaryMulti,
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
    case View.ActivitySummaries:
    case View.Activity:
    case View.ActivityUser:
    case View.FetcherActivitiesPage:
    case View.RawEvent:
    case View.FetcherGroupedActivities:
    case View.SummaryMulti:
    case View.AI:
      throwIf(sessionData.role !== Role.Admin && sessionData.role !== Role.Monitor);
      break;

    case View.Summary:
    case View.FetcherSummaries:
    case View.FetcherActivities:
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
    case View.Login:
    case View.Logout:
    case View.Info:
      // authorized to all
      break;
  }
};
