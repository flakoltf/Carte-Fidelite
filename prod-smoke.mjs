import { chromium } from "playwright";

// Production = BD réelle, la page /c/boulangerie-demo rend complètement.
// Prod sert la CSP en REPORT-ONLY ; mon enforce (PR#35) = mêmes directives
// + 'unsafe-inline' (scripts/styles) + upgrade-insecure-requests => strictement
// PLUS permissif. On classe donc chaque violation report-only :
//   - inline (blockedURI 'inline'/sample présent) => AUTORISÉ par mon enforce
//   - URL externe hors 'self'/whitelist => SERAIT bloqué par enforce (à signaler)
const BASE = "https://app.halocard.ch";

const INIT = `
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__csp.push({
      effectiveDirective: e.effectiveDirective,
      blockedURI: e.blockedURI,
      disposition: e.disposition,
      sample: (e.sample||'').slice(0,80),
    });
  });
`;

const browser = await chromium.launch({ headless: true });
const out = {};

async function visit(path) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const ext = new Set();
  const fetches = new Set();
  page.on("request", (r) => {
    const u = r.url();
    const type = r.resourceType();
    if (/^https?:\/\//.test(u) && !u.includes("app.halocard.ch") && !u.startsWith("data:")) {
      if (type === "script") ext.add("SCRIPT " + new URL(u).origin);
      if (type === "fetch" || type === "xhr") fetches.add("CONNECT " + new URL(u).origin);
      if (type === "stylesheet") ext.add("STYLE " + new URL(u).origin);
      if (type === "font") ext.add("FONT " + new URL(u).origin);
    }
  });
  const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);
  const csp = await page.evaluate(() => window.__csp || []);
  const result = {
    status: resp ? resp.status() : 0,
    finalUrl: page.url().replace(/^https:\/\/[^/]+/, ""),
    bodyTextLen: await page.evaluate(() => (document.body?.innerText||"").trim().length),
    externalResources: [...ext],
    externalConnect: [...fetches],
    cspInlineCount: csp.filter(v => v.blockedURI === "inline" || v.sample).length,
    cspExternal: csp.filter(v => v.blockedURI !== "inline" && !v.sample),
  };
  return { result, page, ctx };
}

// 1) landing + 2) login : juste resources/CSP
for (const p of ["/", "/login"]) {
  const { result, ctx } = await visit(p);
  out[p] = result;
  await ctx.close();
}

// 3) /c/boulangerie-demo + interactions
{
  const { result, page, ctx } = await visit("/c/boulangerie-demo");
  // Boutons / liens présents
  const buttons = await page.evaluate(() => {
    const items = [...document.querySelectorAll("a,button")].map(el => ({
      tag: el.tagName, text: (el.innerText||"").trim().slice(0,40),
      href: el.getAttribute("href") || "",
    })).filter(x => x.text);
    return items;
  });
  result.interactiveElements = buttons;
  // Apple Wallet
  const apple = buttons.find(b => /apple|wallet/i.test(b.text));
  const maps = buttons.find(b => /maps|itinéraire|plan/i.test(b.text) || /google\.com\/maps/i.test(b.href));
  const review = buttons.find(b => /avis|review/i.test(b.text) || /writereview/i.test(b.href));
  result.appleWallet = apple || null;
  result.mapsLink = maps || null;
  result.reviewLink = review || null;
  out["/c/boulangerie-demo"] = result;
  await ctx.close();
}

// 4) navigation / -> clic vers /login
{
  const ctx = await browser.newContext();
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  const loginLink = await page.$('a[href="/login"], a[href$="/login"]');
  let navResult = "no-link-found";
  if (loginLink) {
    await loginLink.click().catch(()=>{});
    await page.waitForTimeout(2000);
    navResult = "after-click-url=" + page.url().replace(/^https:\/\/[^/]+/, "");
  }
  out["nav / -> /login"] = { navResult };
  await ctx.close();
}

await browser.close();
console.log("PROD_JSON_START");
console.log(JSON.stringify(out, null, 2));
console.log("PROD_JSON_END");
