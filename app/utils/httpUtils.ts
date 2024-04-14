import { SubmitOptions } from '@remix-run/react';

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
