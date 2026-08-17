import api from "@/lib/axios";

export type RefundAmountMode = "full" | "net_items_packing" | "custom";

export type RefundPresets = {
  fullAmount: number;
  netItemsPackingAmount: number;
  itemTotal: number;
  packingTotal: number;
  discountAmount: number;
};

export type RefundCaps = {
  maxRestaurantDeduction: number;
  maxPartnerDeduction: number;
  assignedPartnerId: string | null;
  hasRestaurantCredit: boolean;
  hasPartnerTripEarning: boolean;
};

export type RefundPreviewData = {
  orderId: string;
  pickfooId?: string | null;
  paymentStatus?: string | null;
  totalAmount?: number | null;
  presets: RefundPresets;
  caps: RefundCaps;
};

export type RefundSettlementState = {
  refundAmountMode: RefundAmountMode;
  customAmount: string;
  deductFromRestaurant: boolean;
  restaurantDeductionAmount: string;
  deductFromPartner: boolean;
  partnerDeductionAmount: string;
};

export type RefundSettlementPayload = {
  refundAmountMode: RefundAmountMode;
  amount?: number;
  deductFromRestaurant?: boolean;
  restaurantDeductionAmount?: number;
  deductFromPartner?: boolean;
  partnerDeductionAmount?: number;
};

export function emptyRefundSettlementState(): RefundSettlementState {
  return {
    refundAmountMode: "full",
    customAmount: "",
    deductFromRestaurant: false,
    restaurantDeductionAmount: "",
    deductFromPartner: false,
    partnerDeductionAmount: "",
  };
}

export function resolveRefundAmount(
  state: RefundSettlementState,
  presets: RefundPresets,
): number {
  if (state.refundAmountMode === "net_items_packing") {
    return presets.netItemsPackingAmount;
  }
  if (state.refundAmountMode === "custom") {
    const n = Number(state.customAmount);
    return Number.isFinite(n) ? n : 0;
  }
  return presets.fullAmount;
}

export function buildRefundSettlementPayload(
  state: RefundSettlementState,
  presets: RefundPresets,
): RefundSettlementPayload {
  const payload: RefundSettlementPayload = {
    refundAmountMode: state.refundAmountMode,
  };

  if (state.refundAmountMode === "custom") {
    payload.amount = Number(state.customAmount);
  }

  if (state.deductFromRestaurant) {
    payload.deductFromRestaurant = true;
    payload.restaurantDeductionAmount = Number(state.restaurantDeductionAmount);
  }

  if (state.deductFromPartner) {
    payload.deductFromPartner = true;
    payload.partnerDeductionAmount = Number(state.partnerDeductionAmount);
  }

  return payload;
}

export function validateRefundSettlement(
  state: RefundSettlementState,
  presets: RefundPresets,
  caps: RefundCaps,
  maxRefund?: number,
): string | null {
  const refundAmount = resolveRefundAmount(state, presets);
  if (refundAmount <= 0) {
    return "Refund amount must be greater than zero";
  }
  const cap = maxRefund != null && maxRefund > 0 ? maxRefund : presets.fullAmount;
  if (cap > 0 && refundAmount > cap + 0.001) {
    return `Refund amount exceeds maximum (${cap.toFixed(2)})`;
  }

  if (state.deductFromRestaurant) {
    const amt = Number(state.restaurantDeductionAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return "Enter a restaurant deduction amount";
    }
    if (amt > caps.maxRestaurantDeduction + 0.001) {
      return `Restaurant deduction exceeds available credit (${caps.maxRestaurantDeduction.toFixed(2)})`;
    }
  }

  if (state.deductFromPartner) {
    const amt = Number(state.partnerDeductionAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return "Enter a partner deduction amount";
    }
    if (!caps.hasPartnerTripEarning) {
      return "Partner has no trip earning for this order yet";
    }
    if (amt > caps.maxPartnerDeduction + 0.001) {
      return `Partner deduction exceeds trip earning (${caps.maxPartnerDeduction.toFixed(2)})`;
    }
  }

  return null;
}

export async function fetchRefundPreview(
  orderRef: string,
): Promise<RefundPreviewData> {
  const { data } = await api.get(
    `/dispatch/orders/${encodeURIComponent(orderRef)}/refund-preview`,
  );
  return data.data as RefundPreviewData;
}

export function presetsFromOrder(order: {
  itemTotal?: number | null;
  packingTotal?: number | null;
  discountAmount?: number | null;
  taxableAmount?: number | null;
  totalAmount?: number | null;
}): RefundPresets {
  const itemTotal = Number(order.itemTotal) || 0;
  const packingTotal = Number(order.packingTotal) || 0;
  const discountAmount = Math.max(0, Number(order.discountAmount) || 0);
  const fullAmount = Math.max(0, Number(order.totalAmount) || 0);
  const taxable = Number(order.taxableAmount);
  let netItemsPackingAmount = taxable > 0 ? taxable : 0;
  if (netItemsPackingAmount <= 0) {
    const discountOnFood = Math.min(discountAmount, itemTotal);
    netItemsPackingAmount = Math.max(0, itemTotal + packingTotal - discountOnFood);
    netItemsPackingAmount = Math.round(netItemsPackingAmount * 100) / 100;
  }
  return {
    fullAmount,
    netItemsPackingAmount,
    itemTotal,
    packingTotal,
    discountAmount,
  };
}
