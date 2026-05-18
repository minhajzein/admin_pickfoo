import api from '../axios';
import type { AxiosError } from 'axios';

export type SupportMessageType = 'text' | 'image' | 'video' | 'pdf' | 'audio';

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
  messageType: SupportMessageType;
  body: string;
  mediaUrl?: string | null;
  mediaFileName?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaDurationMs?: number | null;
  createdAt: string;
}

export interface SupportMessagePayload {
  thread: SupportThread;
  message: SupportMessage;
}

export interface SupportMediaUpload {
  staticUrl: string;
  fileUrl: string;
  messageType: SupportMessageType;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
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

export async function uploadSupportMedia(file: File): Promise<SupportMediaUpload> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{
    success: boolean;
    data?: SupportMediaUpload & { fileType?: string };
    message?: string;
  }>('/support/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  if (!data.success || !data.data?.staticUrl) {
    throw new Error(data.message || 'Failed to upload file');
  }
  return {
    staticUrl: data.data.staticUrl,
    fileUrl: data.data.fileUrl,
    messageType: (data.data.messageType as SupportMessageType) || 'image',
    fileName: data.data.fileName,
    fileSize: data.data.fileSize,
    fileType: data.data.fileType,
  };
}

export interface SendSupportMessageInput {
  body?: string;
  messageType: SupportMessageType;
  mediaStaticUrl?: string;
  mediaFileName?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  mediaDurationMs?: number;
}

export async function sendSupportMessage(
  partnerId: string,
  input: SendSupportMessageInput,
): Promise<SupportMessagePayload> {
  try {
    const { data } = await api.post<{
      success: boolean;
      data?: SupportMessagePayload;
      message?: string;
    }>(`/support/threads/${encodeURIComponent(partnerId)}/messages`, input);
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

export function dispatchAdminSupportMessage(payload: SupportMessagePayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('admin:support-message', { detail: payload }),
  );
}
