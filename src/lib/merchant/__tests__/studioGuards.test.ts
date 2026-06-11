import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Gardes d'étanchéité de la surface MARCHANDE (Agent A) — pendant marchand des
// surfaceGuards admin. Tests STATIQUES : la CI échoue si une future route
// marchande oublie de résoudre le tenant ou de filtrer le service-role.

const SRC = join(__dirname, '../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const MERCHANT_API_DIR = join(SRC, 'app/api/merchant');

describe('étanchéité de la surface marchande (studio & API merchant)', () => {
  it('chaque route /api/merchant/** résout le tenant via currentMerchantId', () => {
    const routes = walk(MERCHANT_API_DIR).filter((f) => f.endsWith('route.ts'));
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const content = readFileSync(route, 'utf8');
      expect(content, `${route.replace(SRC, 'src')} ne résout pas le tenant via currentMerchantId`).toContain(
        'currentMerchantId'
      );
    }
  });

  it('chaque route /api/merchant/** utilisant supabaseAdmin filtre par merchant_id (invariant 3)', () => {
    const routes = walk(MERCHANT_API_DIR).filter((f) => f.endsWith('route.ts'));
    for (const route of routes) {
      const content = readFileSync(route, 'utf8');
      if (!content.includes('supabaseAdmin')) continue;
      const usesDb = content.includes('supabaseAdmin\n    .from(') || content.includes('supabaseAdmin.from(');
      if (!usesDb) continue; // storage-only : scopé par préfixe de chemin tenant
      const filtersTenant =
        content.includes(`.eq('merchant_id', merchantId)`) ||
        content.includes(`.eq("merchant_id", merchantId)`) ||
        content.includes(`.eq('id', merchantId)`) ||
        content.includes(`.eq("id", merchantId)`);
      expect(filtersTenant, `${route.replace(SRC, 'src')} interroge la base via service-role sans filtre tenant`).toBe(true);
    }
  });

  it('les routes du studio ne signent/écrivent des assets que sous le préfixe du tenant', () => {
    const assetsRoute = readFileSync(join(MERCHANT_API_DIR, 'card-design/assets/route.ts'), 'utf8');
    // Tous les chemins d'écriture passent par les helpers préfixés tenant.
    expect(assetsRoute).toContain('applePath(merchantId');
    expect(assetsRoute).toContain('googlePath(merchantId');
    expect(assetsRoute).toContain('stampPath(merchantId');
    expect(assetsRoute).toContain('`${merchantId}/${folder}`');

    // Brouillon et publication re-scopent les chemins d'assets avant persistance.
    for (const file of ['card-design/route.ts', 'card-design/publish/route.ts']) {
      const content = readFileSync(join(MERCHANT_API_DIR, file), 'utf8');
      expect(content, `${file} ne re-scope pas les assets au tenant`).toContain('enforceAssetOwnership');
    }
  });

  it('aucune page du dashboard marchand n’importe la couche admin cross-tenant', () => {
    const dashboardDir = join(SRC, 'app/(app)/dashboard');
    const files = walk(dashboardDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      expect(content, `${f.replace(SRC, 'src')} importe lib/admin/overview`).not.toContain('lib/admin/overview');
      expect(content, `${f.replace(SRC, 'src')} lit merchant_health (vue admin)`).not.toContain('merchant_health');
    }
  });

  it('le module merchant (lib) n’importe jamais la couche admin cross-tenant', () => {
    const merchantDir = join(SRC, 'lib/merchant');
    const files = walk(merchantDir).filter((f) => f.endsWith('.ts') && !f.includes('__tests__'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      expect(content, `${f.replace(SRC, 'src')} importe lib/admin`).not.toContain('@/lib/admin/');
      expect(content, `${f.replace(SRC, 'src')} lit merchant_health`).not.toContain('merchant_health');
    }
  });

  it('les requêtes des nouvelles pages marchandes posent le filtre tenant explicite', () => {
    // Chaque page serveur ajoutée par l'Agent A doit filtrer .eq("merchant_id", …)
    // en plus de la RLS (défense en profondeur, invariant 3).
    const pages = [
      'app/(app)/dashboard/activity/page.tsx',
      'app/(app)/dashboard/subscription/page.tsx',
      'app/(app)/dashboard/customers/[id]/page.tsx',
    ];
    for (const page of pages) {
      const content = readFileSync(join(SRC, page), 'utf8');
      const filtersTenant =
        content.includes('.eq("merchant_id", merchant.id)') || content.includes('.eq("merchant_id", merchantId)');
      expect(filtersTenant, `${page} sans filtre merchant_id explicite`).toBe(true);
      expect(content, `${page} utilise supabaseAdmin (interdit dans une page)`).not.toContain('supabaseAdmin');
    }
  });
});
