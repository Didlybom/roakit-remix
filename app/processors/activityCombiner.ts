import type { Activity, ActivityChangeLog } from '../types/types';
import { dedupeConsecutiveItems } from '../utils/mapUtils';

const combineToNewActivity = (
  activities: Activity[],
  oldActivityIndex: number,
  oldActivity: Activity,
  newActivity: Activity
) => {
  newActivity.combined = oldActivity.combined ?? [];
  newActivity.combined.push({
    activityId: oldActivity.id,
    timestamp: oldActivity.createdTimestamp,
  });
  activities.splice(oldActivityIndex, 1);
  activities.push(newActivity);
};

const isMatching = (a: Activity, b: Activity) =>
  a.actorId === b.actorId &&
  a.artifact === b.artifact &&
  a.eventType === b.eventType &&
  ((a.action === b.action &&
    (a.event === b.event ||
      (a.event?.startsWith('pull_request') && b.event?.startsWith('pull_request')) ||
      (a.event?.startsWith('comment') && b.event?.startsWith('comment')))) ||
    (a.action === 'created' &&
      b.action === 'updated' &&
      a.event === 'jira:issue_created' &&
      b.event === 'jira:issue_updated'));

/**
 * Try to combine newActivity with an existing element of activities, keeping the nex index.
 * Activities are expected to be sorted by ascending timestamp.
 */
