-- supabase/migrations/20260617_fk_indexes.sql
-- (Hygiène perf — advisor Supabase 0001 : unindexed_foreign_keys)
--
-- Quatre clés étrangères n'avaient pas d'index couvrant. La plus importante est
-- scan_history.card_id : la table est écrite à CHAQUE tampon et lue par carte —
-- sans index, les jointures/filtres dégénèrent à l'échelle. Les trois autres
-- sont à faible trafic mais ajoutées par cohérence. 100 % additif, idempotent.
CREATE INDEX IF NOT EXISTS idx_scan_history_card_id
  ON public.scan_history (card_id);
CREATE INDEX IF NOT EXISTS idx_wallet_notifications_merchant_id
  ON public.wallet_notifications (merchant_id);
CREATE INDEX IF NOT EXISTS idx_card_designs_updated_by
  ON public.card_designs (updated_by);
CREATE INDEX IF NOT EXISTS idx_leads_converted_merchant_id
  ON public.leads (converted_merchant_id);
