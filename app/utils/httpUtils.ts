import type { SubmitOptions } from '@remix-run/react';
import { json } from '@remix-run/react';

export const postJsonOptions: SubmitOptions = {
  method: 'POST',
  encType: 'application/json',
};

export const deleteJsonOptions: SubmitOptions = {
  method: 'DELETE',
  encType: 'application/json',
};

export const postJson = async (action: string, body: unknown) => {
  await fetch(action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

export const contentLength = (data: string) => Buffer.byteLength(data, 'utf8'); // slow

export type ErrorField = {
  message: string;
  status?: number;
};

export const errorJsonResponse = (message: string, status: number) =>
  json({ error: { message, status } as ErrorField }, { status });

export const errorResponse = (message: string, status: number) => ({
  error: { message, status } as ErrorField,
});
