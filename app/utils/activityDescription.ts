import type { Activity, ActivityChangeLog, ActivityMetadata, FeedType } from '../types/types';
import { mimeTypeToType } from './stringUtils';

export const ACTIVITY_DESCRIPTION_LIST_SEPARATOR = ', ';

export const getActivityDescription = (activity: Omit<Activity, 'id'>) => {
  if (activity.description) {
    return activity.description;
  }

  const metadata = activity.metadata;
  if (metadata?.issue) {
    return metadata.issue.key + ' ' + metadata.issue.summary;
  }
  if (metadata?.attachment?.filename) {
    const type = metadata.attachment.mimeType ? mimeTypeToType(metadata.attachment.mimeType) : null;
    return type ?
        `Attached ${type} ${metadata.attachment.filename}`
      : `Attached ${metadata.attachment.filename}`;
  }
  if (metadata?.sprint) {
    return `Sprint ${metadata.sprint.name} ${metadata.sprint.state}`;
  }
  if (metadata?.worklog) {
    return 'Worklog';
  }

  if (metadata?.space) {
    return `Space: ${metadata.space.title}`;
  }
  if (metadata?.page) {
    return `${metadata.page.title}`;
  }
  if (metadata?.comment) {
    return `Commented ${metadata.comment.parent?.title}`;
  }
  if (metadata?.label) {
    return `Labeled ${metadata?.label.contentType ? `${metadata?.label.contentType} ` : ''}${metadata?.label.name}`;
  }
  if (metadata?.attachments) {
    const files = metadata.attachments.files
      .map(f => f.filename)
      .join(ACTIVITY_DESCRIPTION_LIST_SEPARATOR);
    return metadata.attachments.parent ?
        `Attached ${files} to ${metadata.attachments.parent.type} ${metadata.attachments.parent.title}`
      : `Attached ${files}`;
  }

  if (metadata?.pullRequest) {
    return `${metadata.pullRequest.codeAction ?? ''} ${metadata.pullRequest.title}`;
  }
  if (metadata?.pullRequestComment) {
    return (
      metadata.pullRequest?.title ??
      metadata.pullRequestIssue?.title ??
      metadata.pullRequestComment.body
    ); // prefer the PR title
  }
  if (metadata?.commits?.length) {
    return metadata.commits[0].message;
  }
  if (activity.event === 'organization') {
    return 'Organization';
  }
  if (activity.event === 'repository') {
    return 'Repository';
  }
  if (activity.event === 'repository_ruleset') {
    return 'Repository ruleset';
  }
  if (activity.event === 'project_created') {
    return 'Project created';
  }
  return '';
};

const transitionString = (prefix: string, changeLog: ActivityChangeLog) =>
  prefix + changeLog.oldValue + ' → ' + changeLog.newValue;

const codeActionString = (codeAction: string, metadata: ActivityMetadata) => {
  if (codeAction === 'opened') {
    return 'opened';
  }
  if (codeAction === 'ready_for_review') {
    return 'ready for review';
  }
  if (codeAction === 'review_requested') {
    return 'review requested';
  }
  if (codeAction === 'submitted') {
    return 'submitted';
  }
  if (codeAction === 'assigned') {
    return 'assigned';
  }
  if (codeAction === 'resolved') {
    return 'discussion resolved';
  }
  if (codeAction === 'edited') {
    return 'edited';
  }
  if (codeAction === 'labeled') {
    return 'labeled';
  }
  if (codeAction === 'closed') {
    return 'closed';
  }
  if (codeAction === 'dismissed') {
    return 'dismissed';
  }
  if (codeAction === 'created' && metadata.pullRequestComment) {
    return 'commented';
  }
  if (codeAction === 'deleted' && metadata.pullRequestComment) {
    return 'comment deleted';
  }
};

