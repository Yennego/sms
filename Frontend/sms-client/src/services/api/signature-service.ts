// My signature: /auth/me/signature (phase4-design.md section 6).
// A signature belongs to the signed-in person; only they can set or remove it. The server
// normalises the upload (PNG, trimmed, at most 600 x 200 px) and returns it as a data URL.
import { useMemo } from 'react';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

export interface MySignature {
  has_signature: boolean;
  /** data:image/png;base64,... or null when there is none. */
  image: string | null;
  updated_at: string | null;
}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function normalise(resp: unknown): MySignature {
  const o = isObj(resp) ? resp : {};
  const image = typeof o.image === 'string' && o.image ? o.image : null;
  return {
    has_signature: typeof o.has_signature === 'boolean' ? o.has_signature && Boolean(image) : Boolean(image),
    image,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : null,
  };
}

/** Multipart body with one `file` field. The explicit content type stops axios from turning the
 * FormData into JSON (the client defaults to application/json); the browser adds the boundary. */
export function fileForm(file: Blob, filename: string): FormData {
  const form = new FormData();
  form.append('file', file, filename);
  return form;
}

export const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } } as const;

export function useSignatureService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      getMine: async (): Promise<MySignature> => {
        const client = await waitForApiClientReady();
        return normalise(await client.get<unknown>('/auth/me/signature'));
      },

      /** PNG or JPEG, at most 1 MB. A drawn signature is sent as a PNG. */
      saveMine: async (file: Blob, filename: string): Promise<MySignature> => {
        const client = await waitForApiClientReady();
        return normalise(await client.put<unknown>('/auth/me/signature', fileForm(file, filename), MULTIPART));
      },

      removeMine: async (): Promise<void> => {
        const client = await waitForApiClientReady();
        await client.delete<unknown>('/auth/me/signature');
      },
    }),
    [waitForApiClientReady]
  );
}
