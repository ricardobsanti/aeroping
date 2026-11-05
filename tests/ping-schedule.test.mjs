import test from 'node:test';
import assert from 'node:assert/strict';
import {pingSchedule,pingPurchase} from '../dist/travel-view.js';
const now=Date.parse('2026-11-05T19:00:00Z'),p={id:'example',lastScan:{at:'2026-11-05T18:01:00Z',nextAt:'2026-11-06T00:01:00Z',status:'ok'}};
test('last and next checks use the server timestamps in Brasilia time',()=>{const html=pingSchedule(p,now);assert.match(html,/Último ping/);assert.match(html,/Próximo ping previsto/);assert.match(html,/05\/11 às 15:01/);assert.match(html,/05\/11 às 21:01/);assert.match(html,/Horário de Brasília/);});
test('paused and never-scanned pings never invent the next check time',()=>{assert.match(pingSchedule({...p,paused:true},now),/Ping pausado/);assert.doesNotMatch(pingSchedule({...p,paused:true},now),/21:01/);const empty=pingSchedule({},now);assert.match(empty,/Ainda não realizado/);assert.match(empty,/Agendamento pendente/);});
test('overdue and unsuccessful checks remain explicit',()=>{const html=pingSchedule({...p,lastScan:{...p.lastScan,status:'error'}},Date.parse('2026-11-06T03:00:00Z'));assert.match(html,/Aguardando nova verificação/);assert.match(html,/não trouxe uma cotação nova/);});
test('no seller link is presented as a purchase before a valid quote exists',()=>{const html=pingPurchase({id:'example'});assert.match(html,/Compra da passagem/);assert.match(html,/Buscar ofertas para comprar/);assert.doesNotMatch(html,/Direcionar à compra/);});
