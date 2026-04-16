/**
 * GoogleMapsService - Route optimization and mapping
 */

import axios from "axios";
import { RouteData, Waypoint, RouteSegment } from "@/types/index.js";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface DirectionsResponse {
  routes: Array<{
    legs: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
    }>;
  }>;
}

export class GoogleMapsService {
  /**
   * Calculate optimal multi-modal route with waypoints
   * For demonstration, we'll use mock data but structure for real Google Maps API calls
   */
  static async getOptimalRoute(
    origin: string,
    destination: string,
    transportMode: "multimodal" | "road" | "sea" | "air" = "multimodal"
  ): Promise<RouteData> {
    // Mock data for demo - in production, call actual Google Maps Distance Matrix & Directions API
    const mockRoutes = this.getMockRouteData(origin, destination, transportMode);

    return mockRoutes;
  }

  /**
   * Get multiple route alternatives
   */
  static async getRouteAlternatives(
    origin: string,
    destination: string,
    count: number = 3
  ): Promise<RouteData[]> {
    const alternatives: RouteData[] = [];

    // Simulate 3 different route options
    for (let i = 0; i < count; i++) {
      const route = this.getMockRouteData(origin, destination, "multimodal");
      // Vary cost/time for alternatives
      route.totalDurationHours += i * 12;
      alternatives.push(route);
    }

    return alternatives;
  }

  /**
   * Reverse geocode coordinates to address
   */
  static async geocodeLocation(lat: number, lng: number): Promise<string> {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            latlng: `${lat},${lng}`,
            key: GOOGLE_MAPS_API_KEY,
          },
        }
      );

      if (response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
      return `${lat}, ${lng}`;
    } catch (error) {
      console.error("Geocoding error:", error);
      return `${lat}, ${lng}`;
    }
  }

  /**
   * Calculate distance matrix between multiple locations
   */
  static async getDistanceMatrix(
    origins: string[],
    destinations: string[]
  ): Promise<any> {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: origins.join("|"),
            destinations: destinations.join("|"),
            key: GOOGLE_MAPS_API_KEY,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Distance Matrix error:", error);
      throw error;
    }
  }

  /**
   * Mock route data generator for demo/testing
   */
  private static getMockRouteData(
    origin: string,
    destination: string,
    transportMode: string
  ): RouteData {
    const mockLocations: Record<string, { lat: number; lng: number }> = {
      "Chennai, India": { lat: 13.0827, lng: 80.2707 },
      "Berlin, Germany": { lat: 52.52, lng: 13.405 },
      "Dubai, UAE": { lat: 25.1972, lng: 55.2744 },
      "Frankfurt, Germany": { lat: 50.1109, lng: 8.6821 },
      "Shanghai, China": { lat: 31.23, lng: 121.47 },
      "Port, Mumbai": { lat: 18.96, lng: 72.82 },
    };

    const originCoords = mockLocations[origin] || { lat: 0, lng: 0 };
    const destCoords = mockLocations[destination] || { lat: 0, lng: 0 };

    const waypoints: Waypoint[] = [
      {
        name: `${origin} Port/Hub`,
        lat: originCoords.lat,
        lng: originCoords.lng,
        role: "seaport",
        mode: "road→sea",
      },
      {
        name: "Dubai Jebel Ali Port",
        lat: 24.97,
        lng: 55.06,
        role: "seaport",
        mode: "sea→sea",
        estimatedArrival: "T+96h",
      },
      {
        name: "Frankfurt Airport",
        lat: 50.03,
        lng: 8.57,
        role: "airport",
        mode: "air→road",
        estimatedArrival: "T+103h",
      },
    ];

    const segments: RouteSegment[] = [
      {
        from: origin,
        to: `${origin} Port`,
        mode: "road",
        distanceKm: 20,
        durationHours: 0.75,
      },
      {
        from: `${origin} Port`,
        to: "Dubai Jebel Ali",
        mode: "sea",
        distanceKm: 3400,
        durationHours: 96,
      },
      {
        from: "Dubai",
        to: "Frankfurt",
        mode: "air",
        distanceKm: 4900,
        durationHours: 7,
      },
      {
        from: "Frankfurt",
        to: destination,
        mode: "road",
        distanceKm: 550,
        durationHours: 5,
      },
    ];

    return {
      origin: { name: origin, lat: originCoords.lat, lng: originCoords.lng },
      destination: {
        name: destination,
        lat: destCoords.lat,
        lng: destCoords.lng,
      },
      waypoints,
      segments,
      totalDistanceKm: 8870,
      totalDurationHours: 108.75,
    };
  }
}
