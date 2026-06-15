import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client Admin pour les opérations serveur sécurisées (bypass RLS).
//  - `server-only` : crash au bundle si jamais importé depuis un Client Component
//    (filet contre une fuite accidentelle de la clé service-role).
//  - service-role => aucune session utilisateur à gérer : persistance/refresh
//    désactivés explicitement (rien à stocker, rien à rafraîchir).
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
