"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const OrderDetailView = dynamic(() => import("./OrderDetailView"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#98E32F]" />
    </div>
  ),
});

export default function OrderDetailPage() {
  return <OrderDetailView />;
}
