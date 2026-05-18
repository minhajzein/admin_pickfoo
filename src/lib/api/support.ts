import api from '../axios';

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

export async function fetchSupportThreads(): Promise<SupportThread[]> {
  const { data } = await api.get<{ success: boolean; threads: SupportThread[] }>(
    '/support/threads',
  );
  return data.threads ?? [];
}

export async function fetchSupportThread(partnerId: string): Promise<{
  thread: SupportThread;
  messages: SupportMessage[];
}> {
  const { data } = await api.get<{
    success: boolean;
    data: { thread: SupportThread; messages: SupportMessage[] };
  }>(`/support/threads/${partnerId}`);
  return data.data;
}

export async function sendSupportMessage(
  partnerId: string,
  body: string,
): Promise<SupportMessagePayload> {
  const { data } = await api.post<{ success: boolean; data: SupportMessagePayload }>(
    `/support/threads/${partnerId}/messages`,
    { body },
  );
  return data.data;
}

export async function markSupportThreadRead(partnerId: string): Promise<void> {
  await api.post(`/support/threads/${partnerId}/read`, {});
}
