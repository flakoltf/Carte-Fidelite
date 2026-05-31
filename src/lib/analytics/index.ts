import type { RangeKey, WidgetKey } from "./types";
import { fetchKpis } from "./kpis";
import { fetchVisits } from "./visits";
import { fetchAcquisition } from "./acquisition";
import { fetchRetention } from "./retention";
import { fetchTopCustomers } from "./topCustomers";
import { fetchPeakHours } from "./peakHours";
import { fetchWalletMix } from "./walletMix";
import { fetchRewards } from "./rewards";

const FETCHERS: Record<WidgetKey, (m: string, r: RangeKey) => Promise<unknown>> = {
  kpis: fetchKpis, visits: fetchVisits, acquisition: fetchAcquisition, retention: fetchRetention,
  top_customers: fetchTopCustomers, peak_hours: fetchPeakHours, wallet_mix: fetchWalletMix, rewards: fetchRewards,
};

export function fetchWidget(widget: WidgetKey, merchantId: string, range: RangeKey) {
  return FETCHERS[widget](merchantId, range);
}
