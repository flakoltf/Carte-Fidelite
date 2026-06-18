import { chromium } from "playwright";
const b = await chromium.launch({headless:true});
const p = await (await b.newContext()).newPage();
await p.goto("https://halocard.ch/", {waitUntil:"networkidle",timeout:30000});
const before = p.url();
const link = await p.$('a[href="/login"]');
let nav="(no link)";
if(link){ await link.click().catch(e=>console.log("clickerr",e.message)); await p.waitForTimeout(3000); nav=p.url(); }
const r = await p.evaluate(()=>({title:document.title, hasPwd: !!document.querySelector('input[type=password]'), hasEmail: !!document.querySelector('input[type=email],input[name=email]'), bodyLen:(document.body?.innerText||"").trim().length}));
console.log("CLICK Connexion: "+before+"  ->  "+nav);
console.log("page after: "+JSON.stringify(r));
await b.close();
