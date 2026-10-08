import test from 'node:test';
import assert from 'node:assert/strict';
import { electionFromConfig, officialUrl, normalizeTseResult, toNum } from '../tse.mjs';

const config = {pl:[
  {c:'ele2026',dt:'04/10/2026',e:[{cd:'6257',t:'1',abr:[{cd:'br',cp:[{cd:'1',ds:'Presidente'}]}]}]},
  {c:'ele2026',dt:'25/10/2026',e:[{cd:'6258',t:'2',abr:[{cd:'br',cp:[{cd:'1',ds:'Presidente'}]}]}]},
]};
const fixture = {
  t:'1',cdabr:'br',dg:'04/10/2026',hg:'22:30:00',and:'f',
  s:{ts:'472075',st:'472075',pst:'100,00'},
  e:{te:'158745463',est:'123456789'}, v:{tv:'124252796',tvn:'119973757',vb:'1323555',vn:'2955484'},
  carg:[{cd:'1',agr:[
    {par:[{sg:'PL',cand:[{n:'22',nm:'Flávio Bolsonaro',nmu:'FLÁVIO BOLSONARO',vap:'56103033',pvap:'47,03',dvt:'Válido'}]}]},
    {par:[{sg:'PT',cand:[{n:'13',nm:'Lula',nmu:'LULA',vap:'53870724',pvap:'45,16',dvt:'Válido'}]}]},
  ]}],
};
test('converte corretamente percentuais com vírgula',()=>{
 assert.equal(toNum('47,03'),47.03);
 assert.equal(toNum('56.103.033'),56103033);
 assert.equal(toNum('56103033'),56103033);
});
test('descobre os dois turnos no catálogo oficial sem presumir arquivo não publicado',()=>{
 assert.equal(electionFromConfig({pl: config.pl.slice(0,1)},2),null);
 const first=electionFromConfig(config,1);
 const second=electionFromConfig(config,2);
 assert.equal(first.cd,'6257');
 assert.equal(second.cd,'6258');
 assert.equal(officialUrl(first),'https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json');
 assert.equal(officialUrl(second,'pr'),'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/pr/pr-c0001-e006258-u.json');
});
test('normaliza EA20 com cargos, agrupamentos, partidos, candidatos e seções',()=>{
 const result=normalizeTseResult(fixture,1,'br');
 assert.equal(result.progress,100);
 assert.equal(result.sectionsCounted,472075);
 assert.equal(result.candidates[0].number,'22');
 assert.equal(result.candidates[0].votes,56103033);
 assert.equal(result.candidates[0].percentage,47.03);
 assert.equal(result.candidates[1].percentage,45.16);
 assert.equal(result.validVotes,119973757);
 assert.equal(result.finished,true);
});
test('recusa um arquivo de turno ou UF incorretos',()=>{
 assert.throws(()=>normalizeTseResult(fixture,2,'br'),/Turno/);
 assert.throws(()=>normalizeTseResult(fixture,1,'sp'),/Abrangência/);
});
test('não permite UF injetada no caminho da URL',()=>{
 assert.throws(()=>officialUrl(electionFromConfig(config,1),'../foo'),/UF inválida/);
});
