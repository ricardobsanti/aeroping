import {SITE_CLOUD} from './site-config.js';
const SESSION='aeroping-session-v2';
export const cloudConfig=()=>SITE_CLOUD;
export function configureCloud(){throw Error('A conexão do AeroPing já está configurada.');}
function session(){try{return JSON.parse(localStorage.getItem(SESSION)||'null');}catch{return null;}}
export const signedIn=()=>!!session()?.access_token;
export const accountEmail=()=>session()?.user?.email||'';
let refreshing=null;
function storeSession(s){if(!s.access_token||!s.refresh_token||!s.user?.id)throw Error('Resposta de acesso inválida.');localStorage.setItem(SESSION,JSON.stringify(s));}
export async function acceptOAuthSession(s){storeSession(s);try{return await membership();}catch(e){localStorage.removeItem(SESSION);throw e;}}
async function auth(path,body){const r=await fetch(`${SITE_CLOUD.url}/auth/v1/${path}`,{method:'POST',headers:{apikey:SITE_CLOUD.key,'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error('Não foi possível entrar. Confira o e-mail e a senha ou use seu convite para criar o primeiro acesso.');return d;}
export async function signIn(email,password){const d=await auth('token?grant_type=password',{email,password});storeSession(d);try{return await membership();}catch(e){localStorage.removeItem(SESSION);throw e;}}
export async function enroll(token,email,password){const r=await fetch(`${SITE_CLOUD.url}/functions/v1/enroll`,{method:'POST',headers:{apikey:SITE_CLOUD.key,'Content-Type':'application/json'},body:JSON.stringify({token,email,password})});const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível ativar o acesso.');return signIn(email,password);}
async function accessToken(){let s=session();if(!s)throw Error('Entre para acessar os planos do casal.');if(s.expires_at*1000<Date.now()+60000){if(!refreshing)refreshing=(async()=>{try{const d=await auth('token?grant_type=refresh_token',{refresh_token:s.refresh_token});storeSession(d);return d;}catch{localStorage.removeItem(SESSION);throw Error('Sua sessão expirou. Entre novamente.');}finally{refreshing=null;}})();s=await refreshing;}return s.access_token;}
async function request(path,options={}){const token=await accessToken();const r=await fetch(`${SITE_CLOUD.url}/rest/v1/${path}`,{...options,headers:{apikey:SITE_CLOUD.key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}});if(!r.ok)throw Error(r.status===401?'Sua sessão expirou. Entre novamente.':'Não foi possível sincronizar. Confira sua conexão e tente novamente.');return r.status===204?null:r.json();}
export async function membership(){const id=session()?.user?.id;const rows=await request(`members?select=household_id,seat&user_id=eq.${encodeURIComponent(id)}`);if(rows.length!==1)throw Error('Esta conta não tem acesso ao espaço do casal. Use seu convite privado.');return rows[0].household_id;}
export async function readCloud(){const id=await membership();const rows=await request(`radar_state?select=payload,revision&household_id=eq.${encodeURIComponent(id)}`);if(rows.length!==1)throw Error('O espaço do casal não foi encontrado.');return {household:id,payload:rows[0].payload,revision:rows[0].revision};}
export async function cloudRevision(){const rows=await request('radar_state?select=revision');if(rows.length!==1)throw Error('Não foi possível verificar a atualização.');return rows[0].revision;}
export async function writeCloud(payload,revision){const id=await membership();const result=await request('rpc/save_radar',{method:'POST',body:JSON.stringify({p_household:id,p_payload:payload,p_revision:revision})});if(!result.ok){const e=new Error('O outro aparelho atualizou os planos. Exporte suas alterações e carregue a versão do casal nos ajustes.');e.conflict=true;throw e;}return result.revision;}
export async function invitePartner(email){return request('rpc/invite_partner',{method:'POST',body:JSON.stringify({p_email:email})});}
export async function signOut(){const s=session();localStorage.removeItem(SESSION);if(s)try{await fetch(`${SITE_CLOUD.url}/auth/v1/logout`,{method:'POST',headers:{apikey:SITE_CLOUD.key,Authorization:`Bearer ${s.access_token}`}});}catch{}}
