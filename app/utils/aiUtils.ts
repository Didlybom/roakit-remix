import { GenerateContentResult, TextPart } from '@google-cloud/vertexai';
import { getSummary, getSummaryAction } from '../schemas/activityFeed';
import { ActivityData, ActorMap } from '../schemas/schemas';
import { formatJson } from './jsxUtils';
import { cloneArray } from './mapUtils';

export const DEFAULT_PROMPT =
  'Output a categorized summary of these activities. Remove duplicates. Without title, introduction, notes and conclusion. Output markdown.';

export const buildActivitySummaryPrompt = (
  activities: Omit<ActivityData, 'id'>[] | null,
  actors: ActorMap | null,
  activityCount: number,
  inclDates: boolean,
  inclActions: boolean,
  inclContributors: boolean
) => {
  if (!activities) {
    return '';
  }
  const activityList = cloneArray(activities);
  activityList.splice(activityCount);
  let activitiesString = '';
  const dedupe = new Set<string>();
  activityList.forEach(activity => {
    if (!activity.metadata) {
      return;
    }
    const summary = getSummary(activity.metadata);
    if (!summary || summary.startsWith('Attached')) {
      return;
    }
    const summaryAction = inclActions ? getSummaryAction(activity.metadata) : undefined;
    const contributor =
      inclContributors && actors ? actors[activity.actorId ?? '']?.name ?? undefined : undefined;

    const activityStringDedupe = summary + (summaryAction ?? '') + (contributor ?? '');

    if (!dedupe.has(activityStringDedupe)) {
      dedupe.add(activityStringDedupe);
      activitiesString +=
        summary +
        (inclDates ? '\nDate: ' + new Date(activity.createdTimestamp).toLocaleString() : '') +
        (summaryAction ? '\nAction: ' + summaryAction : '') +
        (contributor ? '\nContributor: ' + contributor : '') +
        '\n---\n';
    }
  });

  return activitiesString;
};

export const getSummaryResult = (content: GenerateContentResult) => {
  let summary = (content.response.candidates[0]?.content.parts[0] as TextPart)?.text;
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
