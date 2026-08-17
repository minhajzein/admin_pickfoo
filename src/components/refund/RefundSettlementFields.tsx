"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  RefundAmountMode,
  RefundCaps,
  RefundPresets,
  RefundSettlementState,
} from "@/lib/api/refund-settlement";
import { resolveRefundAmount } from "@/lib/api/refund-settlement";

function inr(n: number | undefined | null) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

type Props = {
  state: RefundSettlementState;
  onChange: (next: RefundSettlementState) => void;
  presets: RefundPresets;
  caps: RefundCaps;
  maxRefund?: number;
  disabled?: boolean;
  showWalletOptions?: boolean;
};

function suggestRestaurantAmount(
  refundAmount: number,
  caps: RefundCaps,
): string {
  if (caps.maxRestaurantDeduction <= 0) return "";
  const n = Math.min(refundAmount, caps.maxRestaurantDeduction);
  return n > 0 ? String(Math.round(n * 100) / 100) : "";
}

function suggestPartnerAmount(caps: RefundCaps): string {
  if (caps.maxPartnerDeduction <= 0) return "";
  return String(Math.round(caps.maxPartnerDeduction * 100) / 100);
}

export function RefundSettlementFields({
  state,
  onChange,
  presets,
  caps,
  maxRefund,
  disabled = false,
  showWalletOptions = true,
}: Props) {
  const effectiveRefund = resolveRefundAmount(state, presets);
  const refundCap =
    maxRefund != null && maxRefund > 0 ? maxRefund : presets.fullAmount;

  useEffect(() => {
    if (state.refundAmountMode === "custom" && !state.customAmount) {
      onChange({
        ...state,
        customAmount:
          effectiveRefund > 0 ? String(effectiveRefund) : state.customAmount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.refundAmountMode]);

  const setMode = (mode: RefundAmountMode) => {
    onChange({ ...state, refundAmountMode: mode });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-white/50">Refund amount</Label>
        <div className="grid gap-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-sm">
            <input
              type="radio"
              name="refundAmountMode"
              className="mt-1"
              checked={state.refundAmountMode === "full"}
              disabled={disabled}
              onChange={() => setMode("full")}
            />
            <span>
              <span className="block text-white/90">Full order total</span>
              <span className="text-white/45">{inr(presets.fullAmount)}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-sm">
            <input
              type="radio"
              name="refundAmountMode"
              className="mt-1"
              checked={state.refundAmountMode === "net_items_packing"}
              disabled={disabled}
              onChange={() => setMode("net_items_packing")}
            />
            <span>
              <span className="block text-white/90">Items + packing (net)</span>
              <span className="text-white/45">
                {inr(presets.netItemsPackingAmount)} · items {inr(presets.itemTotal)} + packing{" "}
                {inr(presets.packingTotal)}
                {presets.discountAmount > 0
                  ? ` − discount ${inr(presets.discountAmount)}`
                  : ""}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-sm">
            <input
              type="radio"
              name="refundAmountMode"
              className="mt-1"
              checked={state.refundAmountMode === "custom"}
              disabled={disabled}
              onChange={() => setMode("custom")}
            />
            <span className="flex-1 space-y-2">
              <span className="block text-white/90">Custom amount</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                max={refundCap > 0 ? refundCap : undefined}
                value={state.customAmount}
                disabled={disabled || state.refundAmountMode !== "custom"}
                onChange={(e) =>
                  onChange({ ...state, customAmount: e.target.value })
                }
                className="bg-black/30 border-white/10"
              />
            </span>
          </label>
        </div>
        <p className="text-xs text-white/40">
          Refunding {inr(effectiveRefund)}
          {refundCap > 0 ? ` (max ${inr(refundCap)})` : ""}
        </p>
      </div>

      {showWalletOptions ? (
        <div className="space-y-3 rounded-md border border-white/10 bg-black/10 p-3">
          <p className="text-sm font-medium text-white/80">Wallet deductions</p>

          <label className="flex items-start gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              className="mt-1"
              disabled={disabled || !caps.hasRestaurantCredit}
              checked={state.deductFromRestaurant}
              onChange={(e) => {
                const checked = e.target.checked;
                onChange({
                  ...state,
                  deductFromRestaurant: checked,
                  restaurantDeductionAmount: checked
                    ? state.restaurantDeductionAmount ||
                      suggestRestaurantAmount(effectiveRefund, caps)
                    : "",
                });
              }}
            />
            <span className="flex-1 space-y-2">
              <span>Deduct from restaurant wallet</span>
              <span className="block text-xs text-white/40">
                Available {inr(caps.maxRestaurantDeduction)}
                {!caps.hasRestaurantCredit ? " · no credit on this order" : ""}
              </span>
              {state.deductFromRestaurant ? (
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={state.restaurantDeductionAmount}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      restaurantDeductionAmount: e.target.value,
                    })
                  }
                  className="bg-black/30 border-white/10"
                />
              ) : null}
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              className="mt-1"
              disabled={disabled || !caps.hasPartnerTripEarning}
              checked={state.deductFromPartner}
              onChange={(e) => {
                const checked = e.target.checked;
                onChange({
                  ...state,
                  deductFromPartner: checked,
                  partnerDeductionAmount: checked
                    ? state.partnerDeductionAmount || suggestPartnerAmount(caps)
                    : "",
                });
              }}
            />
            <span className="flex-1 space-y-2">
              <span>Deduct from delivery partner wallet</span>
              <span className="block text-xs text-white/40">
                Trip earning {inr(caps.maxPartnerDeduction)}
                {!caps.hasPartnerTripEarning
                  ? " · partner not paid for this order yet"
                  : ""}
              </span>
              {state.deductFromPartner ? (
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={state.partnerDeductionAmount}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      partnerDeductionAmount: e.target.value,
                    })
                  }
                  className="bg-black/30 border-white/10"
                />
              ) : null}
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
