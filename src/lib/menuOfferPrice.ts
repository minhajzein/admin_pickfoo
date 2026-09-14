import type { AdminCustomerOffer, CustomerOfferType } from "@/types/models";

export type OfferPriceSource = Pick<
  AdminCustomerOffer,
  | "type"
  | "scope"
  | "discountValue"
  | "maxDiscountAmount"
  | "menuItemIds"
  | "restaurantIds"
  | "buyMenuItemId"
  | "getMenuItemId"
  | "getDiscountType"
  | "getDiscountValue"
  | "comboRestaurantId"
  | "comboItems"
>;

function money(n: number) {
  return Math.round(Math.max(0, n) * 100) / 100;
}

function applicableMenuItemIds(offer: OfferPriceSource): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string | null) => {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const id of offer.menuItemIds || []) push(id);
  push(offer.buyMenuItemId);
  push(offer.getMenuItemId);
  for (const c of offer.comboItems || []) push(c.menuItemId);
  return ids;
}

function appliesToItem(
  offer: OfferPriceSource,
  menuItemId: string,
  restaurantId?: string,
): boolean {
  const rid = String(restaurantId || "").trim();
  const type = offer.type as CustomerOfferType;

  if (type === "combo") {
    if (
      offer.comboRestaurantId &&
      rid &&
      String(offer.comboRestaurantId) !== rid
    ) {
      return false;
    }
    return applicableMenuItemIds(offer).includes(menuItemId);
  }

  if (type === "bogo") {
    return applicableMenuItemIds(offer).includes(menuItemId);
  }

  if (offer.scope === "items" || (offer.menuItemIds || []).length > 0) {
    return applicableMenuItemIds(offer).includes(menuItemId);
  }

  if (offer.scope === "restaurants") {
    if (!rid) return false;
    if (!(offer.restaurantIds || []).length) return true;
    return (offer.restaurantIds || []).includes(rid);
  }

  return false;
}

function candidateForOffer(
  offer: OfferPriceSource,
  listPrice: number,
  menuItemId: string,
): number | null {
  const type = offer.type as CustomerOfferType;

  if (type === "percent") {
    if (offer.discountValue <= 0) return null;
    let save = listPrice * (offer.discountValue / 100);
    if (offer.maxDiscountAmount > 0 && save > offer.maxDiscountAmount) {
      save = offer.maxDiscountAmount;
    }
    return listPrice - save;
  }

  if (type === "bogo") {
    const getId = String(offer.getMenuItemId || offer.buyMenuItemId || "").trim();
    if (!getId || getId !== menuItemId) return null;
    if (offer.getDiscountType === "free") return 0;
    if (offer.getDiscountType === "percent") {
      if (offer.getDiscountValue <= 0) return null;
      return listPrice * (1 - offer.getDiscountValue / 100);
    }
    if (offer.getDiscountType === "flat") {
      if (offer.getDiscountValue <= 0) return null;
      return Math.max(0, listPrice - offer.getDiscountValue);
    }
  }

  return null;
}

/** Derive unit offer price for admin menu / picker UIs (mirrors customer app). */
export function unitOfferPrice(params: {
  listPrice: number;
  menuItemId: string;
  restaurantId?: string;
  offers?: OfferPriceSource[];
  explicitOfferPrice?: number | null;
}): number | null {
  const {
    listPrice,
    menuItemId,
    restaurantId,
    offers = [],
    explicitOfferPrice,
  } = params;

  if (
    explicitOfferPrice != null &&
    Number.isFinite(explicitOfferPrice) &&
    explicitOfferPrice >= 0 &&
    explicitOfferPrice < listPrice - 0.009
  ) {
    return money(explicitOfferPrice);
  }

  if (listPrice <= 0 || !menuItemId.trim() || offers.length === 0) return null;

  let best: number | null = null;
  for (const offer of offers) {
    if (!appliesToItem(offer, menuItemId, restaurantId)) continue;
    const candidate = candidateForOffer(offer, listPrice, menuItemId);
    if (candidate == null || candidate < 0 || candidate >= listPrice - 0.009) {
      continue;
    }
    if (best == null || candidate < best) best = candidate;
  }
  return best == null ? null : money(best);
}
