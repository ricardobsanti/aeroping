// Public synthetic route for testing the application collector. No accounts, stealth,
// CAPTCHA handling, private headers or access-control workarounds are used.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const url='https://www.google.com/travel/flights/booking?tfs=CBwQAhpAEgoyMDI2LTEyLTEwIiAKA0dSVRIKMjAyNi0xMi0xMBoDR0lHKgJHMzIEMTU2MmoHCAESA0dSVXIHCAESA0dJRxpAEgoyMDI2LTEyLTE3IiAKA0dJRxIKMjAyNi0xMi0xNxoDR1JVKgJHMzIEMTM4MWoHCAESA0dJR3IHCAESA0dSVUABQAFIAXABggELCP___________wGYAQE&curr=BRL&hl=pt-BR&gl=BR';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({locale:'pt-BR',viewport:{width:1280,height:900}});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.getByRole('heading',{name:'Opções de reserva',exact:true}).waitFor({state:'visible',timeout:45000});
 // The airline row arrives before the agency responses. Never treat that first
 // row as a completed comparison while the page is still searching.
 for(const label of ['Carregando resultados','Buscando preços'])for(const node of await page.getByText(label,{exact:true}).all())await node.waitFor({state:'hidden',timeout:45000});
 const more=page.getByRole('button',{name:/Mais \d+ opções de reserva/});if(await more.count())await more.click();
 const options=await page.getByRole('button',{name:/Continue para reservar/}).evaluateAll(elements=>elements.map(e=>({label:e.getAttribute('aria-label'),text:e.textContent})));
 const body=await page.locator('body').innerText();
 await writeFile('seller-smoke.json',JSON.stringify({options,twoAdults:body.includes('2 passageiros'),currencyBRL:body.includes('R$')},null,2));
 await page.screenshot({path:'seller-smoke.png',fullPage:true});
 console.log(JSON.stringify({count:options.length,options}));
 if(options.length<2)throw Error('Multiple seller prices were not available in the normal browser.');
}finally{await browser.close();}
