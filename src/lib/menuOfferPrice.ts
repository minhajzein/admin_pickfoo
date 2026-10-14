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
  | "buyVariantName"
  | "getVariantName"
  | "getDiscountType"
  | "getDiscountValue"
  | "comboRestaurantId"
  | "comboItems"
  | "scopedMenuItems"
>;

export type MenuOfferHighlight = {
  listPrice: number;
  offerPrice: number | null;
  /** Set when the shown price belongs to one variant, not the dish "from" price. */
  variantName: string;
};

function money(n: number) {
  return Math.round(Math.max(0, n) * 100) / 100;
}

function idStr(raw?: string | null) {
  return String(raw || "").trim();
}

function normName(raw?: string | null) {
  return String(raw || "").trim().toLowerCase();
}

function applicableMenuItemIds(offer: OfferPriceSource): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string | null) => {
    const id = idStr(raw);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const id of offer.menuItemIds || []) push(id);
  push(offer.buyMenuItemId);
  push(offer.getMenuItemId);
  for (const c of offer.comboItems || []) push(c.menuItemId);
  for (const s of offer.scopedMenuItems || []) push(s.menuItemId);
  return ids;
}

function appliesToItem(
  offer: OfferPriceSource,
  menuItemId: string,
  restaurantId?: string,
): boolean {
  const rid = idStr(restaurantId);
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

function variantPinForItem(offer: OfferPriceSource, menuItemId: string): string | null {
  if (offer.type === "bogo") {
    const getId = idStr(offer.getMenuItemId || offer.buyMenuItemId);
    if (getId === menuItemId) {
      const name = String(offer.getVariantName || "").trim();
      if (name) return name;
    }
  }
  for (const row of offer.scopedMenuItems || []) {
    if (idStr(row.menuItemId) !== menuItemId) continue;
    const name = String(row.variantName || "").trim();
    if (name) return name;
  }
  return null;
}

function matchesVariant(
  offer: OfferPriceSource,
  menuItemId: string,
  variantName?: string | null,
): boolean {
  const pin = variantPinForItem(offer, menuItemId);
  if (!pin) return true;
  const asked = normName(variantName);
  if (!asked) return false;
  return asked === normName(pin);
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

  if (type === "flat") {
    const itemScoped =
      offer.scope === "items" || (offer.menuItemIds || []).length > 0;
    if (!itemScoped || offer.discountValue <= 0) return null;
    return Math.max(0, listPrice - offer.discountValue);
  }

  if (type === "bogo") {
    const getId = idStr(offer.getMenuItemId || offer.buyMenuItemId);
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

function undercuts(listPrice: number, candidate: number | null): candidate is number {
  return candidate != null && candidate >= 0 && candidate < listPrice - 0.009;
}

/** Derive unit offer price for admin menu / picker UIs (mirrors customer app). */
export function unitOfferPrice(params: {
  listPrice: number;
  menuItemId: string;
  restaurantId?: string;
  offers?: OfferPriceSource[];
  explicitOfferPrice?: number | null;
  variantName?: string | null;
}): number | null {
  const {
    listPrice,
    menuItemId,
    restaurantId,
    offers = [],
    explicitOfferPrice,
    variantName,
  } = params;

  let best: number | null = null;
  if (
    explicitOfferPrice != null &&
    Number.isFinite(explicitOfferPrice) &&
    explicitOfferPrice >= 0 &&
    explicitOfferPrice < listPrice - 0.009
  ) {
    best = explicitOfferPrice;
  }

  if (listPrice > 0 && menuItemId.trim() && offers.length > 0) {
    for (const offer of offers) {
      if (!appliesToItem(offer, menuItemId, restaurantId)) continue;
      if (!matchesVariant(offer, menuItemId, variantName)) continue;
      const candidate = candidateForOffer(offer, listPrice, menuItemId);
      if (!undercuts(listPrice, candidate)) continue;
      if (best == null || candidate < best) best = candidate;
    }
  }
  return best == null ? null : money(best);
}

function offerPinnedToVariant(
  offers: OfferPriceSource[],
  menuItemId: string,
  restaurantId: string | undefined,
  variantName: string,
  listPrice: number,
): boolean {
  for (const offer of offers) {
    if (!appliesToItem(offer, menuItemId, restaurantId)) continue;
    const pin = variantPinForItem(offer, menuItemId);
    if (!pin || normName(pin) !== normName(variantName)) continue;
    if (undercuts(listPrice, candidateForOffer(offer, listPrice, menuItemId))) {
      return true;
    }
  }
  return false;
}

export function menuOfferHighlight(params: {
  menuItemId: string;
  price: number;
  variants?: { name?: string; price?: number; offerPrice?: number | null }[];
  restaurantId?: string;
  offers?: OfferPriceSource[];
  explicitOfferPrice?: number | null;
}): MenuOfferHighlight {
  const variants = (params.variants || []).filter((v) => String(v.name || "").trim());
  if (!variants.length) {
    return {
      listPrice: params.price,
      offerPrice: unitOfferPrice({
        listPrice: params.price,
        menuItemId: params.menuItemId,
        restaurantId: params.restaurantId,
        offers: params.offers,
        explicitOfferPrice: params.explicitOfferPrice,
      }),
      variantName: "",
    };
  }

  const bakedHits = variants.filter((variant) => {
    const listPrice = Number(variant.price) || 0;
    const explicit = variant.offerPrice == null ? NaN : Number(variant.offerPrice);
    return Number.isFinite(explicit) && explicit < listPrice - 0.009;
  });
  const bakedSpecificName =
    !(params.offers || []).length && bakedHits.length === 1 && variants.length > 1
      ? String(bakedHits[0].name || "").trim()
      : "";

  let specific: MenuOfferHighlight | null = null;
  let general: MenuOfferHighlight | null = null;
  for (const variant of variants) {
    const name = String(variant.name || "").trim();
    const listPrice = Number(variant.price) || 0;
    const explicit = variant.offerPrice == null ? null : Number(variant.offerPrice);
    const offerPrice = unitOfferPrice({
      listPrice,
      menuItemId: params.menuItemId,
      restaurantId: params.restaurantId,
      offers: params.offers,
      variantName: name,
      explicitOfferPrice: Number.isFinite(explicit) ? explicit : null,
    });
    if (offerPrice == null) continue;
    const quote: MenuOfferHighlight = { listPrice, offerPrice, variantName: name };
    const pinned =
      offerPinnedToVariant(
        params.offers || [],
        params.menuItemId,
        params.restaurantId,
        name,
        listPrice,
      ) || normName(bakedSpecificName) === normName(name);
    if (pinned) specific = preferSpecific(specific, quote);
    else general = preferCheapest(general, { ...quote, variantName: "" });
  }

  if (specific) return specific;
  if (general) return general;

  let cheapest = variants[0];
  for (const variant of variants) {
    if ((Number(variant.price) || 0) < (Number(cheapest.price) || 0)) cheapest = variant;
  }
  return {
    listPrice: Number(cheapest.price) || 0,
    offerPrice: null,
    variantName: "",
  };
}

function preferSpecific(
  current: MenuOfferHighlight | null,
  next: MenuOfferHighlight,
): MenuOfferHighlight {
  if (!current) return next;
  const saveCurrent = current.listPrice - (current.offerPrice ?? current.listPrice);
  const saveNext = next.listPrice - (next.offerPrice ?? next.listPrice);
  if (saveNext > saveCurrent + 0.009) return next;
  if (saveCurrent > saveNext + 0.009) return current;
  return (next.offerPrice ?? next.listPrice) < (current.offerPrice ?? current.listPrice)
    ? next
    : current;
}

function preferCheapest(
  current: MenuOfferHighlight | null,
  next: MenuOfferHighlight,
): MenuOfferHighlight {
  if (!current) return next;
  return (next.offerPrice ?? next.listPrice) < (current.offerPrice ?? current.listPrice)
    ? next
    : current;
}
