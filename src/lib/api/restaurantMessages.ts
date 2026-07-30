import api from '../axios';
import {
  DEFAULT_PAGE_SIZE,
  parsePaginatedResponse,
  type PaginatedResult,
} from '@/lib/pagination';

export interface RestaurantMessage {
  id: string;
  sender: 'owner' | 'admin';
  text: string;
  read: boolean;
  createdAt: string;
}

export interface RestaurantMessageThreadSummary {
  ownerId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  restaurantId?: string | null;
  restaurantName?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastSender?: 'owner' | 'admin' | null;
  unreadByAdmin: number;
}

function normalizeMessage(raw: any): RestaurantMessage {
  return {
    id: String(raw?.id ?? raw?._id ?? ''),
    sender: raw?.sender === 'admin' ? 'admin' : 'owner',
    text: String(raw?.text ?? ''),
    read: Boolean(raw?.read),
    createdAt: String(raw?.createdAt ?? ''),
  };
}

export async function fetchRestaurantMessageThreads(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<RestaurantMessageThreadSummary>> {
  const { data } = await api.get<{
    success: boolean;
    data?: RestaurantMessageThreadSummary[];
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
    };
  }>('/restaurant-messages', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? DEFAULT_PAGE_SIZE,
    },
  });

  const nested = data.pagination;
  return parsePaginatedResponse({
    data: data.data ?? [],
    page: nested?.page ?? data.page,
    limit: nested?.limit ?? data.limit,
    total: nested?.total ?? data.total,
    totalPages: nested?.totalPages ?? data.totalPages,
  });
}

export async function fetchRestaurantMessages(ownerId: string): Promise<{
  messages: RestaurantMessage[];
  unreadCount: number;
}> {
  const { data } = await api.get<{
    success: boolean;
    data: any[];
    unreadCount: number;
  }>(`/restaurant-messages/${encodeURIComponent(ownerId)}`);
  return {
    messages: (data.data ?? []).map(normalizeMessage),
    unreadCount: data.unreadCount ?? 0,
  };
}

export async function sendRestaurantMessage(
  ownerId: string,
  text: string,
): Promise<RestaurantMessage> {
  const { data } = await api.post<{ success: boolean; data: any }>(
    `/restaurant-messages/${encodeURIComponent(ownerId)}`,
    { text },
  );
  return normalizeMessage(data.data);
}

export async function markRestaurantMessagesRead(ownerId: string): Promise<void> {
  await api.post(`/restaurant-messages/${encodeURIComponent(ownerId)}/read`);
}
