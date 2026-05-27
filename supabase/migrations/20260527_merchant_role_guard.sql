-- Phase 2A (correctif sécurité) : empêcher l'escalade de privilèges sur merchants.
--
-- Contexte : les policies RLS UPDATE/INSERT de merchants autorisent un marchand à
-- écrire sa propre ligne (auth.uid() = user_id). Or le WITH CHECK de RLS agit au
-- niveau LIGNE, pas COLONNE : un marchand authentifié pouvait donc faire
--     UPDATE merchants SET role = 'admin' WHERE user_id = auth.uid()
-- et s'auto-promouvoir admin (ou modifier son enrollment_token / son user_id), ou
-- encore INSÉRER une nouvelle ligne avec role = 'admin'. Les GRANT au niveau colonne
-- ne suffisent pas, car l'admin est lui aussi un utilisateur 'authenticated'.
--
-- Correctif : un trigger BEFORE INSERT/UPDATE. La fonction est SECURITY INVOKER
-- (par défaut) pour que current_user reflète le rôle PostgREST réel
-- ('authenticated' / 'anon' pour l'appli, 'service_role' / 'postgres' pour le
-- serveur et les migrations). Seuls les rôles applicatifs non-admin sont bridés ;
-- les rôles privilégiés passent librement (bootstrap du 1er admin + routes serveur
-- d'administration via la clé service-role).

CREATE OR REPLACE FUNCTION enforce_merchant_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role IS DISTINCT FROM 'merchant' THEN
        RAISE EXCEPTION 'Création d''un compte privilégié interdite'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Modification du rôle interdite'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.enrollment_token IS DISTINCT FROM OLD.enrollment_token THEN
        RAISE EXCEPTION 'Modification du jeton d''enrôlement interdite'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Modification du propriétaire interdite'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_merchant_role_guard ON merchants;
CREATE TRIGGER trg_enforce_merchant_role_guard
  BEFORE INSERT OR UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION enforce_merchant_role_guard();
