import { GenerateContentResult } from '@google-cloud/vertexai';
import { getSummary, getSummaryAction } from '../types/activityFeed';
import type { Activity, ActorRecord, InitiativeRecord } from '../types/types';
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
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .forEach(activity => {
      if (!activity.metadata) {
        return;
      }
      const summary = getSummary(activity);
      // filter out uninteresting activities FIXME
      if (!summary || summary.startsWith('Attached')) {
        return;
      }
      const summaryAction = options.inclActions ? getSummaryAction(activity.metadata) : undefined;
      const contributor =
        options.inclContributors && actors && activity.actorId ?
          (
            actors[activity.actorId] ??
            Object.values(actors).find(actor =>
              actor.accounts?.flatMap(acct => acct.id).includes(activity.actorId!)
            )
          )?.name ?? undefined
        : undefined;

      const activityStringDedupe = summary + (summaryAction ?? '') + (contributor ?? '');
      if (!dedupe.has(activityStringDedupe)) {
        dedupe.add(activityStringDedupe);
        activitiesString +=
          summary +
          (options.inclDates ?
            `\nDate: ${new Date(activity.createdTimestamp).toLocaleString()}`
          : '') +
          (summaryAction ? `\nAction: ${summaryAction}` : '') +
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
