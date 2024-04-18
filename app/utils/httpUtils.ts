import { SubmitOptions, json } from '@remix-run/react';

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

export const contentLength = (data: string) => Buffer.byteLength(data, 'utf8');

export const jsonResponse = (data: unknown, options?: { calcContentLength?: boolean }) => {
  const jsonString = JSON.stringify(data);
  return new Response(jsonString, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // for perf reason, .length is good enough (typically used by server to decide to compress if < 1k)
      'Content-Length': `${options?.calcContentLength ? contentLength(jsonString) : jsonString.length}`,
    },
  });
};

export interface ErrorField {
  message: string;
  status?: number;
}

export const errorJsonResponse = (message: string, status: number) =>
  json({ error: { message, status } as ErrorField }, { status });
