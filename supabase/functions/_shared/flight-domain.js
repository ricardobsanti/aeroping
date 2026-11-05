export function validateSearch(input,now=new Date()) {
 const q={origin:String(input?.origin||'').toUpperCase(),destination:String(input?.destination||'').toUpperCase(),depart:input?.depart,return:input?.return,stops:input?.stops||'any',adults:2};
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!/^[A-Z]{3}$/.test(q.origin)||!/^[A-Z]{3}$/.test(q.destination)||q.origin===q.destination)throw Error('Escolha aeroportos diferentes, com código de três letras.');
 const today=now.toISOString().slice(0,10),limit=new Date(now.getTime()+330*86400000).toISOString().slice(0,10);
 if(!valid(q.depart)||!valid(q.return)||q.depart<today||q.return<q.depart||q.return>limit)throw Error('Escolha datas futuras, com volta em até 330 dias.');
 if(!['any','direct','one'].includes(q.stops))throw Error('Filtro de conexões inválido.');
 return q;
}
export const publicError=e=>e?.message?.startsWith('PROVIDER')||e?.name==='TimeoutError'||e?.name==='AbortError'?'A fonte de preços está indisponível agora. Tente novamente mais tarde.':e?.message||'Não foi possível consultar os preços.';
