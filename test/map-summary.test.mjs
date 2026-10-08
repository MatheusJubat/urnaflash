import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function renderScopeSummary(){');
const end=source.indexOf('async function refreshNational()',start);
assert.ok(start>=0&&end>start);
const functions=source.slice(start,end);
function fixture(chosenUF,states,br){
  const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{textContent:'',style:{},hidden:false});return elements.get(id);};
  const ctx={
    $,
    uf:chosenUF,round:1,statesData:states,latestNational:br,
    STATE_NAMES:{br:'Brasil',pr:'Paraná',sp:'São Paulo'},
    statusByUF(code){return ctx.statesData[code]||null;},
    fmtPct:n=>Number(n).toFixed(2)+'%',fmtVotes:n=>Number(n||0).toLocaleString('pt-BR'),
  };
  runInNewContext(functions+'\nrenderScopeSummary();',ctx);
  return {ctx,get:id=>$(id).textContent};
}
const leader={name:'Candidato A',number:'13',percentage:53.2,votes:123456};
const states={pr:{leader,progress:79,sectionsCounted:79,sectionsTotal:100,sectionsRemaining:21,finished:false},sp:{leader:{name:'Candidato B',percentage:50.8,votes:123},progress:100,sectionsCounted:100,sectionsTotal:100,sectionsRemaining:0,finished:true}};
const br={state:'ok',candidates:[{...leader,elected:false}],finished:false,progress:88,sectionsCounted:88,sectionsTotal:100,sectionsRemaining:12};
test('ao escolher Paraná o resumo exibe apenas os números de Paraná',()=>{
 const x=fixture('pr',states,br);
 assert.equal(x.get('#scopeEyebrow'),'PRESIDÊNCIA · PARANÁ');
 assert.equal(x.get('#nationalProgress'),'79.00%');
 assert.equal(x.get('#nationalRemaining'),'21');
 assert.equal(x.get('#nationalLeader'),'Candidato A');
 assert.match(x.get('#explorerStateVotesProgress'),/21 seções restantes/);
});
test('ao voltar ao Brasil o resumo retorna ao resultado nacional, sem confundir líder estadual com eleito',()=>{
 const x=fixture('br',states,br);
 assert.equal(x.get('#scopeEyebrow'),'PRESIDÊNCIA · BRASIL');
 assert.equal(x.get('#nationalProgress'),'88.00%');
 assert.equal(x.get('#nationalBadge'),'Parcial');
 assert.equal(x.ctx.$('#explorerStateVotes').hidden,true);
});
test('outro estado altera o resumo e não atribui vitória nacional ao líder estadual',()=>{
 const x=fixture('sp',states,br);
 assert.equal(x.get('#scopeEyebrow'),'PRESIDÊNCIA · SÃO PAULO');
 assert.equal(x.get('#nationalProgress'),'100.00%');
 assert.equal(x.get('#nationalLeader'),'Candidato B');
 assert.equal(x.get('#nationalLeadLabel'),'Candidato à frente');
 assert.match(x.get('#nationalStatusDetail'),/não representa o resultado nacional/);
});
test('um estado sem dados mostra aguardando, sem inventar votos',()=>{
 const x=fixture('pr',{},br);
 assert.equal(x.get('#nationalLeader'),'—');
 assert.equal(x.get('#nationalProgress'),'—');
 assert.match(x.get('#nationalStatus'),/aguardando dados/);
});