export const combineAndPushActivity = (newActivity: Activity, sortedActivities: Activity[]) => {
  if (!newActivity.metadata) {
    sortedActivities.push(newActivity);
    return sortedActivities;
  }

  // PR
  if (newActivity.metadata?.pullRequest?.uri) {
    if (newActivity.metadata.codeAction === 'labeled' && newActivity.metadata.label?.name) {
      newActivity.metadata.codeAction = `labeled ${newActivity.metadata.label?.name}`;
    }
    const indexPRActivity = sortedActivities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.pullRequest?.uri &&
        a.metadata.pullRequest.uri === newActivity.metadata?.pullRequest?.uri &&
        a.metadata?.codeAction
    );
    if (indexPRActivity >= 0 && newActivity.metadata.codeAction) {
      const foundActivity = sortedActivities[indexPRActivity];
      const foundCodeAction = foundActivity.metadata!.codeAction!;
      const codeActions = Array.isArray(foundCodeAction) ? foundCodeAction : [foundCodeAction];
      if (!codeActions.includes(newActivity.metadata.codeAction as string)) {
        codeActions.unshift(newActivity.metadata.codeAction as string);
      }
      newActivity.event = 'pull_request_*';
      newActivity.metadata.codeAction = [...codeActions];
      combineToNewActivity(sortedActivities, indexPRActivity, foundActivity, newActivity);
      return sortedActivities;
    } else {
      sortedActivities.push(newActivity);
      return sortedActivities;
    }
  }

  // Code push
  else if (newActivity.event === 'push' && newActivity.metadata?.commits?.length) {
    const indexPushActivity = sortedActivities.findLastIndex(
      a => isMatching(a, newActivity) && a.metadata?.commits
    );
    if (indexPushActivity >= 0) {
      const foundActivity = sortedActivities[indexPushActivity];
      const urls: string[] = [];
      const messages: string[] = [];
      foundActivity.metadata!.commits!.forEach(c => {
        if (c.url) {
          urls.push(c.url);
        }
        messages.push(c.message);
      });
      // if at least one commit is "identical", we combine the 2 activities
      if (
        newActivity.metadata.commits.some(
          a => (a.url && urls.indexOf(a.url) !== -1) || messages.indexOf(a.message) !== -1
        )
      ) {
        const commits = [...foundActivity.metadata!.commits!];
        newActivity.metadata.commits.forEach(commit => {
          if (!commits.some(c => c.url === commit.url)) {
            commits.unshift(commit);
          }
        });
        newActivity.metadata.commits = commits;
        combineToNewActivity(sortedActivities, indexPushActivity, foundActivity, newActivity);
        return sortedActivities;
      }
    }
  }

  // Issue changelog
  else if (newActivity.metadata?.issue?.key && newActivity.metadata.changeLog) {
    const indexIssueActivity = sortedActivities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.issue?.key &&
        a.metadata.issue.key === newActivity.metadata?.issue?.key &&
        a.metadata?.changeLog
    );
    if (indexIssueActivity >= 0 && newActivity.metadata.changeLog) {
      const foundActivity = sortedActivities[indexIssueActivity];
      newActivity.metadata.changeLog.push(...foundActivity.metadata!.changeLog!);
      newActivity.metadata.changeLog = dedupeConsecutiveItems(
        newActivity.metadata.changeLog,
        (a: ActivityChangeLog, b: ActivityChangeLog) =>
          a.field === b.field &&
          a.newValue != null &&
          (a.newValue === b.newValue || a.field === 'description')
      );
      if (newActivity.action === 'updated' && foundActivity.action === 'created') {
        newActivity.action = 'created';
        newActivity.event = foundActivity.event;
      }
      combineToNewActivity(sortedActivities, indexIssueActivity, foundActivity, newActivity);
      return sortedActivities;
    }
  }

  // Jira multiple attachments
  else if (newActivity.event === 'attachment_created' && newActivity.metadata?.attachment) {
    const indexPageActivity = sortedActivities.findLastIndex(a => isMatching(a, newActivity));
    if (indexPageActivity >= 0) {
      const foundActivity = sortedActivities[indexPageActivity];
      if (foundActivity.metadata!.attachments?.files) {
        newActivity.metadata.attachments = {
          files: [newActivity.metadata.attachment, ...foundActivity.metadata!.attachments.files],
        };
      } else if (foundActivity.metadata!.attachment) {
        newActivity.metadata.attachments = {
          files: [newActivity.metadata.attachment, foundActivity.metadata!.attachment],
        };
      } else {
        return sortedActivities;
      }
      newActivity.metadata.attachment = undefined;
      combineToNewActivity(sortedActivities, indexPageActivity, foundActivity, newActivity);
      return sortedActivities;
    }
  }

  // Jira and Confluence consecutive comments
  else if (newActivity.event?.startsWith('comment') && newActivity.metadata?.comment) {
    const indexPageActivity = sortedActivities.findLastIndex(
      a => isMatching(a, newActivity) && newActivity.metadata?.issue?.key === a.metadata?.issue?.key
    );
    if (indexPageActivity >= 0) {
      const foundActivity = sortedActivities[indexPageActivity];
      if (foundActivity.metadata!.comments) {
        newActivity.metadata.comments = [
          newActivity.metadata.comment,
          ...foundActivity.metadata!.comments.filter(
            c => c.id !== newActivity.metadata!.comment!.id
          ),
        ];
      } else if (foundActivity.metadata!.comment) {
        newActivity.metadata.comments = [
          newActivity.metadata.comment,
          ...(foundActivity.metadata!.comment.id !== newActivity.metadata!.comment!.id ?
            [foundActivity.metadata!.comment]
          : []),
        ];
      } else {
        return sortedActivities;
      }
      newActivity.metadata.comment = undefined;
      newActivity.event = 'comment_*';
      combineToNewActivity(sortedActivities, indexPageActivity, foundActivity, newActivity);
      return sortedActivities;
    }
  }

  // Jira single comment update
  else if (newActivity.event?.startsWith('comment_') && newActivity.metadata?.comment?.id) {
    const indexPageActivity = sortedActivities.findLastIndex(
      a =>
        isMatching(a, newActivity) && newActivity.metadata!.comment!.id === a.metadata?.comment?.id
    );
    if (indexPageActivity >= 0) {
      const foundActivity = sortedActivities[indexPageActivity];
      newActivity.event = 'comment_*';
      combineToNewActivity(sortedActivities, indexPageActivity, foundActivity, newActivity);
      return sortedActivities;
    }
  }

  // Confluence page
  else if (newActivity.metadata?.page?.id) {
    const indexPageActivity = sortedActivities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.page &&
        a.metadata.page.id === newActivity.metadata?.page?.id
    );
    if (indexPageActivity >= 0) {
      const foundActivity = sortedActivities[indexPageActivity];
      if (
        newActivity.metadata.page.version &&
        newActivity.metadata.page.version != foundActivity.metadata!.page!.version
      ) {
        newActivity.metadata.page.version += ', ' + foundActivity.metadata!.page!.version;
      }
      combineToNewActivity(sortedActivities, indexPageActivity, foundActivity, newActivity);
      return sortedActivities;
    }
  }

  // Confluence attachments
  else if (newActivity.metadata?.attachments?.files?.length) {
    const indexPageActivity = sortedActivities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.attachments?.parent?.id &&
        a.metadata.attachments.parent.id === newActivity.metadata?.attachments?.parent?.id
    );
    if (indexPageActivity >= 0) {
      const foundActivity = sortedActivities[indexPageActivity];
      newActivity.metadata.attachments.files.unshift(...foundActivity.metadata!.attachments!.files);
      combineToNewActivity(sortedActivities, indexPageActivity, foundActivity, newActivity);
      return sortedActivities;
    }
  }

  // no similar activity found, push it as new
  sortedActivities.push(newActivity);
  return sortedActivities;
};
