import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const content=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=content.indexOf('function drawCityMap(){');
const end=content.indexOf('\nfunction resetExplorerZoom()',start);
assert.ok(start>-1&&end>start,'função do mapa municipal existe');
const drawCityMapSource=content.slice(start,end);

function makeElement(tag){return {
  tag, attributes:{}, children:[],setAttribute(k,v){this.attributes[k]=String(v);},
  append(child){this.children.push(child);},
  addEventListener(){}, replaceChildren(...children){this.children=children;},
  getAttribute(k){return this.attributes[k];},
  get hidden(){return false;}
};}
function drawFixture({municipality,showConsultedCities}){
  const cityMap=makeElement('div');
  const fakeCities=[{code:'11111',ibge:'4100001',name:'Município A'},{code:'22222',ibge:'4100002',name:'Município B'}];
  const features=fakeCities.map((city,index)=>({id:city.ibge,properties:{},geometry:{type:'Polygon',coordinates:[[[-52+index,-25],[-51+index,-25],[-51+index,-24],[-52+index,-24],[-52+index,-25]]]}}));
  const leader={name:'Candidato de teste',number:'22',percentage:55};
  const cache=new Map(fakeCities.map(city=>[`1-pr-${city.code}`,{leader,progress:90,sectionsRemaining:2,finished:false}]));
  const context={
    municipality,uf:'pr',round:1,cityGeoUF:'pr',cityGeoFeatures:features,
    cityCache:{pr:{municipalities:fakeCities}},cityVoteCache:cache,showConsultedCities,
    mapViewBox:null,viewZoom:1,ignoreNextMapClick:false,
    $:selector=>selector==='#cityMap'?cityMap:{hidden:false},
    el:(name,cls,content)=>{const e=makeElement(name);e.textContent=content;return e;},
    document:{createElementNS:(ns,tag)=>makeElement(tag)},
    polygonsFor:g=>g.type==='Polygon'?[g.coordinates]:g.coordinates,
    cityGeoId:feature=>feature.id,
    mapFill:d=>d.leader.number==='22'?'var(--green)':'var(--red)',
    fmtPct:n=>n+'%',fmtVotes:n=>String(n),
    resetExplorerZoom:()=>{},updateZoomButtons:()=>{},wireExplorerPan:()=>{},selectCity:()=>{},
    console,
  };
  runInNewContext(drawCityMapSource+'\ndrawCityMap();',context);
  const paths=cityMap.children[0].children.filter(x=>x.tag==='path');
  return Object.fromEntries(paths.map(p=>[p.getAttribute('data-city-code'),p]));
}
test('duas cidades visitadas não aparecem ambas selecionadas por padrão',()=>{
  const paths=drawFixture({municipality:'22222',showConsultedCities:false});
  assert.equal(paths['11111'].getAttribute('fill'),'var(--gray)');
  assert.equal(paths['22222'].getAttribute('fill'),'var(--blue-soft)');
  assert.equal(paths['11111'].getAttribute('data-selected'),'false');
  assert.equal(paths['22222'].getAttribute('data-selected'),'true');
});
test('ao trocar de município apenas a seleção ativa muda',()=>{
  const paths=drawFixture({municipality:'11111',showConsultedCities:false});
  assert.equal(paths['11111'].getAttribute('data-selected'),'true');
  assert.equal(paths['22222'].getAttribute('fill'),'var(--gray)');
});
test('cores de votação de duas cidades consultadas são exibidas somente no modo opcional',()=>{
  const paths=drawFixture({municipality:'22222',showConsultedCities:true});
  assert.equal(paths['11111'].getAttribute('fill'),'var(--green)');
  assert.equal(paths['22222'].getAttribute('fill'),'var(--green)');
  assert.equal(paths['11111'].getAttribute('data-selected'),'false');
  assert.equal(paths['22222'].getAttribute('data-selected'),'true');
});
