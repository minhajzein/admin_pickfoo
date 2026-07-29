import api from '../axios';

export interface RestaurantMessage {
  id: string;
  sender: 'owner' | 'admin';
  text: string;
  read: boolean;
  createdAt: string;
}

export async function fetchRestaurantMessages(ownerId: string): Promise<{
  messages: RestaurantMessage[];
  unreadCount: number;
}> {
  const { data } = await api.get<{
    success: boolean;
    data: RestaurantMessage[];
    unreadCount: number;
  }>(`/restaurant-messages/${encodeURIComponent(ownerId)}`);
  return { messages: data.data ?? [], unreadCount: data.unreadCount ?? 0 };
}

export async function sendRestaurantMessage(
  ownerId: string,
  text: string,
): Promise<RestaurantMessage> {
  const { data } = await api.post<{ success: boolean; data: RestaurantMessage }>(
    `/restaurant-messages/${encodeURIComponent(ownerId)}`,
    { text },
  );
  return data.data;
}
