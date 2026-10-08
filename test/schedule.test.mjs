import test from 'node:test';
import assert from 'node:assert/strict';
import {brasilDate,secondRoundUnlocked,defaultRound,officialOutcome} from '../schedule.mjs';
import {normalizeTseResult,stateMapRecord} from '../tse.mjs';
const candidate=(n,v,e='n')=>({n,nmu:'Nome '+n,vap:String(v),pvap:'55,00',e});
function file({and='p',sections=80,total=100,e='n'}={}){return {t:'2',tpabr:'uf',cdabr:'pr',and,
  s:{st:String(sections),ts:String(total),pst:String(sections)},v:{tvn:'500',tv:'520',vb:'10',vn:'10'},
  carg:[{cd:'1',agr:[{par:[{sg:'PART',cand:[candidate('13',275,e),candidate('22',225)]}]}]}]};}
const parse=v=>({...normalizeTseResult(file(v),{round:2,uf:'pr',office:'presidente'}),state:'ok'});
test('horário de Brasília: 24/10 continua bloqueado mesmo que UTC já seja 25/10',()=>{
  const date=new Date('2026-10-25T02:59:59Z');
  assert.equal(brasilDate(date),'2026-10-24');assert.equal(secondRoundUnlocked(date),false);assert.equal(defaultRound(date),1);
});
test('00:00 do dia 25 em Brasília habilita segundo turno antes de chegarem votos',()=>{
  const date=new Date('2026-10-25T03:00:00Z');assert.equal(brasilDate(date),'2026-10-25');
  assert.equal(secondRoundUnlocked(date),true);assert.equal(defaultRound(date),2);
});
test('apuração parcial informa seções restantes e não oficializa liderança',()=>{
 const data=parse();assert.equal(data.progress,80);assert.equal(data.sectionsRemaining,20);
 assert.equal(officialOutcome(data).kind,'partial');
 const state=stateMapRecord('pr',data);assert.equal(state.progress,80);assert.equal(state.sectionsRemaining,20);assert.equal(state.leader.votes,275);
});
test('100% de seções não confirma vencedor quando TSE não atribuiu eleito',()=>{
 const data=parse({and:'f',sections:100});assert.equal(data.sectionsRemaining,0);
 assert.equal(officialOutcome(data).kind,'totalized-pending-confirmation');
});
test('eleito apenas se registro oficial de eleito e totalização encerrada',()=>{
 assert.equal(officialOutcome(parse({sections:80,and:'p',e:'s'})).kind,'partial');
 const data=parse({and:'f',sections:100,e:'s'});assert.equal(officialOutcome(data).kind,'elected');
 assert.equal(officialOutcome(data).people[0].number,'13');
});
test('mapa fica neutro quando resultado indisponível',()=>{
 const state=stateMapRecord('pr',{state:'unavailable'});assert.equal(state.progress,null);assert.equal(state.leader,null);
 assert.equal(officialOutcome({state:'unavailable'}).kind,'unavailable');
});