export const getActivityActionDescription = (metadata: ActivityMetadata) => {
  try {
    if (metadata?.issue) {
      const actions: string[] = [];
      metadata.changeLog?.forEach(changeLog => {
        if (changeLog.field === 'status' && changeLog.oldValue && changeLog.newValue) {
          actions.push('Status: ' + changeLog.oldValue + ' → ' + changeLog.newValue);
        }
        if (changeLog.field === 'assignee' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Assignee: ', changeLog));
        }
        if (changeLog.field === 'assignee' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Assignee: ' + changeLog.newValue);
        }
        if (changeLog.field === 'assignee' && changeLog.oldValue && !changeLog.newValue) {
          actions.push('Unassigned: ' + changeLog.oldValue);
        }
        if (changeLog.field === 'labels' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Labels: ', changeLog));
        }
        if (changeLog.field === 'labels' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Labeled: ' + changeLog.newValue);
        }
        if (changeLog.field === 'labels' && changeLog.oldValue && !changeLog.newValue) {
          actions.push('Unlabeled: ' + changeLog.oldValue);
        }
        if (changeLog.field === 'Link' && changeLog.newValue) {
          actions.push(changeLog.newValue); // "This issue relates to XXX"
        }
        if (changeLog.field === 'Domain' && changeLog.newValue) {
          actions.push('Domain: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Platform' && changeLog.newValue) {
          actions.push('Platform: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Fix Version' && changeLog.newValue) {
          actions.push('Fix Version: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Epic Link' && changeLog.newValue) {
          actions.push('Epic Link');
        }
        if (changeLog.field === 'Rank' && changeLog.newValue) {
          actions.push(changeLog.newValue); // "Ranked higher"
        }
        // FIXME NURSA specific custom fields
        if (changeLog.field === 'Start Date' && !changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Start  date: ', changeLog));
        }
        if (changeLog.field === 'Start date' && changeLog.newValue) {
          actions.push('Start date: ' + changeLog.newValue);
        }
        if (
          changeLog.field === 'Expected Delivery Date' &&
          changeLog.oldValue &&
          changeLog.newValue
        ) {
          actions.push(transitionString('Expected delivery date: ', changeLog));
        }
        if (
          changeLog.field === 'Expected Delivery Date' &&
          !changeLog.oldValue &&
          changeLog.newValue
        ) {
          actions.push('Expected delivery date: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Sprint' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Sprint: ', changeLog));
        }
        if (changeLog.field === 'Sprint' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Sprint: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Story Points' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Story Points: ', changeLog));
        }
        if (changeLog.field === 'Story Points' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Story Points: ' + changeLog.newValue);
        }
        if (changeLog.field === 'summary') {
          actions.push('Updated summary');
        }
        if (changeLog.field === 'description') {
          actions.push('Updated description');
        }
      });
      return actions.join(', ');
    }
    if (metadata?.attachment) {
      return metadata.attachment.uri;
    }
    if (metadata?.attachments?.files?.length) {
      return metadata.attachments.files.map(f => f.uri).join(', ');
    }
    if (metadata?.page?.version) {
      return `Version ${metadata.page.version}`;
    }

    if (metadata?.codeAction && (metadata?.pullRequest || metadata?.pullRequestComment)) {
      const codeAction = metadata.codeAction;
      if (Array.isArray(codeAction)) {
        return 'PR ' + codeAction.map(a => codeActionString(a, metadata)).join(', ');
      } else {
        return 'PR ' + codeActionString(codeAction, metadata);
      }
    }
    if (metadata?.codeAction === 'member_invited') {
      return 'Member invited';
    }
    if (metadata?.codeAction === 'edited') {
      return 'Edited';
    }
  } catch (e) {
    return '';
  }
};

export const getActivityUrl = (activity: Activity): { url: string; type: FeedType } | null => {
  const metadata = activity.metadata;
  let type: FeedType | null = null;
  if (activity.eventType === 'jira') {
    type = 'jira';
  } else if (activity.eventType === 'confluence') {
    type = 'confluence';
  } else if (activity.eventType === 'github') {
    type = 'github';
  }
  if (!type) {
    // legacy mapping, before we had activity.eventType (introduced with Confluence)
    if (metadata?.issue) {
      type = 'jira';
    } else if (metadata?.pullRequest || metadata?.pullRequestComment || metadata?.commits) {
      type = 'github';
    }
  }
  if (!type) {
    return null;
  }
  if (metadata?.issue?.uri) {
    return { url: `${metadata.issue.uri.split('rest')[0]}browse/${metadata.issue.key}`, type };
  }
  if (metadata?.space?.uri) {
    return { url: `${metadata.space.uri}`, type };
  }
  if (metadata?.page?.uri) {
    return { url: `${metadata.page.uri}`, type };
  }
  if (metadata?.comment?.uri) {
    return { url: `${metadata.comment.uri}`, type };
  }
  if (metadata?.comments && metadata.comments[0]?.uri) {
    return { url: `${metadata.comments[0].uri}`, type };
  }
  if (metadata?.label?.contentUri) {
    return { url: `${metadata.label.contentUri}`, type };
  }
  if (metadata?.attachments?.parent?.uri) {
    return { url: `${metadata.attachments.parent.uri}`, type };
  }

  if (metadata?.pullRequest?.uri) {
    return { url: metadata.pullRequest.uri, type };
  }
  if (metadata?.pullRequestComment?.uri) {
    return { url: metadata.pullRequestComment.uri, type };
  }
  if (metadata?.commits?.length) {
    return { url: metadata.commits[0].url!, type };
  }
  return null;
};
