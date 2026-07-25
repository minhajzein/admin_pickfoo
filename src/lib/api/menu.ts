import api from "@/lib/axios";

export interface AdminMenuVariant {
  name: string;
  price: number;
}

export interface AdminMenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  type?: "breakfast" | "lunch" | "dinner";
  mealTypes?: ("breakfast" | "lunch" | "dinner")[];
  preparationTime?: number;
  packingCharge?: number;
  variants?: AdminMenuVariant[];
  category: string;
  isVeg: boolean;
  isActive: boolean;
  image?: string;
  ingredients?: string[];
  restaurants?: string[];
  restaurantTypes?: string[];
  rating?: number;
  numReviews?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCategory {
  _id: string;
  name: string;
  image?: string;
  owner?: string;
  parent?: string | null;
}

export interface AdminMenuItemInput {
  name: string;
  description: string;
  price: number;
  category: string;
  type: "breakfast" | "lunch" | "dinner";
  preparationTime: number;
  packingCharge: number;
  variants?: AdminMenuVariant[];
  isVeg: boolean;
  isActive: boolean;
  image?: string;
  ingredients?: string[];
  restaurantTypes?: string[];
}

export async function fetchRestaurantMenu(
  restaurantId: string,
): Promise<AdminMenuItem[]> {
  const { data } = await api.get(`/restaurants/${restaurantId}/menu`);
  return (data.data ?? []) as AdminMenuItem[];
}

export async function createRestaurantMenuItem(
  restaurantId: string,
  payload: AdminMenuItemInput,
): Promise<AdminMenuItem> {
  const { data } = await api.post(`/restaurants/${restaurantId}/menu`, payload);
  return data.data as AdminMenuItem;
}

export async function updateRestaurantMenuItem(
  restaurantId: string,
  itemId: string,
  payload: Partial<AdminMenuItemInput>,
): Promise<AdminMenuItem> {
  const { data } = await api.put(
    `/restaurants/${restaurantId}/menu/${itemId}`,
    payload,
  );
  return data.data as AdminMenuItem;
}

export async function deleteRestaurantMenuItem(
  restaurantId: string,
  itemId: string,
): Promise<void> {
  await api.delete(`/restaurants/${restaurantId}/menu/${itemId}`);
}

export async function fetchCategories(): Promise<AdminCategory[]> {
  const { data } = await api.get("/menu/categories");
  return (data.data ?? []) as AdminCategory[];
}

export async function createCategoryForRestaurant(
  restaurantId: string,
  payload: { name: string; image?: string; parent?: string | null },
): Promise<AdminCategory> {
  const { data } = await api.post(
    `/restaurants/${restaurantId}/categories`,
    payload,
  );
  return data.data as AdminCategory;
}

export async function updateCategory(
  categoryId: string,
  payload: Partial<{ name: string; image?: string; parent?: string | null }>,
): Promise<AdminCategory> {
  const { data } = await api.put(`/menu/categories/${categoryId}`, payload);
  return data.data as AdminCategory;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await api.delete(`/menu/categories/${categoryId}`);
}

export async function uploadMenuImage(
  file: File,
  folder: "menu-items" | "categories" = "menu-items",
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const { data } = await api.post<{
    success: boolean;
    data?: { fileUrl?: string; staticUrl?: string };
    message?: string;
  }>("/menu/upload", form, {
    timeout: 120_000,
    transformRequest: [
      (body, headers) => {
        if (body instanceof FormData) {
          delete headers["Content-Type"];
        }
        return body;
      },
    ],
  });
  if (!data.success || !(data.data?.staticUrl || data.data?.fileUrl)) {
    throw new Error(data.message || "Upload failed");
  }
  return data.data.staticUrl ?? data.data.fileUrl!;
}
