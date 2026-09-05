// Chargement de la base clients à partir des routes segments (les seules
// lectures de la base couvertes par le jeton mobile). Le serveur classe et
// compte ; l'app fusionne les 5 listes en une seule (voir model.ts).

import { api, type ApiClient } from "@/lib/api";

import { STAGE_KEYS, type SegmentMember, type SegmentSummary, type StageKey } from "./contracts";
import { buildClientRows, type ClientRow } from "./model";

export type ClientsBase = { summary: SegmentSummary; rows: ClientRow[] };

type Envelope<T> = { data?: T };

export async function fetchSegmentSummary(client: ApiClient = api()): Promise<SegmentSummary> {
  const res = await client.get<Envelope<SegmentSummary>>("/api/segments");
  if (!res?.data) throw new Error("Réponse du serveur incomplète.");
  return res.data;
}

export async function loadClientsBase(client: ApiClient = api()): Promise<ClientsBase> {
  const [summary, ...lists] = await Promise.all([
    fetchSegmentSummary(client),
    ...STAGE_KEYS.map((stage) => client.get<Envelope<SegmentMember[]>>(`/api/segments/${stage}`)),
  ]);
  const byStage: Partial<Record<StageKey, SegmentMember[]>> = {};
  STAGE_KEYS.forEach((stage, i) => {
    byStage[stage] = lists[i]?.data ?? [];
  });
  return { summary, rows: buildClientRows(byStage) };
}
