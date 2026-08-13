import api from "@/lib/axios";

export type CustomerPaymentStatus =
  | "created"
  | "captured"
  | "failed"
  | "refunded"
  | "success";

export interface CustomerPaymentSummary {
  user: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    externalUserId?: string;
  };
  summary: {
    totalPaid: number;
    paidCount: number;
    totalRefunded: number;
    refundedCount: number;
    failedCount: number;
    pendingCount: number;
    byStatus: Record<string, { total: number; count: number }>;
  };
}

export interface CustomerPaymentTransaction {
  _id: string;
  amount: number;
  currency?: string;
  status: CustomerPaymentStatus;
  gateway?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  errorCode?: string;
  errorDescription?: string;
  metadata?: {
    refundReason?: string;
    refundAmount?: number;
    refundedAt?: string;
    recordOnly?: boolean;
    razorpayRefundId?: string;
    razorpayRefundStatus?: string;
  };
  createdAt?: string;
  restaurant?: { _id: string; name?: string } | string | null;
  order?: {
    _id: string;
    pickfooId?: string;
    status?: string;
    totalAmount?: number;
    paymentStatus?: string;
  } | string | null;
}

export async function fetchCustomerPaymentSummary(
  userId: string,
): Promise<CustomerPaymentSummary> {
  const { data } = await api.get(`/users/${userId}/payments`);
  return data.data;
}

export async function fetchCustomerPaymentTransactions(
  userId: string,
  params?: { status?: string; search?: string; limit?: number },
): Promise<CustomerPaymentTransaction[]> {
  const { data } = await api.get(`/users/${userId}/payments/transactions`, {
    params,
  });
  return data.data ?? [];
}

export async function refundCustomerPayment(
  userId: string,
  txId: string,
  payload: { reason?: string; amount?: number; recordOnly?: boolean },
): Promise<{ data: CustomerPaymentTransaction; razorpay?: unknown }> {
  const { data } = await api.post(
    `/users/${userId}/payments/${txId}/refund`,
    payload,
  );
  return data;
}

export async function raiseCustomerOrderFromPayment(
  userId: string,
  txId: string,
): Promise<{ data?: CustomerPaymentTransaction; alreadyRaised?: boolean; message?: string }> {
  const { data } = await api.post(`/users/${userId}/payments/${txId}/raise-order`);
  return data;
}

export async function raiseCustomerOrderFromRefs(
  userId: string,
  payload: {
    orderId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
  },
): Promise<{ data?: unknown; alreadyRaised?: boolean; message?: string }> {
  const { data } = await api.post(`/users/${userId}/payments/raise-order`, payload);
  return data;
}
