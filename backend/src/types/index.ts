/**
 * Core type definitions for ShipMind platform
 */

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteSegment {
  from: string;
  to: string;
  mode: "road" | "sea" | "air";
  distanceKm: number;
  durationHours: number;
}

export interface Waypoint extends Location {
  role: "seaport" | "airport" | "hub" | "customs";
  mode: string;
  estimatedArrival?: string;
}

export interface RouteData {
  origin: Location;
  destination: Location;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  totalDistanceKm: number;
  totalDurationHours: number;
}

export interface CarrierData {
  name: string;
  trackingNumber: string;
  reliability: number;
  serviceLevel: string;
}

export interface CostBreakdown {
  freight: number;
  customs: number;
  handling: number;
  insurance: number;
  total: number;
  currency: string;
}

export interface ComplianceData {
  requiresCustoms: boolean;
  documents: string[];
  restrictions: string[];
  tariffRate: string;
}

export interface RiskData {
  level: "low" | "medium" | "high";
  factors: string[];
  mitigations: string[];
}

export interface CarbonData {
  totalCO2_kg: number;
  breakdown: {
    road: number;
    sea: number;
    air: number;
  };
}

export interface ShipmentPlan {
  shipmentId: string;
  status: "planned" | "in_transit" | "delivered" | "failed";
  query: string;
  route: RouteData;
  carrier: CarrierData;
  cost: CostBreakdown;
  eta: string;
  compliance: ComplianceData;
  risk: RiskData;
  carbon: CarbonData;
  agentRewards: Record<string, number>;
}

export interface AgentRewardRecord {
  queryId: string;
  agentName: string;
  action: string;
  reward: number;
  factors: {
    costSavings: number;
    timeAccuracy: number;
    userSatisfaction: number;
    routeEfficiency: number;
  };
}

export interface ParsedShippingIntent {
  origin: string;
  destination: string;
  weight_kg: number;
  deadline?: string;
  priority: "cost" | "speed" | "sustainability";
  goods_category?: string;
}
