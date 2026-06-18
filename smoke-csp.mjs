import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ||
  "https://carte-fidelite-git-feat-securit-4e98f1-flakos-projects-96727474.vercel.app";

// Hook posé AVANT tout script de page : collecte les violations CSP réelles
// (event securitypolicyviolation) telles que le navigateur les voit.
const INIT = `
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__csp.push({
      violatedDirective: e.violatedDirective,
      effectiveDirective: e.effectiveDirective,
      blockedURI: e.blockedURI,
      disposition: e.disposition,           // 'enforce' = bloquant, 'report' = report-only
      sourceFile: e.sourceFile || '',
      lineNumber: e.lineNumber || 0,
      sample: (e.sample || '').slice(0, 120),
    });
  });
`;

const PAGES = [
  { name: "/ (landing)", path: "/" },
  { name: "/login", path: "/login" },
  { name: "/signup", path: "/signup" },
  { name: "/demarrer", path: "/demarrer" },
  { name: "/c/boulangerie-demo", path: "/c/boulangerie-demo" },
  { name: "/dashboard", path: "/dashboard" },
  { name: "/admin", path: "/admin" },
];

const results = [];
const browser = await chromium.launch({ headless: true });

for (const p of PAGES) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: false });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const requestFailed = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  page.on("requestfailed", (r) => {
    const f = r.failure();
    requestFailed.push({
      url: r.url().slice(0, 140),
      resourceType: r.resourceType(),
      reason: f ? f.errorText : "",
    });
  });

  let status = 0, finalUrl = "", navErr = "";
  try {
    const resp = await page.goto(BASE + p.path, { waitUntil: "networkidle", timeout: 30000 });
    status = resp ? resp.status() : 0;
    finalUrl = page.url();
  } catch (e) {
    navErr = String(e).slice(0, 200);
    finalUrl = page.url();
  }
  // laisser l'hydratation + d'éventuelles violations tardives se produire
  await page.waitForTimeout(2500);

  const csp = await page.evaluate(() => window.__csp || []);

  // Inventaire ressources critiques chargées (preuve qu'elles ne sont PAS bloquées)
  const assets = await page.evaluate(() => {
    const ok = (arr) => arr.length;
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    const sheetsApplied = (() => { try { return document.styleSheets.length; } catch { return -1; } })();
    const bodyText = (document.body && document.body.innerText || "").trim().length;
    return { scriptCount: ok(scripts), styleLinkCount: ok(styles), sheetsApplied, bodyTextLen: bodyText };
  });

  results.push({
    page: p.name, path: p.path, status, finalUrl, navErr,
    cspViolations: csp,
    cspEnforceCount: csp.filter((v) => v.disposition === "enforce").length,
    consoleErrors, pageErrors, requestFailed, assets,
  });

  await ctx.close();
}

await browser.close();
console.log("SMOKE_JSON_START");
console.log(JSON.stringify(results, null, 2));
console.log("SMOKE_JSON_END");
