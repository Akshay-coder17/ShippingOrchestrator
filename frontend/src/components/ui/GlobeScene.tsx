/**
 * GlobeScene — Three.js animated 3D globe with shipping arc
 *
 * Renders a dark-mode Earth sphere with a glowing blue arc
 * connecting the shipment origin and destination coordinates.
 * The arc is drawn using a QuadraticBezierCurve3 lifted above
 * the surface for a realistic "great circle" shipping route look.
 */

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";

interface GlobeSceneProps {
  /** lat/lng of shipment origin (optional — shows pulsing dot) */
  origin?: { lat: number; lng: number };
  /** lat/lng of shipment destination */
  destination?: { lat: number; lng: number };
}

/** Convert lat/lng to a 3D point on a sphere of radius r */
function latLngToVec3(lat: number, lng: number, r = 1.01): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** Animated shipping arc between two lat/lng points */
function ShippingArc({
  origin,
  destination,
}: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}) {
  const start = latLngToVec3(origin.lat, origin.lng);
  const end = latLngToVec3(destination.lat, destination.lng);
  const mid = start.clone().add(end).normalize().multiplyScalar(1.5);

  const curve = useMemo(
    () => new THREE.QuadraticBezierCurve3(start, mid, end),
    [start, mid, end]
  );

  const points = curve.getPoints(60);

  return (
    <Line
      points={points}
      color="#00d4ff"
      lineWidth={2}
      dashed={false}
    />
  );
}

/** Auto-rotating globe mesh */
function Globe() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <meshStandardMaterial
        color="#0a1628"
        emissive="#0d2137"
        roughness={0.8}
        metalness={0.2}
        wireframe={false}
      />
    </Sphere>
  );
}

/** Wireframe grid overlay for the sci-fi look */
function GlobeWireframe() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1.005, 24, 24]}>
      <meshBasicMaterial
        color="#00d4ff"
        transparent
        opacity={0.06}
        wireframe
      />
    </Sphere>
  );
}

export const GlobeScene: React.FC<GlobeSceneProps> = ({ origin, destination }) => {
  return (
    <div className="h-full w-full" style={{ minHeight: 300 }}>
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={1.5} color="#00d4ff" />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#8b5cf6" />

        <Globe />
        <GlobeWireframe />

        {/* Shipping arc — rendered only when both coords are provided */}
        {origin && destination && (
          <ShippingArc origin={origin} destination={destination} />
        )}

        {/* Orbit controls — auto-rotate, no zoom in dashboard */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          rotateSpeed={0.4}
        />
      </Canvas>
    </div>
  );
};
