// One student's QR ID card: GET /academics/attendance/id-cards/{student_id}. The QR (qr_svg,
// server-generated SVG of a signed token) is what the gate scanner reads. Reissuing a card
// (POST .../reissue) bumps card_version and the old card stops working at the gate.
import { useMemo } from 'react';

import type { IdCard } from '@/types/daily-attendance';

import { createWaitForApiClientReady, useApiClientWithLoading } from './api-client';

const BASE = '/academics/attendance/id-cards';

export function useIdCardService() {
  const { apiClient } = useApiClientWithLoading();
  const waitForApiClientReady = useMemo(() => createWaitForApiClientReady(apiClient), [apiClient]);

  return useMemo(
    () => ({
      getStudentIdCard: async (studentId: string): Promise<IdCard> => {
        const client = await waitForApiClientReady();
        return client.get<IdCard>(`${BASE}/${encodeURIComponent(studentId)}`);
      },
      reissueIdCard: async (studentId: string): Promise<IdCard> => {
        const client = await waitForApiClientReady();
        return client.post<IdCard>(`${BASE}/${encodeURIComponent(studentId)}/reissue`);
      },
    }),
    [waitForApiClientReady]
  );
}
