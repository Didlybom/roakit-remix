import memoize from 'fast-memoize';
import pluralize from 'pluralize';

export const caseInsensitiveSort = (data: string[]): string[] =>
  data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export const caseInsensitiveCompare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

export const JIRA_TICKET_REGEXP = /([A-Z][A-Z0-9]+-[0-9]+)/;
const JIRA_PROJECT_REGEXP_G = /([A-Z][A-Z0-9]+)(?=-[0-9]+)/g;
const JIRA_TICKET_REGEXP_G = /([A-Z][A-Z0-9]+-[0-9]+)/g;

export const findJiraProjects = (data?: string): string[] => {
  if (!data) {
    return [];
  }
  const projects = new Set<string>();
  [...data.matchAll(JIRA_PROJECT_REGEXP_G)].forEach(m => {
    projects.add(m[1]); // dedupes
  });
  return [...projects];
};

export const findJiraTickets = (data?: string): string[] => {
  if (!data) {
    return [];
  }
  const projects = new Set<string>();
  [...data.matchAll(JIRA_TICKET_REGEXP_G)].forEach(m => {
    projects.add(m[1]); // dedupes
  });
  return [...projects];
};

export const removeSpaces = (data: string): string => data.replace(/\s/g, '');

export const capitalizeAndUseSpaces = (data?: string) =>
  !data ? '' : (data.charAt(0).toUpperCase() + data.slice(1)).replace(/_/g, ' ');

export const sortAndFormatRecord = <T>(data: Record<string, T>) =>
  JSON.stringify(data, Object.keys(data).sort(), 2);

export const mimeTypeToType = (mimeType: string): string | undefined => {
  if (mimeType.startsWith('image')) {
    return 'image';
  }
  if (mimeType.startsWith('audio')) {
    return 'audio';
  }
  if (mimeType.startsWith('video')) {
    return 'video';
  }
  if (mimeType.includes('cal')) {
    return 'calendar';
  }
  if (mimeType.startsWith('text')) {
    return 'text';
  }
  if (mimeType.includes('zip') || mimeType.includes('compress')) {
    return 'archive';
  }
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }
  if (mimeType === 'application/xml') {
    return 'XML';
  }
  if (mimeType.startsWith('application')) {
    return 'document';
  }
  return undefined;
};

export const pluralizeMemo = memoize(pluralize);
