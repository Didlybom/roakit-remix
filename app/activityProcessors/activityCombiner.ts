import type { Activity } from '../types/types';

const combineToNewActivity = (
  activities: Activity[],
  oldActivityIndex: number,
  oldActivity: Activity,
  newActivity: Activity
) => {
  newActivity.combinedIds = oldActivity.combinedIds ?? [];
  newActivity.combinedIds.push(oldActivity.id);
  activities.splice(oldActivityIndex, 1);
  activities.push(newActivity);
};

const isMatching = (a: Activity, b: Activity) =>
  a.actorId === b.actorId &&
  a.artifact === b.artifact &&
  a.eventType === b.eventType &&
  a.action === b.action &&
  (a.event === b.event ||
    (a.event?.startsWith('pull_request') && b.event?.startsWith('pull_request')) ||
    (a.event?.startsWith('comment_') && b.event?.startsWith('comment_')));

/**
 * Try to combine newActivity with an existing element of activities, keeping the nex index.
 * Note: activities are expected to be sorted by ascending timestamp for best performance.
 */
export const combineAndPushActivity = (newActivity: Activity, activities: Activity[]) => {
  if (!newActivity.metadata) {
    activities.push(newActivity);
    return activities;
  }

  // PR
  if (newActivity.metadata?.pullRequest?.uri) {
    const indexPRActivity = activities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.pullRequest?.uri &&
        a.metadata.pullRequest.uri === newActivity.metadata?.pullRequest?.uri &&
        a.metadata?.codeAction
    );
    if (indexPRActivity >= 0 && newActivity.metadata.codeAction) {
      const foundActivity = activities[indexPRActivity];
      const foundCodeAction = foundActivity.metadata!.codeAction!;
      const codeActions = new Set<string>(
        Array.isArray(foundCodeAction) ? foundCodeAction : [foundCodeAction]
      );
      codeActions.add(newActivity.metadata.codeAction as string);
      newActivity.event = 'pull_request_*';
      newActivity.metadata.codeAction = [...codeActions];
      combineToNewActivity(activities, indexPRActivity, foundActivity, newActivity);
      return activities;
    }
  }

  // Code push
  else if (newActivity.event === 'push' && newActivity.metadata?.commits?.length) {
    const indexPushActivity = activities.findLastIndex(
      a => isMatching(a, newActivity) && a.metadata?.commits
    );
    if (indexPushActivity >= 0) {
      const foundActivity = activities[indexPushActivity];
      const urls = foundActivity.metadata!.commits!.map(c => c.url);
      // if at least one commit is identical, we combine the 2 activities
      if (newActivity.metadata.commits.some(a => urls.indexOf(a.url) !== -1)) {
        const commits = [...foundActivity.metadata!.commits!];
        newActivity.metadata.commits.forEach(commit => {
          if (!commits.some(c => c.url === commit.url)) {
            commits.push(commit);
          }
        });
        newActivity.metadata.commits = commits;
        combineToNewActivity(activities, indexPushActivity, foundActivity, newActivity);
        return activities;
      }
    }
  }

  // Issue changelog
  else if (newActivity.metadata?.issue?.key && newActivity.metadata.changeLog) {
    const indexIssueActivity = activities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.issue?.key &&
        a.metadata.issue.key === newActivity.metadata?.issue?.key &&
        a.metadata?.changeLog
    );
    if (indexIssueActivity >= 0 && newActivity.metadata.changeLog) {
      const foundActivity = activities[indexIssueActivity];
      newActivity.metadata.changeLog.push(...foundActivity.metadata!.changeLog!);
      combineToNewActivity(activities, indexIssueActivity, foundActivity, newActivity);
      return activities;
    }
  }

  // Jira attachment
  else if (newActivity.event === 'attachment_created' && newActivity.metadata?.attachment) {
    const indexPageActivity = activities.findLastIndex(a => isMatching(a, newActivity));
    if (indexPageActivity >= 0) {
      const foundActivity = activities[indexPageActivity];
      if (foundActivity.metadata!.attachments?.files) {
        newActivity.metadata.attachments = {
          files: [...foundActivity.metadata!.attachments.files, newActivity.metadata.attachment],
        };
      } else if (foundActivity.metadata!.attachment) {
        newActivity.metadata.attachments = {
          files: [foundActivity.metadata!.attachment, newActivity.metadata.attachment],
        };
      }
      newActivity.metadata.attachment = undefined;
      combineToNewActivity(activities, indexPageActivity, foundActivity, newActivity);
      return activities;
    }
  }

  // Jira comment
  else if (newActivity.event === 'comment_updated' && newActivity.metadata?.comment?.id) {
    const indexPageActivity = activities.findLastIndex(
      a =>
        isMatching(a, newActivity) && newActivity.metadata!.comment!.id === a.metadata?.comment?.id
    );
    if (indexPageActivity >= 0) {
      const foundActivity = activities[indexPageActivity];
      newActivity.event = 'comment_*';
      combineToNewActivity(activities, indexPageActivity, foundActivity, newActivity);
      return activities;
    }
  }

  // Confluence page
  else if (newActivity.metadata?.page?.id) {
    const indexPageActivity = activities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.page &&
        a.metadata.page.id === newActivity.metadata?.page?.id
    );
    if (indexPageActivity >= 0) {
      const foundActivity = activities[indexPageActivity];
      if (
        newActivity.metadata.page.version &&
        newActivity.metadata.page.version != foundActivity.metadata!.page!.version
      ) {
        newActivity.metadata.page.version += ', ' + foundActivity.metadata!.page!.version;
      }
      combineToNewActivity(activities, indexPageActivity, foundActivity, newActivity);
      return activities;
    }
  }

  // Confluence attachments
  else if (newActivity.metadata?.attachments?.files?.length) {
    const indexPageActivity = activities.findLastIndex(
      a =>
        isMatching(a, newActivity) &&
        a.metadata?.attachments?.parent?.id &&
        a.metadata.attachments.parent.id === newActivity.metadata?.attachments?.parent?.id
    );
    if (indexPageActivity >= 0) {
      const foundActivity = activities[indexPageActivity];
      newActivity.metadata.attachments.files.push(...foundActivity.metadata!.attachments!.files);
      combineToNewActivity(activities, indexPageActivity, foundActivity, newActivity);
      return activities;
    }
  }

  // no similar activity found, push it as new
  activities.push(newActivity);
  return activities;
};
