-- Correctif : conflit entre l'append-only de audit_logs et ses FK ON DELETE SET NULL.
--
-- audit_logs porte les triggers audit_logs_no_update / audit_logs_no_delete qui lèvent
-- une exception sur tout UPDATE/DELETE. Or les FK (card_id, merchant_id, user_id) sont
-- en ON DELETE SET NULL : supprimer un client/marchand/utilisateur référencé déclenche
-- un UPDATE automatique sur audit_logs -> bloqué par le trigger -> la suppression entière
-- échoue. Conséquences : le droit à l'oubli RGPD (DELETE /api/customers/[id]) et la
-- suppression de marchand par l'admin sont cassés dès qu'une ligne d'audit les référence.
--
-- Un journal d'audit immuable doit conserver les UUID d'origine (valeur forensique) même
-- après suppression de l'entité. On retire donc les FK : card_id/merchant_id/user_id
-- restent de simples UUID (potentiellement « pendants » après suppression, ce qui est le
-- comportement attendu d'un historique).

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_card_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_merchant_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
