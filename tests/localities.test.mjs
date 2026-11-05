import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlace,placeForAirport,suggestPlaces,airportName,localityInput} from '../dist/localities.js';
import {validateState,freshState} from '../dist/core.js';
test('cities resolve without accents or airport knowledge',()=>{for(const [city,code] of [['sao paulo','GRU'],['Rio de Janeiro','GIG'],['Lisboa','LIS'],['Paris','CDG'],['Londres','LHR'],['Nova York','JFK'],['toquio','HND']])assert.equal(resolvePlace(city)?.code,code,city);});
test('ambiguous and unknown names are not converted to guessed airport codes',()=>{assert.equal(resolvePlace('London'),null);assert.equal(resolvePlace('qualquer cidade inventada'),null);assert.equal(resolvePlace(''),null);const known=placeForAirport('LHR');assert.equal(resolvePlace(known.label).code,'LHR');});
test('suggestions and airport labels preserve readable city and airport names',()=>{assert.ok(suggestPlaces('lisb').some(p=>p.code==='LIS'));assert.match(airportName('GRU'),/São Paulo/);assert.match(airportName('GRU'),/Guarulhos/);assert.match(localityInput('place','city','GRU'),/São Paulo/);});
test('only the former default traveler name is neutralized in existing backups',()=>{const s=freshState();s.settings.nameB='Meu Amor';assert.equal(validateState(s).settings.nameB,'Viajante 2');s.settings.nameB='Maria';assert.equal(validateState(s).settings.nameB,'Maria');});
