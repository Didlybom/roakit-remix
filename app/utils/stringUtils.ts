export const caseInsensitiveSort = (data: string[]): string[] =>
  data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export const findJiraTickets = (data?: string): string[] => {
  const tickets = data ? data.match(/([A-Z][A-Z0-9]+-[0-9]+)/g) ?? [] : [];
  return [...new Set(tickets)]; // set dedupes
};
