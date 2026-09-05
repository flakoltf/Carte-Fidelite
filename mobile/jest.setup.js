// Valeurs FACTICES et non secrètes : elles satisfont `readConfig` pour que les
// modules s'importent, aucun appel réseau n'est fait pendant les tests.
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://exemple.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "cle-anon-de-test";
process.env.EXPO_PUBLIC_API_BASE_URL = "https://app.halocard.ch";
