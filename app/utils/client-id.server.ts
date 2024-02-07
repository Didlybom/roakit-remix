// See https://source.cloud.google.com/eternal-impulse-412418/liaison/+/main:functions/build/client-id.ts

import { Buffer } from 'buffer';
import crypto from 'crypto';
import { liaison } from '../proto/liaison';
import ClientId = liaison.v1.ClientId;

const ALGORITHM = 'sha256';
const CHECKSUM_LENGTH = 12;
const HEX_ENCODING: crypto.BinaryToTextEncoding = 'hex';

export function createClientId(customerId: number, feedId: number): string {
  // To compute `checksum` field, we must fill in all other fields first.
  const payload: ClientId = new ClientId();
  payload.customerId = customerId;
  payload.feedId = feedId;

  const buffer: Buffer = Buffer.from(payload.serializeBinary());
  // Generate `Checksum` field and inject it into our `payload`.

  payload.checksum = crypto
    .createHmac(ALGORITHM, process.env.LIAISON_SERVICE_SECRET!)
    .update(buffer)
    .digest(HEX_ENCODING)
    .substring(0, CHECKSUM_LENGTH);

  // Convert finalized client identifier into a URL safe base64 value.
  const clientId: Buffer = Buffer.from(payload.serializeBinary());
  return clientId.toString('base64url');
}
