import { chromium } from "playwright";
const INIT = `window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push({d:e.effectiveDirective,b:e.blockedURI,disp:e.disposition,s:(e.sample||'').slice(0,60)}));`;
const browser = await chromium.launch({ headless: true });
const out = {};

async function deep(url) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const ext = new Set(); const conn = new Set();
  page.on("request", r => { const u=r.url(), t=r.resourceType();
    try { const o=new URL(u).origin; const host=new URL(u).host;
      const isApp = /halocard\.ch$/.test(host);
      if(/^https?:/.test(u)){
        if((t==="script"||t==="stylesheet"||t==="font")&&!isApp) ext.add(t+" "+o);
        if((t==="fetch"||t==="xhr")) conn.add(o);
      }
    } catch {}
  });
  const resp = await page.goto(url,{waitUntil:"networkidle",timeout:30000});
  await page.waitForTimeout(2500);
  const csp = await page.evaluate(()=>window.__csp||[]);
  const info = await page.evaluate(()=>({
    title: document.title,
    bodyLen: (document.body?.innerText||"").trim().length,
    h1: [...document.querySelectorAll("h1,h2")].map(e=>e.innerText.trim().slice(0,60)).slice(0,5),
    links: [...document.querySelectorAll("a")].map(a=>({t:(a.innerText||a.getAttribute("aria-label")||"").trim().slice(0,40),href:a.getAttribute("href")||""})).filter(x=>x.t||x.href).slice(0,30),
    buttons: [...document.querySelectorAll("button")].map(b=>(b.innerText||b.getAttribute("aria-label")||"").trim().slice(0,40)).filter(Boolean).slice(0,20),
    inputs: [...document.querySelectorAll("input,select,textarea")].map(i=>i.getAttribute("name")||i.getAttribute("type")||i.tagName).slice(0,15),
    htmlSample: document.documentElement.outerHTML.slice(0,600),
  }));
  out[url] = { status: resp?resp.status():0, finalUrl: page.url(),
    externalResources:[...ext], externalConnect:[...conn],
    cspExternal: csp.filter(v=>v.b!=="inline"&&!v.s),
    cspInline: csp.filter(v=>v.b==="inline"||v.s).length, info };
  await ctx.close();
}

await deep("https://halocard.ch/");
await deep("https://app.halocard.ch/c/boulangerie-demo");

await browser.close();
console.log("J_START");
console.log(JSON.stringify(out,null,2));
console.log("J_END");
