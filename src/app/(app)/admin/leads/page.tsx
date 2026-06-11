import { Inbox, Trophy, Percent, CalendarClock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchPipelineLeads } from "@/lib/admin/leads";
import { computeFunnel, dueFollowups } from "@/lib/admin/leadsCompute";
import LeadsBoard from "./LeadsBoard";
import { KpiCard, PageHeader } from "../components/ui";

export const dynamic = "force-dynamic";

// Mini-CRM : leads web (/demarrer) + saisie terrain, pipeline
// nouveau → contacté → démo → gagné/perdu, relances et conversion.
export default async function AdminLeads() {
  const supabase = await createClient();
  const leads = await fetchPipelineLeads(supabase);
  const funnel = computeFunnel(leads);
  const due = dueFollowups(leads, new Date());

  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leads & pipeline"
        subtitle="Tout ce qui entre par halocard.ch/demarrer et la prospection terrain — à rappeler sous un jour ouvré."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          name="Leads au total"
          value={funnel.total}
          hint={`${funnel.byStatus.nouveau} nouveaux à traiter`}
          icon={Inbox}
          color="text-amber-600"
        />
        <KpiCard
          name="Gagnés"
          value={funnel.byStatus.gagne}
          hint={`${funnel.byStatus.perdu} perdus`}
          icon={Trophy}
          color="text-emerald-600"
        />
        <KpiCard
          name="Taux de closing"
          value={pct(funnel.winRate)}
          hint="gagnés / (gagnés + perdus)"
          icon={Percent}
          color="text-halo"
        />
        <KpiCard
          name="Relances dues"
          value={due.length}
          hint="en retard ou aujourd'hui"
          icon={CalendarClock}
          color={due.length > 0 ? "text-red-600" : "text-galet"}
        />
      </div>

      <LeadsBoard leads={leads} />
    </div>
  );
}
