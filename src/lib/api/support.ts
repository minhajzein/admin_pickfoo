import api from '../axios';
import type { AxiosError } from 'axios';

export interface SupportThread {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  partnerPhone?: string | null;
  status: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadByAdmin: number;
  unreadByPartner: number;
}

export interface SupportMessage {
  id: string;
  threadId: string;
  partnerId: string;
  senderType: 'partner' | 'admin';
  senderId?: string | null;
  senderLabel?: string | null;
  body: string;
  createdAt: string;
}

export interface SupportMessagePayload {
  thread: SupportThread;
  message: SupportMessage;
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const ax = err as AxiosError<{ message?: string }>;
  return ax.response?.data?.message || ax.message || fallback;
}

export async function fetchSupportThreads(): Promise<SupportThread[]> {
  const { data } = await api.get<{ success: boolean; threads: SupportThread[] }>(
    '/support/threads',
  );
  if (data.success === false) {
    throw new Error('Failed to load support threads');
  }
  return data.threads ?? [];
}

export async function fetchSupportThread(partnerId: string): Promise<{
  thread: SupportThread;
  messages: SupportMessage[];
}> {
  const { data } = await api.get<{
    success: boolean;
    data: { thread: SupportThread; messages: SupportMessage[] };
    message?: string;
  }>(`/support/threads/${encodeURIComponent(partnerId)}`);
  if (data.success === false || !data.data) {
    throw new Error(data.message || 'Failed to load conversation');
  }
  return data.data;
}

export async function sendSupportMessage(
  partnerId: string,
  body: string,
): Promise<SupportMessagePayload> {
  try {
    const { data } = await api.post<{
      success: boolean;
      data?: SupportMessagePayload;
      message?: string;
    }>(`/support/threads/${encodeURIComponent(partnerId)}/messages`, { body });
    if (!data.success || !data.data?.message) {
      throw new Error(data.message || 'Failed to send message');
    }
    return data.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, 'Failed to send message'));
  }
}

export async function markSupportThreadRead(partnerId: string): Promise<void> {
  await api.post(`/support/threads/${encodeURIComponent(partnerId)}/read`, {});
}

/** Notify support page listeners (same shape as socket `support:message`). */
export function dispatchAdminSupportMessage(payload: SupportMessagePayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('admin:support-message', { detail: payload }),
  );
}
