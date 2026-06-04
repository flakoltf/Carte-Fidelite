import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Valeurs factices : permettent l'import des modules qui construisent le client
    // Supabase admin au chargement. Les tests purs n'appellent jamais la BDD.
    env: { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321", SUPABASE_SERVICE_ROLE_KEY: "test-service-key", QR_SIGNATURE_SECRET: "test-qr-secret" },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
