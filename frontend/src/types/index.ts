/**
 * Frontend types
 */

export interface ShipmentPlan {
  id: string;
  status: string;
  query: string;
  route: {
    origin: { name: string; lat: number; lng: number };
    destination: { name: string; lat: number; lng: number };
    waypoints: Array<{
      name: string;
      lat: number;
      lng: number;
      role: string;
      mode: string;
    }>;
    segments: Array<{
      from: string;
      to: string;
      mode: string;
      distanceKm: number;
      durationHours: number;
    }>;
    totalDistanceKm: number;
    totalDurationHours: number;
  };
  carrier: {
    name: string;
    trackingNumber: string;
    reliability: number;
    serviceLevel: string;
  };
  cost: {
    freight: number;
    customs: number;
    handling: number;
    insurance: number;
    total: number;
    currency: string;
  };
  eta: string;
  compliance: {
    requiresCustoms: boolean;
    documents: string[];
    restrictions: string[];
    tariffRate: string;
  };
  risk: {
    level: "low" | "medium" | "high";
    factors: string[];
    mitigations: string[];
  };
  carbon: {
    totalCO2_kg: number;
    breakdown: {
      road: number;
      sea: number;
      air: number;
    };
  };
}
