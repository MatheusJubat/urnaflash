import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeTseResult,officialCandidatePhotoUrl,statusOfCandidates,governorSituationFromResults} from '../tse.mjs';
const makeCandidate=(num,name,votes,e='n')=>({n:String(num),sqcand:'210002547857',nmu:name,vap:String(votes),pvap:String((votes/1000).toFixed(2)).replace('.',','),e});
const raw=(round,office,people)=>({t:String(round),cdabr:office==='presidente'?'br':'rs',and:'f',s:{ts:100,st:100},v:{tv:1100,vv:1000,tvn:30,vn:29,vb:70},carg:[{cd:office==='presidente'?'1':'3',agr:[{par:[{sg:'PART',cand:people}]}]}]});
test('EA20: distingue validos, brancos e total de nulos',()=>{
 const data=normalizeTseResult(raw(2,'presidente',[makeCandidate(13,'A',480,'s'),makeCandidate(22,'B',520)]),{round:2,uf:'br',office:'presidente'});
 assert.equal(data.validVotes,1000);assert.equal(data.blankVotes,70);assert.equal(data.nullVotes,30);assert.equal(data.totalVotes,1100);
});
test('1º turno: dois marcados e=s são CLASSIFICADOS, não dois eleitos',()=>{
 const data=normalizeTseResult(raw(1,'presidente',[makeCandidate(13,'A',480,'s'),makeCandidate(22,'B',520,'s')]),{round:1,uf:'br',office:'presidente'});
 assert.equal(data.decision.kind,'runoff');assert.equal(data.candidates.filter(c=>c.elected).length,0);
 assert.equal(data.candidates.filter(c=>c.runoffQualified).length,2);
});
test('governador: dois classificados em primeiro turno não são governador eleito',()=>{
 const data=normalizeTseResult(raw(1,'governador',[makeCandidate(10,'X',480,'s'),makeCandidate(20,'Y',520,'s')]),{round:1,uf:'rs',office:'governador'});
 assert.equal(governorSituationFromResults({...data,state:'ok'},null,{unlocked:false}).state,'pending');
});
test('2º turno presidencial: somente candidaturas existentes no arquivo EA20',()=>{
 const data=normalizeTseResult(raw(2,'presidente',[makeCandidate(13,'A',480),makeCandidate(22,'B',520)]),{round:2,uf:'br',office:'presidente'});
 assert.equal(data.candidates.length,2);assert.equal(data.decision.kind,'counted');
});
test('fotos do TSE obtidas por eleição, UF e sqcand com validação estrita',()=>{
 assert.equal(officialCandidatePhotoUrl('6259','rs','210002547857'),'https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/rs/210002547857.jpeg');
 assert.equal(officialCandidatePhotoUrl('6259','br','../path'),null);
 assert.equal(officialCandidatePhotoUrl('../../','rs','210002547857'),null);
});
test('interface tem votos detalhados, filtro de candidaturas e escolha de estado para governador',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 for(const id of ['voteBreakdown','candidateSearchWrap','officeStatePicker','officeStateOptions','mapOtherLegend'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(js,/renderVoteBreakdown\(data\)/);assert.match(js,/office!=='presidente'&&uf==='br'/);
 assert.match(js,/mapOtherLegend'\)\.hidden=round===2/);
});
test('a tela do segundo turno abre em 25/10, mas consulta a fonte só a partir das 17h Brasília',async()=>{
 const {secondRoundPublicationOpen,secondRoundUnlocked}=await import('../schedule.mjs');
 assert.equal(secondRoundUnlocked(new Date('2026-10-25T03:00:00Z')),true);
 assert.equal(secondRoundPublicationOpen(new Date('2026-10-25T03:00:00Z')),false);
 assert.equal(secondRoundPublicationOpen(new Date('2026-10-25T19:59:59Z')),false);
 assert.equal(secondRoundPublicationOpen(new Date('2026-10-25T20:00:00Z')),true);
 assert.equal(secondRoundPublicationOpen(new Date('2026-10-26T03:00:00Z')),true);
});
