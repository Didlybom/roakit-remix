export enum Role {
  Admin = 'admin',
  Monitor = 'monitor',
  Contributor = 'contributor',
}

export const Roles = [Role.Admin, Role.Monitor, Role.Contributor] as const;

export const DEFAULT_ROLE = Role.Contributor;
