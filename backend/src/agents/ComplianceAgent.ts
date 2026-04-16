/**
 * ComplianceAgent - Checks customs regulations and documentation requirements
 */

import { ParsedShippingIntent, ComplianceData } from "@/types/index.js";

interface CountryRules {
  requiresCustoms: boolean;
  documents: string[];
  restrictions: string[];
  tariffRate: string;
}

export class ComplianceAgent {
  private static readonly COUNTRY_RULES: Record<string, CountryRules> = {
    "India→Germany": {
      requiresCustoms: true,
      documents: ["Commercial Invoice", "Packing List", "HS Code", "CE Mark"],
      restrictions: ["Electronics restricted", "Dual-use controls apply"],
      tariffRate: "3.7%",
    },
    "USA→China": {
      requiresCustoms: true,
      documents: [
        "Commercial Invoice",
        "Bill of Lading",
        "Packing List",
        "Certificate of Origin",
      ],
      restrictions: ["Export control items prohibited"],
      tariffRate: "12.5%",
    },
    "EU→UK": {
      requiresCustoms: true,
      documents: ["Commercial Invoice", "Packing List", "VAT Number"],
      restrictions: ["Post-Brexit rules apply"],
      tariffRate: "5.0%",
    },
    default: {
      requiresCustoms: false,
      documents: [],
      restrictions: [],
      tariffRate: "0%",
    },
  };

  static async execute(
    intent: ParsedShippingIntent,
    qValue: number
  ): Promise<ComplianceData> {
    console.log(
      `[ComplianceAgent] Checking compliance for ${intent.origin}→${intent.destination}`
    );

    const routeKey = `${intent.origin}→${intent.destination}`.split(",")[0];
    const rules =
      this.COUNTRY_RULES[routeKey] || this.COUNTRY_RULES["default"];

    // Apply Q-value boost: higher confidence → stricter checks
    const additionalDocs =
      qValue > 0.8
        ? ["Advanced Manifest", "Security Declaration"]
        : [];

    const result: ComplianceData = {
      requiresCustoms: rules.requiresCustoms,
      documents: [...rules.documents, ...additionalDocs],
      restrictions: rules.restrictions,
      tariffRate: rules.tariffRate,
    };

    console.log(
      `[ComplianceAgent] Compliance check complete: ${result.documents.length} documents required`
    );

    return result;
  }
}
