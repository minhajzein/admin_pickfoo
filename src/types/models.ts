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
  address: RestaurantAddress;
  contactNumber: string;
  email: string;
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
}

export type PartnerVehicleType = 'bike' | 'scooter' | 'car';

export interface PartnerVehicle {
  type?: PartnerVehicleType;
  plateNumber?: string;
  model?: string;
  color?: string;
  document?: string;
}

export interface Partner {
  _id?: string;
  fullName: string;
  email: string;
  phone: string;
  age?: number;
  address?: PartnerAddress;
  licence?: PartnerLicence;
  vehicle?: PartnerVehicle;
  status: PartnerStatusType;
  rejectionReason?: string;
  isOnline: boolean;
  onDuty: boolean;
  location?: { type?: string; coordinates?: number[] };
  zones?: DeliveryZoneSummary[];
  createdAt?: string;
  updatedAt?: string;
}
