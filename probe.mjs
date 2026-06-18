import { chromium } from "playwright";
const INIT = `window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push({directive:e.effectiveDirective,blockedURI:e.blockedURI,disposition:e.disposition,sample:(e.sample||'').slice(0,80),sourceFile:e.sourceFile||''}));`;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
const reqs = [];
page.on("request", r => {
  try { const h = new URL(r.url()).host;
    if (h.includes("app.halocard.ch") || (!h.includes("halocard.ch") && /^https?:/.test(r.url())))
      reqs.push(r.resourceType()+" "+r.method()+" "+r.url().slice(0,120));
  } catch {}
});
await page.goto("https://halocard.ch/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);
const csp = await page.evaluate(()=>window.__csp||[]);
console.log("=== ALL CSP violations on halocard.ch (report-only) ===");
console.log(JSON.stringify(csp, null, 2));
console.log("=== requests to app.halocard.ch or 3rd-party ===");
console.log(JSON.stringify([...new Set(reqs)], null, 2));
await browser.close();
