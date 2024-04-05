import retry from 'async-retry';
import pino from 'pino';
import { cloudstore } from '../firebase.server';

const logger = pino({ name: 'cloudstore:fetchers' });

const retryProps = (message: string) => {
  return {
    // see https://github.com/tim-kos/node-retry#api
    retries: 1,
    factor: 2,
    minTimeout: 500,
    onRetry: (e: unknown) => logger.warn(e, message),
  };
};

export const fetchEvent = async (pathName: string): Promise<string> => {
  return await retry(async () => {
    const [bucketName, fileName] = pathName.split(/\/(.*)/s);
    const [content] = await cloudstore.bucket(bucketName).file(fileName).download();
    return Buffer.from(content).toString();
  }, retryProps('Retrying fetchEvent...'));
};
