/**
 * Serializable shapes aligned with:
 * - Customer app: app_pickfoo (user fields)
 * - Restaurant app: restaurant/backend + app_pickfoo (restaurant schema)
 * - Delivery partner: delivery_partner/backend (Partner)
 */

export type UserRole = 'user' | 'admin' | 'owner';

export interface DeliveryAddress {
  label?: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

export interface User {
  _id?: string;
  id?: string;
  name: string;
  /** Public Pickfoo user id (PFU-…). */
  externalUserId?: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
  role: UserRole;
  isVerified: boolean;
  defaultDeliveryAddress?: DeliveryAddress;
  recentSearches?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type RestaurantStatus =
  | 'inactive'
  | 'pending'
  | 'active'
  | 'rejected'
  | 'suspended';

export const RESTAURANT_TYPES = [
  'restaurant',
  'bakery',
  'coolbar',
  'hotbar',
  'home_made',
] as const;

export type RestaurantType = (typeof RESTAURANT_TYPES)[number];

export type ZoneGeometryType = "Polygon" | "MultiPolygon";

export interface ZoneGeometry {
  type: ZoneGeometryType;
  coordinates: number[][][] | number[][][][];
}

/** Single polygon (Mapbox Draw + primary zone shape). */
export type PolygonZoneGeometry = Extract<ZoneGeometry, { type: "Polygon" }>;

export interface DeliveryZoneSummary {
  _id: string;
  name: string;
  code: string;
  district: string;
  color?: string;
}

export interface DeliveryZone extends DeliveryZoneSummary {
  geometry: ZoneGeometry;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates?: { lat: number; lng: number };
}

export interface RestaurantLegalDocs {
  fssaiLicenseNumber: string;
  fssaiCertificateUrl?: string;
  gstNumber?: string;
  gstCertificateUrl?: string;
  tradeLicenseNumber?: string;
  tradeLicenseUrl?: string;
  healthCertificateUrl?: string;
  panNumber?: string;
}

export interface OpeningHour {
  day: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface Restaurant {
  _id?: string;
  owner: string;
  name: string;
  description: string;
  restaurantTypes?: RestaurantType[];
  address: RestaurantAddress;
  contactNumber: string;
  email: string;
  /** Square brand mark for listings; cover photo is `image`. */
  brandLogo?: string;
  image: string;
  legalDocs: RestaurantLegalDocs;
  status: RestaurantStatus;
  verificationNotes?: string;
  rating: number;
  numReviews: number;
  isOpen: boolean;
  isManualOverride: boolean;
  openingHours: OpeningHour[];
  zone?: string | DeliveryZoneSummary | null;
  /** Platform commission on orders (%). Set via admin only. */
  commissionPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const PartnerStatus = {
  ONBOARDING: 'ONBOARDING',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type PartnerStatusType =
  (typeof PartnerStatus)[keyof typeof PartnerStatus];

export interface PartnerAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface PartnerLicence {
  number?: string;
  expiry?: string;
  document?: string;
  documentUrl?: string;
}

export type PartnerVehicleType = 'bike' | 'scooter';

export interface PartnerVehicle {
  type?: PartnerVehicleType;
  plateNumber?: string;
  model?: string;
  color?: string;
  image?: string;
  imageUrl?: string;
  document?: string;
  averageMileage?: number;
}

export const SecurityDepositStatus = {
  PENDING: 'pending',
  PAY_AT_OFFICE: 'pay_at_office',
  PAID: 'paid',
  REFUND_ELIGIBLE: 'refund_eligible',
  REFUNDED: 'refunded',
  FORFEITED: 'forfeited',
} as const;

export type SecurityDepositStatusType =
  (typeof SecurityDepositStatus)[keyof typeof SecurityDepositStatus];

export interface PartnerSecurityDeposit {
  amount: number;
  currency: string;
  status: SecurityDepositStatusType;
  items: string[];
  refundAfterOrders: number;
  paymentMethod?: 'razorpay' | 'office';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paidAt?: string;
  officeSelectedAt?: string;
  refundEligibleAt?: string;
  refundedAt?: string;
  errorCode?: string;
  errorDescription?: string;
}

export interface PartnerLivenessCheck {
  isLiveConfirmed: boolean;
  selfieImage?: string;
  selfieImageUrl?: string;
  checkedAt?: string;
}

export type PartnerLicenceVerificationMethod = 'manual' | 'digilocker';

export type PartnerLicenceVerificationStatus =
  | 'not_submitted'
  | 'pending_admin_review'
  | 'verified'
  | 'rejected';

export interface PartnerLicenceVerification {
  method?: PartnerLicenceVerificationMethod;
  status: PartnerLicenceVerificationStatus;
  digilockerReference?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface Partner {
  _id?: string;
  fullName: string;
  email: string;
  phone: string;
  phoneVerifiedAt?: string;
  age?: number;
  /** ISO date string YYYY-MM-DD */
  dateOfBirth?: string;
  address?: PartnerAddress;
  licence?: PartnerLicence;
  licenceVerification?: PartnerLicenceVerification;
  vehicle?: PartnerVehicle;
  profilePhoto?: string;
  profilePhotoUrl?: string;
  livenessCheck?: PartnerLivenessCheck;
  partnerAgreementAcceptedAt?: string;
  partnerAgreementVersion?: string;
  securityDeposit?: PartnerSecurityDeposit;
  deliveredOrderCount?: number;
  status: PartnerStatusType;
  rejectionReason?: string;
  priorityLevel?: number;
  isOnline: boolean;
  onDuty: boolean;
  currentAssignmentOrderId?: string | null;
  lastAssignedAt?: string;
  location?: { type?: string; coordinates?: number[] };
  zones?: DeliveryZoneSummary[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminMonitorEvent {
  id: string;
  event: string;
  source?: string;
  payload?: unknown;
  createdAt: string;
}

export type AdminGigStatus = 'open' | 'booked' | 'completed' | 'cancelled';

export interface AdminGig {
  id: string;
  title: string;
  subtitle: string;
  dayKey: string;
  startMinute: number;
  endMinute: number;
  timeLabel: string;
  payoutPerOrder: number;
  maxOrders: number;
  status: AdminGigStatus;
  bookingCutoffAt?: string | null;
  bookedCount: number;
  slotsLeft: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminGigBooking {
  partnerId: string;
  partnerName: string;
  phone: string;
  partnerStatus: string;
  status: 'booked' | 'completed' | 'cancelled';
  bookedAt?: string | null;
  completedTrips: number;
  earnings: number;
  activeMinutes: number;
}
