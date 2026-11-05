export const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(n);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function status(p){const n=p.quotes.at(-1)?.price;if(p.paused)return 'paused';if(n==null)return 'empty';if(n<=p.target)return 'hit';if(n<=p.target*(1+p.tolerance/100))return 'warm';return 'watch';}
export function latest(p){return p.quotes.at(-1)?.price ?? null;}
export function safeLink(s){try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}}
export function validatePing(p){
 if(!p || !/^[A-Z]{3}$/.test(p.origin)||!/^[A-Z]{3}$/.test(p.destination))throw Error('Use os códigos de aeroporto com três letras, como GRU e LIS.');
 if(p.origin===p.destination)throw Error('Origem e destino precisam ser diferentes.');
 if(!p.city?.trim()||p.city.length>80)throw Error('Informe o nome do destino, com até 80 caracteres.');
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!validDate(p.depart)||!validDate(p.return)||p.return<p.depart)throw Error('Confira as datas de ida e volta.');
 if(!Number.isFinite(p.target)||p.target<=0||p.target>1e7)throw Error('Informe uma meta maior que zero.');
 if(!Number.isFinite(p.tolerance)||p.tolerance<0||p.tolerance>50)throw Error('A margem precisa estar entre 0% e 50%.');
 if(!['any','direct','one'].includes(p.stops))throw Error('Filtro de conexões inválido.');
 return p;
}
export function validateState(s){
 if(!s||s.version!==1||!Array.isArray(s.pings)||s.pings.length>100||!Array.isArray(s.events)||s.events.length>500)throw Error('Este arquivo não é um backup válido do AeroPing.');
 const ids=new Set();
 for(const p of s.pings){validatePing(p);if(typeof p.id!=='string'||p.id.length>80||ids.has(p.id))throw Error('Identificador de radar inválido.');ids.add(p.id);if(!Array.isArray(p.quotes)||p.quotes.length>1000)throw Error('Histórico inválido.');let last=0;for(const q of p.quotes){const t=Date.parse(q.at);if(!Number.isFinite(q.price)||q.price<=0||q.price>1e7||!Number.isFinite(t)||t<last||typeof q.source!=='string'||q.source.length>200)throw Error('Cotação inválida no backup.');last=t;}if(p.votes&&(!['yes','wait',null].includes(p.votes.a)||!['yes','wait',null].includes(p.votes.b)))throw Error('Decisão inválida.');}
 for(const e of s.events){if(typeof e.id!=='string'||typeof e.title!=='string'||e.title.length>300||typeof e.body!=='string'||e.body.length>1000||!Number.isFinite(Date.parse(e.at)))throw Error('Atividade inválida.');}
 if(!s.settings||typeof s.settings.nameA!=='string'||typeof s.settings.nameB!=='string'||s.settings.nameA.length>40||s.settings.nameB.length>40)throw Error('Configurações inválidas.');
 if(s.settings.nameB.toLowerCase().trim()==='meu '+'amor')s.settings.nameB='Viajante 2';
 return s;
}
export function alertFor(p,previous){const price=latest(p);if(p.paused||price==null)return null;if(status(p)==='hit')return {type:'hit',title:`${p.city}: preço-alvo atingido!`,body:`${money(price)} por pessoa, ida e volta. Meta: ${money(p.target)}. Confira a disponibilidade na fonte.`};if(previous&&price<=previous*.7)return {type:'drop',title:`Queda de preço para ${p.city}`,body:`A cotação registrada caiu ${Math.round((1-price/previous)*100)}%. Confira regras, taxas e disponibilidade.`};if(status(p)==='warm')return {type:'warm',title:`${p.city} está na zona de calor`,body:`${money(price)} por pessoa, dentro da sua margem de ${p.tolerance}%.`};return null;}
export function milesComparison(cash,miles,thousand,taxes){if([cash,miles,thousand,taxes].some(n=>!Number.isFinite(n)||n<0)||cash===0||miles===0)throw Error('Informe valores válidos para comparar.');const cost=miles/1000*thousand+taxes;return {cost,saving:cash-cost,breakEven:(cash-taxes)/miles*1000};}
export function freshState(){return {version:1,pings:[],events:[],settings:{nameA:'Eu',nameB:'Viajante 2',notifications:false}};}
export function demoState(){const s=freshState();const now=Date.now();const routes=[{city:'Lisboa',country:'Portugal',origin:'GRU',destination:'LIS',depart:'2027-05-12',return:'2027-05-24',target:3500,tolerance:10,photo:'lisbon',prices:[4780,4620,4850,4530,4390,4520,4210,4350,4080,4180,3850,3680,3790,3390],stops:'direct'},{city:'Paris',country:'França',origin:'GRU',destination:'CDG',depart:'2027-09-08',return:'2027-09-20',target:4000,tolerance:10,photo:'paris',prices:[5290,5150,5420,4980,5100,4760,4880,4650,4700,4520,4630,4390,4500,4290],stops:'one'},{city:'Tóquio',country:'Japão',origin:'GRU',destination:'HND',depart:'2027-10-14',return:'2027-10-30',target:5500,tolerance:10,photo:'tokyo',prices:[7800,7540,7790,7380,7560,7210,7350,7100,7210,6900,7130,6840,6950,6780],stops:'one'}];
 s.pings=routes.map((r,i)=>{const {prices,...p}=r;return {...p,id:`demo-${i}`,demo:true,paused:false,baggage:false,votes:{a:null,b:null},createdAt:new Date(now).toISOString(),quotes:prices.map((price,j)=>({price,at:new Date(now-(13-j)*86400000).toISOString(),source:'Exemplo ilustrativo',url:''}))};});
 s.events=[{id:'demo-alert-1',type:'hit',title:'Lisboa chegou ao preço dos sonhos',body:'Exemplo: R$ 3.390 por pessoa, abaixo da meta de R$ 3.500.',at:new Date(now-3600000).toISOString(),demo:true},{id:'demo-alert-2',type:'warm',title:'Paris está cada vez mais perto',body:'Exemplo: a cotação entrou na margem de 10% da meta.',at:new Date(now-3*3600000).toISOString(),demo:true}];return s;
}
