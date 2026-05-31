import { WIDGET_KEYS, type DashboardConfig, type WidgetKey } from "./types";
import { presetOrder } from "./presets";

export function resolveDashboardConfig(stored: DashboardConfig | null, businessType: string): DashboardConfig {
  const order = presetOrder(businessType);
  const storedByKey = new Map((stored?.widgets ?? []).map((w) => [w.key, w]));
  const widgets = WIDGET_KEYS.map((key) => {
    const s = storedByKey.get(key);
    return {
      key: key as WidgetKey,
      visible: s ? s.visible : true,
      order: s ? s.order : (order.indexOf(key) >= 0 ? order.indexOf(key) : order.length),
    };
  }).sort((a, b) => a.order - b.order);
  return { widgets };
}
