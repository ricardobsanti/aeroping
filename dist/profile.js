// Profile metadata is presentation only. Access continues to be enforced by RLS.
export function profileFromUser(user){
  if(!user?.id)return null;
  const google=user.identities?.find(i=>i.provider==='google')?.identity_data||{};
  const meta=user.user_metadata||{};
  const email=typeof user.email==='string'?user.email:'';
  const candidate=google.full_name||google.name||meta.full_name||meta.name||email.split('@')[0]||'Viajante';
  const name=String(candidate).trim().slice(0,80)||'Viajante';
  const words=name.split(/\s+/).filter(Boolean);
  const initials=(words[0][0]+(words.length>1?words.at(-1)[0]:'')).toLocaleUpperCase('pt-BR');
  let avatar='';
  try{const url=new URL(google.avatar_url||google.picture||meta.avatar_url||meta.picture);if(url.protocol==='https:'&&!url.username&&!url.password)avatar=url.href;}catch{}
  return {name,email,initials,avatar,google:!!user.identities?.some(i=>i.provider==='google')||user.app_metadata?.providers?.includes('google')===true};
}
export function paintAccountProfile(profile){
  for(const node of document.querySelectorAll('.couple-profile > .avatar,.top-actions > .avatar,[data-account-avatar]')){
    const fingerprint=profile?JSON.stringify([profile.name,profile.avatar,profile.initials]):'signed-out';
    if(node.dataset.profile===fingerprint)continue;
    node.dataset.profile=fingerprint;
    node.replaceChildren(document.createTextNode(profile?.initials||'N'));
    node.setAttribute('role','img');node.setAttribute('aria-label',profile?`Perfil de ${profile.name}`:'Nosso espaço');
    node.title=profile?`${profile.name} · ${profile.email}`:'Nosso espaço';
    if(profile?.avatar){const img=document.createElement('img');img.src=profile.avatar;img.alt='';img.referrerPolicy='no-referrer';img.decoding='async';img.addEventListener('error',()=>img.remove(),{once:true});node.append(img);}
    if(node.closest('.couple-profile')){const badge=document.createElement('span');badge.textContent='♡';badge.setAttribute('aria-hidden','true');node.append(badge);}
  }
  const label=document.querySelector('.couple-profile > span:nth-child(2) strong');
  const sub=document.querySelector('.couple-profile > span:nth-child(2) small');
  if(label)label.textContent=profile?.name||'Nosso cantinho';
  if(sub)sub.textContent=profile?`${profile.google?'Google':'E-mail'} · nosso espaço`:'Uma conta, muitos destinos';
}
