import { createClientId } from '../../app/utils/createClientId.server';

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
});

afterAll(() => {
  process.env = OLD_ENV;
});

test('createClientId', () => {
  process.env.CLIENT_ID_KEY = 'secretKeyValue';
  const encodedClientId = createClientId(100, 1);
  expect(encodedClientId).toEqual('CGQQAUIMOTM5M2VjNDU4Yzdj');
});
