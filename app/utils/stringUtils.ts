export const caseInsensitiveSort = (data: string[]): string[] =>
  data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export const JIRA_REGEXP = /([A-Z][A-Z0-9]+-[0-9]+)/;
const JIRA_REGEXP_GLOBAL = /([A-Z][A-Z0-9]+-[0-9]+)/g;

export const findJiraProjects = (data?: string): string[] => {
  const tickets = data ? data.match(JIRA_REGEXP_GLOBAL) ?? [] : [];
  return [...new Set(tickets.map(t => t.split('-')[0]))]; // new Set() dedupes
};

export const removeSpaces = (data: string): string => data.replace(/\s/g, '');
