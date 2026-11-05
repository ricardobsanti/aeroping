// Public endpoint authenticated by a 256-bit, single-use, expiring invitation.
// Service-role credentials stay in Supabase's server environment.
const origin = 'https://ricardobsanti.github.io';
const headers = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const serverHeaders = {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function rpc(name:string,body:unknown){const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:serverHeaders,body:JSON.stringify(body)});if(!r.ok)throw new Error('Enrollment unavailable');return r.json();}
Deno.serve(async(req:Request)=>{
  if(req.headers.get('origin')!==origin)return respond({error:'Origem não autorizada.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond({error:'Método inválido.'},405);
  let createdUser:string|null=null;
  try{
    const raw=await req.text();if(raw.length>16384)return respond({error:'Solicitação inválida.'},413);
    const {token,email,password}=JSON.parse(raw);
    if(typeof token!=='string'||!/^\w{64}$/.test(token)||typeof email!=='string'||typeof password!=='string'||password.length<8||password.length>128)
      return respond({error:'Confira o convite, o e-mail e a senha de pelo menos 8 caracteres.'},400);
    const invite=await rpc('check_enrollment',{p_token:token});
    if(!invite||invite.email!==email.trim().toLowerCase())return respond({error:'Convite inválido, expirado ou de outro e-mail.'},403);
    const r=await fetch(`${url}/auth/v1/admin/users`,{method:'POST',headers:serverHeaders,body:JSON.stringify({email:invite.email,password,email_confirm:true,app_metadata:{aeroping_enrolled:true}})});
    if(!r.ok){const detail=await r.json();console.error('Enrollment admin rejection',r.status,detail.code||detail.error_code||detail.msg);return respond({error:'Não foi possível criar o acesso.',reason:detail.msg||detail.message||detail.code||'auth_rejected'},409);}
    const user=await r.json();createdUser=user.id;
    await rpc('complete_enrollment',{p_token:token,p_user_id:user.id});
    createdUser=null;
    return respond({ok:true,email:invite.email});
  }catch{
    // Roll back only an account created by this very request if membership failed.
    if(createdUser)await fetch(`${url}/auth/v1/admin/users/${createdUser}`,{method:'DELETE',headers:serverHeaders}).catch(()=>{});
    return respond({error:'Não foi possível concluir o cadastro. Tente novamente.'},500);
  }
});
