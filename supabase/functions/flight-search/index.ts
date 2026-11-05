import {fetchGoogleOffers} from '../_shared/google-provider.js';
import {validateSearch,publicError} from '../_shared/flight-domain.js';
import {validateSubscription,deliverPush} from '../_shared/push.js';
const URL=Deno.env.get('SUPABASE_URL')!, KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ORIGINS=['https://ricardobsanti.github.io','http://localhost:4174','http://127.0.0.1:4174'];
const headers={'apikey':KEY,'Authorization':`Bearer ${KEY}`,'Content-Type':'application/json'};
async function rest(path:string,init:RequestInit={}){const r=await fetch(`${URL}/rest/v1/${path}`,{...init,headers:{...headers,...init.headers}});if(!r.ok)throw Error('Não foi possível acessar os dados. Tente novamente.');return r.status===204?null:r.json();}
const worker=(action:string,data:unknown={})=>rest('rpc/flight_worker',{method:'POST',body:JSON.stringify({p_action:action,p_data:data})});
const pushWorker=(action:string,data:unknown={})=>rest('rpc/flight_push_worker',{method:'POST',body:JSON.stringify({p_action:action,p_data:data})});
const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
async function same(a:string,b:string){const x=await hash(a),y=await hash(b);return x.reduce((v,n,i)=>v|(n^y[i]),0)===0;}
async function search(household:string,query:unknown,background=false){const q=validateSearch(query),key=Array.from(await hash(JSON.stringify(q)),n=>n.toString(16).padStart(2,'0')).join('');const cached=await worker('cache_get',{key});if(cached)return cached;
 const budget=await worker('budget',{household,background});if(!budget.ok)throw Error(budget.reason);
 const offers=await fetchGoogleOffers(q,{topN:3});const result={query:q,offers,fetchedAt:new Date().toISOString(),cached:false,source:'Google Voos',coverage:'Seleção de itinerários disponíveis; confira a tarifa final no fornecedor.'};await worker('cache_put',{key,result});return result;
}
async function scan(household:string,ping:any,background=false){let result,error;const query=validateSearch(ping);try{result=await search(household,query,background);}catch(e){error=publicError(e);}
 const saved=await worker('commit',{household,pingId:ping.id,query,result:result||null,...(error?{error}:{})});
 if(saved.event){const runtime=await worker('runtime'),devices=await pushWorker('list',{household});await Promise.allSettled(devices.map(async(d:any)=>{const status=await deliverPush(d.subscription,saved.event,runtime);if(status===404||status===410)await pushWorker('remove',{user:d.user,endpoint:d.subscription.endpoint});}));}
 return {result,error};
}
Deno.serve(async req=>{const origin=req.headers.get('origin')||'',cors={'Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:ORIGINS[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};const respond=(d:unknown,status=200)=>Response.json(d,{status,headers:cors});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return respond({error:'Método não permitido.'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>8192)return respond({error:'Pedido muito grande.'},413);const raw=await req.text();if(raw.length>8192)return respond({error:'Pedido muito grande.'},413);const body=JSON.parse(raw||'{}');
  if(body.mode==='cron'){
   const runtime=await worker('runtime');if(!await same(req.headers.get('x-aeroping-cron')||'',runtime.cron_secret))return respond({error:'Acesso negado.'},401);
   const jobs=await worker('claim'),results=[];for(const job of jobs){try{results.push(await scan(job.household,{...job.query,id:job.pingId},true));}catch(e){await worker('commit',{...job,error:publicError(e)});results.push({error:publicError(e)});}}
   return respond({processed:results.length});
  }
  const token=req.headers.get('authorization')||'';if(!token.startsWith('Bearer '))return respond({error:'Entre na sua conta para buscar.'},401);
  const userResponse=await fetch(`${URL}/auth/v1/user`,{headers:{apikey:KEY,Authorization:token}});if(!userResponse.ok)return respond({error:'Sua sessão expirou. Entre novamente.'},401);const user=await userResponse.json();
  const members=await rest(`members?select=household_id&user_id=eq.${encodeURIComponent(user.id)}`);if(members.length!==1)return respond({error:'Acesso restrito ao casal.'},403);const household=members[0].household_id;
  if(body.mode==='push-key'){const runtime=await worker('runtime');return respond({publicKey:runtime.vapid_public});}
  if(body.mode==='push-register'){const subscription=validateSubscription(body.subscription);await pushWorker('register',{user:user.id,subscription});return respond({ok:true});}
  if(body.mode==='push-remove'){await pushWorker('remove',{user:user.id,endpoint:String(body.endpoint||'')});return respond({ok:true});}
  if(body.mode==='scan'){
   const states=await rest(`radar_state?select=payload&household_id=eq.${household}`);const ping=states[0]?.payload?.pings?.find((p:any)=>p.id===body.pingId&&!p.demo&&!p.paused);if(!ping)return respond({error:'Radar não encontrado ou pausado.'},404);
   const output=await scan(household,ping);return respond(output,output.error?502:200);
  }
  return respond(await search(household,body.query));
 }catch(e){return respond({error:publicError(e)},e instanceof SyntaxError?400:422);}
});
