import type { GenerateContentResult } from '@google-cloud/vertexai';
import {
  CUSTOM_EVENT,
  type Activity,
  type ActorRecord,
  type InitiativeRecord,
} from '../types/types';
import { getActivityActionDescription, getActivityDescription } from './activityDescription';
import { formatJson } from './jsxUtils';
import { cloneArray } from './mapUtils';

export const DEFAULT_PROMPT =
  'Output a categorized summary of these activities. Remove duplicates. Without title, introduction, notes and conclusion. Output markdown.';

export const buildActivitySummaryPrompt = (
  activities: Omit<Activity, 'id'>[] | null,
  actors: ActorRecord | null,
  initiatives: InitiativeRecord | null,
  options: {
    activityCount: number;
    inclDates: boolean;
    inclActions: boolean;
    inclContributors: boolean;
  }
) => {
  if (!activities) {
    return '';
  }

  const activityList = cloneArray(activities);
  activityList.splice(options.activityCount);
  let activitiesString = '';
  const dedupe = new Set<string>();
  activityList
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(activity => {
      if (!activity.metadata && activity.event !== CUSTOM_EVENT) {
        return;
      }
      const description = getActivityDescription(activity);
      // filter out uninteresting activities FIXME
      if (!description || description.startsWith('Attached')) {
        return;
      }
      const actionDescription =
        options.inclActions && activity.metadata ?
          getActivityActionDescription(activity.metadata)
        : undefined;
      const contributor =
        options.inclContributors && actors && activity.actorId ?
          (
            actors[activity.actorId] ??
            Object.values(actors).find(actor =>
              actor.accounts?.flatMap(acct => acct.id).includes(activity.actorId!)
            )
          )?.name ?? undefined
        : undefined;

      const activityStringDedupe = description + (actionDescription ?? '') + (contributor ?? '');
      if (!dedupe.has(activityStringDedupe)) {
        dedupe.add(activityStringDedupe);
        activitiesString +=
          description +
          (options.inclDates ? `\nDate: ${new Date(activity.timestamp).toLocaleString()}` : '') +
          (actionDescription ? `\nAction: ${actionDescription}` : '') +
          (contributor ? `\nContributor: ${contributor}` : '') +
          (activity.initiativeId && initiatives?.[activity.initiativeId] ?
            `\nGoal: [${initiatives[activity.initiativeId].key}] ${initiatives[activity.initiativeId].label}`
          : '') +
          '\n---\n';
      }
    });

  return activitiesString;
};

export const getSummaryResult = (content: GenerateContentResult) => {
  let summary =
    content.response.candidates ? content.response.candidates[0].content.parts[0].text ?? '' : '';
  try {
    if (summary.startsWith('```json')) {
      summary = formatJson(JSON.parse(summary.replace('```json', '').replace('```', '')));
    }
    if (summary.startsWith('```markdown')) {
      summary = summary.replace('```markdown', '').replace('```', '');
    }
  } catch (e) {
    /* empty */
  }
  return summary;
};
