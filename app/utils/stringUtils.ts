export const caseInsensitiveSort = (data: string[]): string[] =>
  data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export const caseInsensitiveCompare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

export const JIRA_REGEXP = /([A-Z][A-Z0-9]+)(?=-[0-9]+)/;
export const JIRA_REGEXP_G = /([A-Z][A-Z0-9]+)(?=-[0-9]+)/g;

export const findJiraProjects = (data?: string): string[] => {
  if (!data) {
    return [];
  }
  const projects = new Set<string>();
  [...data.matchAll(JIRA_REGEXP_G)].forEach(m => {
    projects.add(m[1]); // dedupes
  });
  return [...projects];
};

export const removeSpaces = (data: string): string => data.replace(/\s/g, '');

export const capitalizeAndUseSpaces = (data?: string) =>
  !data ? '' : (data.charAt(0).toUpperCase() + data.slice(1)).replace(/_/g, ' ');
