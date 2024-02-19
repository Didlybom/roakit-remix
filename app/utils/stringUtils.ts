export const caseInsensitiveSort = (data: string[]): string[] =>
  data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export const JIRA_REGEXP = /([A-Z][A-Z0-9]+-[0-9]+)/;

export const findJiraTickets = (data?: string): string[] => {
  const tickets = data ? data.match(JIRA_REGEXP) ?? [] : [];
  return [...new Set(tickets)]; // new Set() dedupes
};

export const removeSpaces = (data: string): string => data.replace(/\s/g, '');
