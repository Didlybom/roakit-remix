import retry from 'async-retry';
import { cloudstore } from '../firebase.server';
import { RoakitError } from '../utils/errorUtils';
import { getLogger } from '../utils/loggerUtils.server';

const logger = getLogger('cloudstore:fetchers');

const retryProps = (message: string) => ({
  // see https://github.com/tim-kos/node-retry#api
  retries: 1,
  factor: 2,
  minTimeout: 500,
  onRetry: (e: unknown) => logger.warn(e, message),
});

export const fetchEvent = async (pathName: string): Promise<string> => {
  const [bucketName, fileName] = pathName.split(/\/(.*)/s);
  if (!bucketName || !fileName) {
    throw new RoakitError('Invalid event storage location', { httpStatus: 400 });
  }
  return await retry(async () => {
    const [content] = await cloudstore.bucket(bucketName).file(fileName).download();
    return Buffer.from(content).toString();
  }, retryProps('Retrying fetchEvent...'));
};
