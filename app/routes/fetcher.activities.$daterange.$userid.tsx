import { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities, fetchTicketPriorities } from '../firestore.server/fetchers.server';
import { findTicket } from '../schemas/activityFeed';
import { ActivityRecord } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse, jsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.activities' });

export interface ActivityResponse {
  error?: ErrorField;
  activities?: ActivityRecord;
}

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<ActivityResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return errorJsonResponse('Fetching activities failed. Invalid session.', 401);
  }
  if (!params.daterange || !params.userid) {
    return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
  }
  try {
    const startDate = dateFilterToStartDate(params.daterange as DateRange);
    if (!startDate) {
      return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
    }
    const userIds = params.userid === '*' ? undefined : params.userid.split(',');
    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate,
      userIds,
      includesMetadata: true,
    });
    const activityRecord: ActivityRecord = {};

    const ticketIdsToFetch = new Set<string>();
    const activityTickets = new Map<string, string>();
    [...activities].forEach(([activityId, activity]) => {
      activityRecord[activityId] = activity;

      // find priority from metadata for activities missing one
      if ((!activity.priority || activity.priority === -1) && activity.metadata) {
        const ticket = findTicket(activity.metadata);
        if (ticket) {
          ticketIdsToFetch.add(ticket);
          activityTickets.set(activityId, ticket);
        }
      }
    });
    if (ticketIdsToFetch.size > 0) {
      const tickets = await fetchTicketPriorities(sessionData.customerId!, [...ticketIdsToFetch]);
      activityTickets.forEach((activityTicket, activityId) => {
        // add the found priority to the activity
        activityRecord[activityId].priority = tickets[activityTicket];
      });
    }

    return jsonResponse({ activities: activityRecord });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching activities failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
