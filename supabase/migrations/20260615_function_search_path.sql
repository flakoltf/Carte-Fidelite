-- supabase/migrations/20260615_function_search_path.sql
--
-- Durcissement (advisor Supabase 0011 — function_search_path_mutable) : fige le
-- search_path de 4 fonctions anciennes qui ne l'avaient pas. ALTER FUNCTION ne
-- modifie QUE le réglage, jamais le corps → zéro changement de comportement.
-- Les fonctions récentes (is_admin, provisioning, scan_*) ont déjà ce réglage.
-- Toutes ces 4 sont SECURITY INVOKER (risque déjà faible) ; on aligne par hygiène.

ALTER FUNCTION public.audit_logs_block_mutation() SET search_path = public;
ALTER FUNCTION public.touch_card_designs_updated_at() SET search_path = public;
ALTER FUNCTION public.merchant_slugify(p_shop_name text, p_id uuid) SET search_path = public;
ALTER FUNCTION public.set_merchant_slug() SET search_path = public;
