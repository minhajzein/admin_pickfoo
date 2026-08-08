"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type WithdrawalBankAccount = {
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  accountNumberLast4?: string;
  ifscCode?: string;
  upiId?: string;
};

function displayAccountNumber(bank?: WithdrawalBankAccount | null) {
  const num = bank?.accountNumber?.replace(/\s/g, "").trim();
  if (num) return num;
  if (bank?.accountNumberLast4) return `•••• ${bank.accountNumberLast4}`;
  return null;
}

async function copyValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function DetailRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-white/35">
          {label}
        </div>
        <div
          className={
            mono
              ? "break-all font-mono text-[12px] text-white/85"
              : "break-words text-[12px] text-white/85"
          }
        >
          {value}
        </div>
      </div>
      {copyable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-white/40 hover:bg-white/10 hover:text-white"
          title={`Copy ${label}`}
          onClick={() => void copyValue(label, value)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
}

/** Full payout account block for admin withdrawal tables. */
export function WithdrawalAccountDetails({
  bank,
  className,
}: {
  bank?: WithdrawalBankAccount | null;
  className?: string;
}) {
  if (!bank) {
    return <span className="text-white/45">—</span>;
  }

  const accountNumber = displayAccountNumber(bank);
  const holder = bank.accountHolderName?.trim();
  const bankName = bank.bankName?.trim();
  const ifsc = bank.ifscCode?.trim()?.toUpperCase();
  const upi = bank.upiId?.trim();

  if (!holder && !bankName && !accountNumber && !ifsc && !upi) {
    return <span className="text-white/45">—</span>;
  }

  return (
    <div className={`space-y-1.5 min-w-[180px] ${className ?? ""}`}>
      {holder ? <DetailRow label="Holder" value={holder} copyable /> : null}
      {bankName ? <DetailRow label="Bank" value={bankName} /> : null}
      {accountNumber ? (
        <DetailRow label="A/C No" value={accountNumber} mono copyable />
      ) : null}
      {ifsc ? <DetailRow label="IFSC" value={ifsc} mono copyable /> : null}
      {upi ? <DetailRow label="UPI" value={upi} mono copyable /> : null}
    </div>
  );
}
