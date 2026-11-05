// Server-only adapter. The API key and atomic quota reservation are injected by
// the server; this module is not imported by the browser application.
import {compareSellers,applySellerComparison} from './seller-comparison.js';

export function bookingParameters(offer,q){
 if(q?.adults!==2||!Array.isArray(offer?.flights)||offer.flights.length!==2)throw Error('PROVIDER_QUERY');
 const groups=offer.flights.map(f=>{
  if(!Array.isArray(f.legs)||!f.legs.length||f.legs.length>6)throw Error('PROVIDER_QUERY');
  return f.legs.map(l=>{
   const flight_number=String(l.airline)+String(l.flightNumber);
   if(!/^[A-Z0-9]{2}\d{1,4}$/.test(flight_number)||!/^\d{4}-\d{2}-\d{2}$/.test(l.depDate)||!/^([A-Z]{3})$/.test(l.origin)||!/^([A-Z]{3})$/.test(l.dest))throw Error('PROVIDER_QUERY');
   return {flight_number,departure_id:l.origin,arrival_id:l.dest,date:l.depDate};
  });
 });
 for(const leg of groups)for(let i=1;i<leg.length;i++)if(leg[i].departure_id!==leg[i-1].arrival_id||leg[i].date<leg[i-1].date)throw Error('PROVIDER_QUERY');
 if(groups[0][0].departure_id!==q.origin||groups[0].at(-1).arrival_id!==q.destination||groups[0][0].date!==q.depart||groups[1][0].departure_id!==q.destination||groups[1].at(-1).arrival_id!==q.origin||groups[1][0].date!==q.return)throw Error('PROVIDER_QUERY');
 return {engine:'google_flights',departure_id:q.origin,arrival_id:q.destination,outbound_date:q.depart,return_date:q.return,type:'1',adults:'2',children:'0',infants_in_seat:'0',infants_on_lap:'0',travel_class:'1',currency:'BRL',hl:'en',gl:'br',selected_flights_json:JSON.stringify({outbound:groups[0],return:groups[1]})};
}

// A Google merchant handoff is a form POST, not a URL one can safely turn into
// a GET link. Retain its method and bounded form fields for the purchase UI.
export function merchantHandoff(request){
 try{
  const u=new URL(request?.url);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname!=='www.google.com'||!/^\/travel\/clk(?:\/f)?$/.test(u.pathname)||u.search)return null;
  if(typeof request.post_data!=='string'||request.post_data.length>100000)return null;
  const fields=[...new URLSearchParams(request.post_data)];
  if(fields.length!==1||fields[0][0]!=='u'||!fields[0][1]||fields[0][1].length>100000)return null;
  return {url:u.href,method:'POST',fields:{u:fields[0][1]}};
 }catch{return null;}
}

export function decodeBookingOptions(data,offer,q,{now=Date.now()}={}){
 const expected=bookingParameters(offer,q),params=data?.search_parameters;
 if(data?.error||data?.search_metadata?.status!=='Success'||!params||Object.entries(expected).some(([k,v])=>k!=='selected_flights_json'&&String(params[k])!==v))throw Error('PROVIDER_CONTEXT');
 if(!Array.isArray(data.selected_flights)||data.selected_flights.length!==2||!Array.isArray(data.booking_options)||data.booking_options.length>60)throw Error('PROVIDER_FORMAT');
 for(let i=0;i<2;i++){
  const actual=data.selected_flights[i]?.flights,want=offer.flights[i].legs;
  if(!Array.isArray(actual)||actual.length!==want.length)throw Error('PROVIDER_ITINERARY');
  for(let j=0;j<want.length;j++){
   const f=actual[j],l=want[j];
   if(f?.departure_airport?.id!==l.origin||f?.arrival_airport?.id!==l.dest||String(f.departure_airport.time).slice(0,10)!==l.depDate||String(f.flight_number).replace(/\s/g,'')!==l.airline+l.flightNumber||f.travel_class!=='Economy')throw Error('PROVIDER_ITINERARY');
  }
 }
 const rows=[];let skipped=0;
 for(const option of data.booking_options){
  const row=option?.together;
  if(option?.separate_tickets||!row||typeof row.book_with!=='string'||!row.book_with.trim()||!Number.isFinite(row.price)||row.price<=0){skipped++;continue;}
  const name=row.book_with.trim(),id=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  const request=merchantHandoff(row.booking_request);
  rows.push({itineraryId:offer.id,sellerId:id,sellerName:name,total:row.price,currency:'BRL',passengers:2,tripType:'roundtrip',cabin:'economy',taxesIncluded:true,checkedAt:new Date(now).toISOString(),url:null,...(request?{bookingRequest:request}:{})});
 }
 const comparison=compareSellers(offer,rows,{now,complete:skipped===0,source:'Google Voos · SerpApi'});
 // Request fields remain attached only to the already validated seller/price.
 for(const seller of comparison.sellers){const original=rows.find(r=>r.sellerId===seller.sellerId&&r.total===seller.total);if(original?.bookingRequest)seller.bookingRequest=original.bookingRequest;}
 return applySellerComparison(offer,comparison);
}

export async function fetchSellerComparison(offer,q,{apiKey,reserve,fetcher=fetch,signal=AbortSignal.timeout(40000),now=Date.now()}={}){
 const params=bookingParameters(offer,q);
 if(typeof apiKey!=='string'||!apiKey||typeof reserve!=='function')throw Error('PROVIDER_NOT_CONFIGURED');
 // Reserve one credit atomically before network access, counting even failures.
 // No automatic retries or fallback paid requests are permitted here.
 if(!(await reserve()).ok)throw Error('PROVIDER_FREE_QUOTA');
 const accountUrl=new URL('https://serpapi.com/account.json');accountUrl.searchParams.set('api_key',apiKey);
 let accountResponse;try{accountResponse=await fetcher(accountUrl,{signal,redirect:'manual',headers:{Accept:'application/json'}});}catch{throw Error('PROVIDER_UNAVAILABLE');}
 if(!accountResponse.ok)throw Error('PROVIDER_HTTP_'+accountResponse.status);
 const account=await accountResponse.json();
 if(account.plan_monthly_price!==0||account.plan_name!=='Free Plan'||!Number.isFinite(account.plan_searches_left)||account.plan_searches_left<=2)throw Error('PROVIDER_FREE_QUOTA');
 const url=new URL('https://serpapi.com/search.json');url.search=new URLSearchParams({...params,api_key:apiKey}).toString();
 let response;try{response=await fetcher(url,{signal,redirect:'manual',headers:{Accept:'application/json'}});}catch{throw Error('PROVIDER_UNAVAILABLE');}
 if(!response.ok)throw Error('PROVIDER_HTTP_'+response.status);
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('PROVIDER_FORMAT');
 const raw=await response.text();if(raw.length>6500000)throw Error('PROVIDER_FORMAT');
 let data;try{data=JSON.parse(raw);}catch{throw Error('PROVIDER_FORMAT');}
 return decodeBookingOptions(data,offer,q,{now});
}
