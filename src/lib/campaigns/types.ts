import type { AudienceKey } from "@/lib/segments/audience";

export type CampaignMode = "once" | "recurring";

// Entrée brute reçue de l'API (avant validation).
export type CampaignInput = {
  audience?: unknown;
  title?: unknown;
  body?: unknown;
  mode?: unknown;
  runOn?: unknown;
  cooldownDays?: unknown;
};

// Campagne validée et normalisée (prête à insérer).
export type ValidatedCampaign = {
  audience: AudienceKey;
  title: string;
  body: string;
  mode: CampaignMode;
  runOn: string | null;
  cooldownDays: number;
};

// Ligne campagne telle que manipulée côté logique (camelCase, mappée depuis la DB).
export type CampaignRow = {
  id: string;
  merchantId: string;
  audience: AudienceKey;
  title: string;
  body: string;
  mode: CampaignMode;
  runOn: string | null;
  active: boolean;
  cooldownDays: number;
  lastRunOn: string | null;
};
