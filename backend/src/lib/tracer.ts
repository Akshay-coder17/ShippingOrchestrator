/**
 * OpenTelemetry tracer — must be initialized BEFORE any other imports
 *
 * Instruments:
 * - HTTP (Express inbound + axios outbound)
 * - Redis (ioredis)
 * - Prisma (via Prisma tracing extension)
 *
 * Exports traces to Jaeger via OTLP over HTTP.
 *
 * @module tracer
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://jaeger:4318/v1/traces",
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.SERVICE_NAME || "shipmind-backend",
    [SemanticResourceAttributes.SERVICE_VERSION]: "2.0.0",
    environment: process.env.NODE_ENV || "development",
  }),
  spanProcessor: new SimpleSpanProcessor(exporter),
  instrumentations: [
    new HttpInstrumentation({
      // Exclude health check from traces to reduce noise
      ignoreIncomingRequestHook: (req) =>
        req.url === "/health" || req.url === "/metrics",
    }),
    new ExpressInstrumentation(),
    new IORedisInstrumentation(),
  ],
});

/**
 * Start OpenTelemetry SDK — call this before creating Express app
 */
export function startTracer(): void {
  sdk.start();
  console.log("[Tracer] OpenTelemetry SDK started");

  process.on("SIGTERM", () => {
    sdk.shutdown().finally(() => process.exit(0));
  });
}

export { sdk };
