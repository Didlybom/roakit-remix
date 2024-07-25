import type { ReactNode } from 'react';
import type { Activity, ActivityChangeLog, ActivityMetadata, FeedType } from '../types/types';
import { convertEmojis, mimeTypeToType } from '../utils/stringUtils';
import { issueUrlToWeb } from './activityFeed';

export const getActivityDescription = (
  activity: Activity,
  options: { format: 'Grid' | 'Feed' }
) => {
  if (activity.description) {
    return activity.description;
  }

  const metadata = activity.metadata;
  if (metadata?.issue) return metadata.issue.key + ' ' + metadata.issue.summary;
  if (metadata?.attachment?.filename) {
    const type = metadata.attachment.mimeType ? mimeTypeToType(metadata.attachment.mimeType) : null;
    const filename = options.format === 'Feed' ? '' : ` ${metadata.attachment.filename}`;
    return type ? `Attached ${type}${filename}` : `Attached${filename}`;
  }
  if (metadata?.sprint) return `Sprint ${metadata.sprint.name} ${metadata.sprint.state}`;
  if (metadata?.worklog) return 'Worklog';
  if (metadata?.space) return `Space: ${metadata.space.title}`;
  if (metadata?.page) return metadata.page.title;
  if (metadata?.comment && metadata?.pullRequest)
    return metadata.comment.parent?.title || 'Commented';
  if (metadata?.comments?.length && metadata?.pullRequest)
    return metadata.comments[0].parent?.title || 'Commented';
  if (metadata?.label && !metadata?.pullRequest) {
    return `Labeled ${metadata?.label.contentType ? `${metadata?.label.contentType} ` : ''}${metadata?.label.name}`;
  }
  if (metadata?.attachments) {
    const files =
      options.format === 'Feed' ?
        ''
      : ' ' +
        metadata.attachments.files
          .filter(f => f.filename)
          .map(f => f.filename)
          .join(', ');
    return metadata.attachments.parent ?
        `Attached${files} to ${metadata.attachments.parent.type} ${metadata.attachments.parent.title}`
      : `Attached${files}`;
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
  if (metadata?.commits?.length) return metadata.commits[0].message;
  if (activity.event === 'organization') return 'Organization';
  if (activity.event === 'repository') return 'Repository';
  if (activity.event === 'repository_ruleset') return 'Repository ruleset';
  if (activity.event === 'project_created') return 'Project created';
  return '';
};

const transitionString = (prefix: string, changeLog: ActivityChangeLog) =>
  `${prefix + changeLog.oldValue} → ${changeLog.newValue}`;

const codeActionString = (
  codeAction: string,
  metadata: ActivityMetadata,
  options?: { format?: 'Grid' | 'Feed' }
) => {
  if (codeAction === 'opened') return 'opened';
  if (codeAction === 'ready_for_review') return 'ready for review';
  if (codeAction === 'review_requested') return 'review requested';
  if (codeAction === 'review_request_removed') return 'review request removed';
  if (codeAction === 'submitted') return 'submitted';
  if (codeAction === 'assigned') return 'assigned';
  if (codeAction === 'resolved') return 'discussion resolved';
  if (codeAction === 'edited') return 'edited';
  if (codeAction === 'closed') return 'closed';
  if (codeAction === 'dismissed') return 'dismissed';
  if (codeAction === 'reopened') return 'reopened';
  if (codeAction === 'created' && metadata.pullRequestComment) {
    return options?.format === 'Feed' ?
        `commented:\n\n${metadata.pullRequestComment.body}`
      : 'commented';
  }
  if (codeAction === 'created') return 'created';
  if (codeAction === 'converted_to_draft') return 'converted to draft';
  if (codeAction === 'deleted' && metadata.pullRequestComment) return 'comment deleted';
  if (codeAction === 'deleted') return 'deleted';
  if (codeAction.startsWith('labeled'))
    return options?.format === 'Feed' ? convertEmojis(codeAction) : 'labeled';
  if (codeAction === 'unlabeled') return 'unlabeled';
  return codeAction;
};

export const getActivityActionDescription = (
  activity: Activity,
  options: { format: 'Grid' | 'Feed' }
): ReactNode[] | undefined => {
  const metadata = activity.metadata;
  try {
    if (metadata?.issue) {
      const actions: string[] = [];
      metadata.changeLog?.forEach(changeLog => {
        if (changeLog.field === 'status' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Status: ', changeLog));
        }
        if (changeLog.field === 'assignee' && changeLog.oldValue && changeLog.newValue) {
          if (
            options?.format === 'Feed' &&
            activity.eventType === 'jira' &&
            changeLog.oldId &&
            changeLog.newId
          ) {
            actions.push(
              `Assignee: [~accountid:${changeLog.oldId}] → [~accountid:${changeLog.newId}]`
            );
          } else {
            actions.push(transitionString('Assignee: ', changeLog));
          }
        }
        if (changeLog.field === 'assignee' && !changeLog.oldValue && changeLog.newValue) {
          if (options?.format === 'Feed' && activity.eventType === 'jira' && changeLog.newId) {
            actions.push(`Assigned to [~accountid:${changeLog.newId}]`);
          } else {
            actions.push('Assigned to ' + changeLog.newValue);
          }
        }
        if (changeLog.field === 'assignee' && changeLog.oldValue && !changeLog.newValue) {
          actions.push('Unassigned from ' + changeLog.oldValue);
        }
        if (changeLog.field === 'labels' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Labels: ', changeLog));
        }
        if (changeLog.field === 'priority' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Priority: ', changeLog));
        }
        if (changeLog.field === 'labels' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Labeled: ' + changeLog.newValue);
        }
        if (changeLog.field === 'labels' && changeLog.oldValue && !changeLog.newValue) {
          actions.push('Unlabeled: ' + changeLog.oldValue);
        }
        if (changeLog.field === 'Link' && changeLog.newValue) {
          actions.push(changeLog.newValue);
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
          actions.push('Set summary');
        }
        if (changeLog.field === 'description') {
          actions.push(
            options?.format === 'Feed' ?
              `Description:\n\n${convertEmojis(changeLog.newValue)}`
            : 'Set description'
          );
        }
      });
      if (activity.action === 'created') {
        actions.push('Issue created');
      }
      return actions;
    }
    if (metadata?.attachment?.uri) {
      return options.format === 'Feed' ?
          [
            metadata.attachment.uri ?
              `<a href="${metadata.attachment.uri}" target="_blank">${metadata.attachment.filename}</a>`
            : metadata.attachment.filename,
          ]
        : [];
    }
    if (metadata?.attachments?.files?.length) {
      return options.format === 'Feed' ?
          [
            metadata.attachments.files
              .map(f =>
                f.uri ? `<a href="${f.uri}" target="_blank">${f.filename}</a>` : f.filename
              )
              .join(' • '),
          ]
        : [];
    }
    if (
      metadata?.oldParent?.title &&
      metadata?.newParent?.title &&
      metadata?.oldParent?.id !== metadata?.newParent?.id
    ) {
      const version = metadata?.page?.version ? `Version ${metadata.page.version}. ` : '';
      return [`${version}Moved from ${metadata.oldParent.title} to ${metadata.newParent.title}`];
    }
    if (metadata?.page?.version) {
      return [
        `Version${metadata.page.version.indexOf(',') > 0 ? 's' : ''} ${metadata.page.version}`,
      ];
    }

    if (metadata?.codeAction && (metadata?.pullRequest || metadata?.pullRequestComment)) {
      const codeAction = metadata.codeAction;
      if (Array.isArray(codeAction)) {
        return codeAction.map(a => `PR ${codeActionString(a, metadata, options)}`);
      } else {
        return [`PR ${codeActionString(codeAction, metadata, options)}`];
      }
    }
    if (metadata?.codeAction === 'member_invited') {
      return ['Member invited'];
    }
    if (metadata?.codeAction === 'edited') {
      return ['Edited'];
    }
  } catch (e) {
    return undefined;
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
  if (!type) return null;

  if (metadata?.issue?.uri) {
    return { url: issueUrlToWeb(metadata.issue.uri, metadata.issue.key), type };
  }

  if (metadata?.space?.uri) return { url: metadata.space.uri, type };
  if (metadata?.page?.uri) return { url: metadata.page.uri, type };
  if (metadata?.comment?.uri) return { url: metadata.comment.uri, type };
  if (metadata?.comments && metadata.comments[0]?.uri)
    return { url: metadata.comments[0].uri, type };
  if (metadata?.label?.contentUri) return { url: metadata.label.contentUri, type };
  if (metadata?.attachments?.parent?.uri) return { url: metadata.attachments.parent.uri, type };

  if (metadata?.pullRequest?.uri) return { url: metadata.pullRequest.uri, type };
  if (metadata?.pullRequestComment?.uri) return { url: metadata.pullRequestComment.uri, type };
  if (metadata?.commits?.length) return { url: metadata.commits[0].url!, type };

  return null;
};
