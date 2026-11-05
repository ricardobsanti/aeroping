// Public synthetic route for testing the application collector. No accounts, stealth,
// CAPTCHA handling, private headers or access-control workarounds are used.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {fetchGoogleOffers} from '../../supabase/functions/_shared/google-provider.js';
// A fresh synthetic route avoids relying on a historical booking selection
// whose available providers may have changed. Never reads a user's saved ping.
const offers=await fetchGoogleOffers({origin:'GRU',destination:'SSA',depart:'2027-01-30',return:'2027-02-02',adults:2,stops:'any'},{topN:1});
if(!offers.length)throw Error('No public synthetic itinerary available.');
const url=offers[0].bookingUrl;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({locale:'pt-BR',viewport:{width:1280,height:900}});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.getByRole('heading',{name:'Opções de reserva',exact:true}).waitFor({state:'visible',timeout:45000});
 // The airline row arrives before the agency responses. Never treat that first
 // row as a completed comparison while the page is still searching.
 // Some static accessibility loading labels remain present after settlement.
 // Wait for multiple actual offers, then record the state even on timeout so
 // a single-seller or incomplete response is diagnosed rather than accepted.
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).filter(e=>/Continue para reservar/.test(e.getAttribute('aria-label')||'')).length>1,{},{timeout:45000}).catch(()=>{});
 const more=page.getByRole('button',{name:/Mais \d+ opções de reserva/});if(await more.count())await more.click();
 const options=await page.getByRole('button',{name:/Continue para reservar/}).evaluateAll(elements=>elements.map(e=>({label:e.getAttribute('aria-label'),text:e.textContent})));
 const body=await page.locator('body').innerText();
 await writeFile('seller-smoke.json',JSON.stringify({options,twoAdults:body.includes('2 passageiros'),currencyBRL:body.includes('R$')},null,2));
 await page.screenshot({path:'seller-smoke.png',fullPage:true});
 console.log(JSON.stringify({count:options.length,options,visibleText:body.slice(-16000)}));
 if(options.length<2)throw Error('Multiple seller prices were not available in the normal browser.');
}finally{await browser.close();}
