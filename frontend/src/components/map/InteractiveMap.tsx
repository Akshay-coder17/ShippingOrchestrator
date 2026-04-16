/**
 * Interactive Google Map component with animated route
 */

import React, { useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Polyline, Marker } from "@react-google-maps/api";
import { ShipmentPlan } from "@/types/index.js";
import { motion } from "framer-motion";

interface MapProps {
  shipmentPlan: ShipmentPlan;
}

export const InteractiveMap: React.FC<MapProps> = ({ shipmentPlan }) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || "",
  });

  const [animatedPath, setAnimatedPath] = useState<
    Array<{ lat: number; lng: number }>
  >([]);

  // Animate route drawing
  useEffect(() => {
    const allPoints = [
      shipmentPlan.route.origin,
      ...shipmentPlan.route.waypoints,
      shipmentPlan.route.destination,
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index <= allPoints.length) {
        setAnimatedPath(allPoints.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [shipmentPlan]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96 bg-bg-card rounded-xl border border-border">
        <p className="text-text-primary/60">Loading map...</p>
      </div>
    );
  }

  const origin = [
    shipmentPlan.route.origin.lat,
    shipmentPlan.route.origin.lng,
  ];
  const destination = [
    shipmentPlan.route.destination.lat,
    shipmentPlan.route.destination.lng,
  ];

  // Calculate center point
  const center = {
    lat:
      (shipmentPlan.route.origin.lat +
        shipmentPlan.route.destination.lat) /
      2,
    lng:
      (shipmentPlan.route.origin.lng +
        shipmentPlan.route.destination.lng) /
      2,
  };

  return (
    <div className="relative h-96 rounded-xl overflow-hidden border border-border">
      <GoogleMap
        center={center}
        zoom={4}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
            {
              elementType: "labels.text.fill",
              stylers: [{ color: "#757575" }],
            },
            {
              featureType: "administrative",
              elementType: "geometry",
              stylers: [{ color: "#242f3e" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#38414e" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#17263c" }],
            },
          ] as any,
        }}
      >
        {/* Animated route polyline */}
        {animatedPath.length > 1 && (
          <Polyline
            path={animatedPath}
            options={{
              strokeColor: "#00d4ff",
              strokeWeight: 3,
              strokeOpacity: 0.8,
            }}
          />
        )}

        {/* Origin marker */}
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Marker
            position={shipmentPlan.route.origin}
            title="Origin"
            icon={{
              path: "M0-48c-26.4 0-48 21.6-48 48s21.6 48 48 48 48-21.6 48-48-21.6-48-48-48z",
              fillColor: "#00ff88",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 0.5,
            }}
          />
        </motion.div>

        {/* Destination marker */}
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
        >
          <Marker
            position={shipmentPlan.route.destination}
            title="Destination"
            icon={{
              path: "M0-48c-26.4 0-48 21.6-48 48s21.6 48 48 48 48-21.6 48-48-21.6-48-48-48z",
              fillColor: "#ff6b35",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 0.5,
            }}
          />
        </motion.div>

        {/* Waypoint markers */}
        {shipmentPlan.route.waypoints.map((waypoint, idx) => (
          <Marker
            key={idx}
            position={{ lat: waypoint.lat, lng: waypoint.lng }}
            title={waypoint.name}
            icon={{
              path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z",
              fillColor: "#00d4ff",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 1,
              scale: 1.2,
            }}
          />
        ))}
      </GoogleMap>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-bg-card/95 backdrop-blur rounded-lg p-3 border border-border text-sm space-y-2">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-accent-green" />
          <span>Origin</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-accent-orange" />
          <span>Destination</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span>Waypoint</span>
        </div>
      </div>
    </div>
  );
};
