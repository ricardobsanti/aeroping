// A seller price is only comparable with a positive witness for the complete
// round trip, two adults, the same cabin, currency and mandatory taxes.
export function sellerLink(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;const h=u.hostname.toLowerCase();if(h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||h==='[::1]'||/^\d+(\.\d+){3}$/.test(h))return null;if(/(^|\.)google\.[a-z.]+$/.test(h)&&u.pathname!=='/travel/clk')return null;return u.href;}catch{return null;}}
export function compareSellers(offer,observations,{now=Date.now(),complete=false,source=''}={}){
 if(!offer?.id||!Array.isArray(observations)||observations.length>60)throw Error('Invalid seller comparison');
 const bySeller=new Map();let rejected=0;
 for(const row of observations){const checked=Date.parse(row.checkedAt),valid=row.itineraryId===offer.id&&row.currency==='BRL'&&row.passengers===2&&row.tripType==='roundtrip'&&row.cabin==='economy'&&row.taxesIncluded===true&&Number.isFinite(row.total)&&row.total>0&&row.total<=2e7&&Math.abs(row.total*100-Math.round(row.total*100))<.0001&&Number.isFinite(checked)&&checked<=now+60000&&checked>=now-15*60000&&typeof row.sellerId==='string'&&/^[a-z0-9-]{1,80}$/.test(row.sellerId)&&typeof row.sellerName==='string'&&row.sellerName.trim().length>0&&row.sellerName.length<=120;
  if(!valid){rejected++;continue;}
  const item={sellerId:row.sellerId,sellerName:row.sellerName.trim(),total:row.total,perPerson:Math.round(row.total/2*100)/100,currency:'BRL',passengers:2,tripType:'roundtrip',cabin:'economy',taxesIncluded:true,checkedAt:new Date(checked).toISOString(),url:sellerLink(row.url),source};
  const prior=bySeller.get(item.sellerId);if(!prior||item.total<prior.total)bySeller.set(item.sellerId,item);
 }
 const sellers=[...bySeller.values()].sort((a,b)=>a.total-b.total||a.sellerName.localeCompare(b.sellerName));
 const status=!sellers.length?'unavailable':!complete||rejected?'partial':sellers.length<2?'single_seller':'complete';
 return {status,checkedAt:new Date(now).toISOString(),source,sellersCompared:sellers.length,rejected,sellers,best:sellers[0]||null};
}
export function applySellerComparison(offer,comparison){if(!comparison.best)return {...offer,comparison};const best=comparison.best;return {...offer,referenceTotal:offer.referenceTotal??offer.total,total:best.total,perPerson:best.perPerson,sellerId:best.sellerId,sellerName:best.sellerName,sellerUrl:best.url,bestSeller:best,sellerOffers:comparison.sellers,comparison,bookingUrl:best.url||null,comparisonSourceUrl:offer.comparisonSourceUrl||offer.bookingUrl};}
