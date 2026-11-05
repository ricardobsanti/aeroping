import {SITE_CLOUD} from './site-config.js';
import {acceptOAuthSession} from './cloud-v2.js?v=4';
const PENDING='aeroping-google-pkce-v1';
export async function googleProviderEnabled(){try{const r=await fetch(`${SITE_CLOUD.url}/auth/v1/settings`,{headers:{apikey:SITE_CLOUD.key},signal:AbortSignal.timeout(6000)});return r.ok&&(await r.json()).external?.google===true;}catch{return false;}}
export async function googleAuthorizationUrl(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const challenge=btoa(String.fromCharCode(...digest)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  sessionStorage.setItem(PENDING,JSON.stringify({verifier,expires:Date.now()+15*60*1000}));
  const u=new URL(`${SITE_CLOUD.url}/auth/v1/authorize`);
  u.search=new URLSearchParams({provider:'google',redirect_to:'https://ricardobsanti.github.io/aeroping/',code_challenge:challenge,code_challenge_method:'s256',scopes:'openid email profile',prompt:'select_account'});
  return u.href;
}
export async function finishGoogleSignIn(){
  const url=new URL(location.href),code=url.searchParams.get('code');
  const fragment=new URLSearchParams(url.hash.slice(1));
  const oauthError=url.searchParams.get('error')||fragment.get('error');
  if(!code&&!oauthError)return false;
  // Remove authorization parameters before exchanging the one-use code.
  for(const k of ['code','error','error_code','error_description'])url.searchParams.delete(k);
  if(oauthError)url.hash='';
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  let pending;try{pending=JSON.parse(sessionStorage.getItem(PENDING)||'null');}finally{sessionStorage.removeItem(PENDING);}
  if(oauthError)throw Error('O acesso pelo Google não foi concluído. Use o e-mail convidado ou entre com sua senha.');
  if(!pending?.verifier||pending.expires<Date.now())throw Error('Abra o botão do Google novamente neste navegador para entrar.');
  const r=await fetch(`${SITE_CLOUD.url}/auth/v1/token?grant_type=pkce`,{method:'POST',headers:{apikey:SITE_CLOUD.key,'Content-Type':'application/json'},body:JSON.stringify({auth_code:code,code_verifier:pending.verifier})});
  if(!r.ok)throw Error('Não foi possível concluir o acesso pelo Google. Tente novamente.');
  await acceptOAuthSession(await r.json());
  return true;
}
