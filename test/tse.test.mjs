import test from 'node:test';import assert from 'node:assert/strict';
import {OFFICES,electionFromConfig,officialUrl,normalizeTseResult,toNum,parseMunicipalities,activeRoundFromResults,searchMunicipalities,normalizeSearch} from '../tse.mjs';
const config={pl:[{cd:'3220',c:'ele2026',dt:'04/10/2026',e:[
  {cd:'6257',cdt2:'6258',t:'1',abr:[{cd:'br',cp:[{cd:'1',ds:'Presidente'}]}]},
  {cd:'6259',cdt2:'6260',t:'1',abr:[{cd:'br',cp:[{cd:'3'},{cd:'5'},{cd:'6'},{cd:'7'},{cd:'8'}]}]}
]}]};
const role=(cd,sg,candidate)=>({cd,agr:[{par:[{sg,cand:[candidate]}]}]});
const raw={t:'1',cdabr:'pr',dg:'04/10/2026',hg:'22:30:00',and:'f',
 s:{ts:'12500',st:'12500',pst:'100,00'},v:{tv:'2500000',tvn:'2300000',vb:'100000',vn:'100000'},
 carg:[role('5','Partido A',{n:'111',nmu:'Candidato de exemplo',vap:'1200000',pvap:'52,17'}),
       role('6','Partido B',{n:'2222',nmu:'Pessoa exemplo',vap:'123456',pvap:'10,12',e:'s'})]};
test('parse dos campos numericos em formato brasileiro',()=>{assert.equal(toNum('47,03'),47.03);assert.equal(toNum('1.234.567'),1234567);});
test('config separa eleição federal e estadual',()=>{
  assert.equal(electionFromConfig(config,1,'presidente').cd,'6257');
  for(const office of ['governador','senador','deputado-federal','deputado-estadual','deputado-distrital'])assert.equal(electionFromConfig(config,1,office).cd,'6259');
  assert.equal(electionFromConfig(config,2,'presidente'),null);
  assert.equal(electionFromConfig(config,2,'senador'),null);
});
test('URLs distintas para cargos e municipios no 2026 do TSE',()=>{
  assert.equal(officialUrl(electionFromConfig(config,1,'presidente'),'br','presidente'),'https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json');
  assert.equal(officialUrl(electionFromConfig(config,1,'senador'),'pr','senador'),'https://resultados.tse.jus.br/oficial/ele2026/6259/dados/pr/pr-c0005-e006259-u.json');
  assert.equal(officialUrl(electionFromConfig(config,1,'senador'),'pr','senador','75353'),'https://resultados.tse.jus.br/oficial/ele2026/6259/dados/pr/pr75353-c0005-e006259-u.json');
});
test('cargo senador e deputado do primeiro turno não se misturam',()=>{
  const s=normalizeTseResult(raw,{round:1,uf:'pr',office:'senador'});
  const d=normalizeTseResult(raw,{round:1,uf:'pr',office:'deputado-federal'});
  assert.equal(s.candidates[0].number,'111');assert.equal(s.candidates[0].party,'Partido A');
  assert.equal(d.candidates[0].number,'2222');assert.equal(d.candidates[0].elected,true);
  assert.equal(d.progress,100);
});
test('recusa dados de turno, uf e cargo errados',()=>{
  assert.throws(()=>normalizeTseResult(raw,{round:2,uf:'pr',office:'senador'}),/Turno/);
  assert.throws(()=>normalizeTseResult(raw,{round:1,uf:'sp',office:'senador'}),/UF/);
  assert.throws(()=>normalizeTseResult(raw,{round:1,uf:'pr',office:'presidente'}),/sem candidatos/);
});
test('proteção contra injeção em codigo de municipio e uf',()=>{
  const e=electionFromConfig(config,1,'senador');
  assert.throws(()=>officialUrl(e,'../','senador'),/UF/);
  assert.throws(()=>officialUrl(e,'pr','senador','../etc'),/municipio/);
  assert.throws(()=>officialUrl(e,'br','senador'),/Escolha uma UF/);
});
test('catálogo de municípios agrupado por UF',()=>{
  const sample={abr:[{cd:'ac',mu:[{cd:'01120',cdi:'1200013',nm:'Acrelândia'}]},{cd:'pr',mu:[{cd:'75353',cdi:'4106902',nm:'Curitiba'},{cd:'76678',cdi:'4113700',nm:'Londrina'},{cd:75221,cdi:4104659,nm:'Carambeí'}]}]};
  assert.deepEqual(parseMunicipalities(sample,'pr').map(x=>x.name),['Carambeí','Curitiba','Londrina']);
  assert.equal(parseMunicipalities(sample,'ac')[0].code,'01120');
});
test('segundo turno so entra em destaque com dados validos',()=>{
  assert.equal(activeRoundFromResults(null,{state:'awaiting'}),1);
  assert.equal(activeRoundFromResults(null,{state:'ok',sectionsCounted:0,candidates:[{votes:90}]}),1);
  assert.equal(activeRoundFromResults(null,{state:'ok',sectionsCounted:10,candidates:[{votes:90}]}),2);
});

test('resultado municipal de Carambeí aceita cdabr numérico da cidade, não exige cdabr PR',()=>{
  const sample={...raw,tpabr:'mu',cdabr:'75221'};
  const result=normalizeTseResult(sample,{round:1,uf:'pr',office:'senador',municipality:'75221'});
  assert.equal(result.municipality,'75221');
  assert.equal(result.candidates[0].votes,1200000);
  assert.throws(()=>normalizeTseResult(sample,{round:1,uf:'pr',office:'senador',municipality:'75222'}),/Municipio/);
});
test('busca municipal reconhece acentos, nomes e estado correto',()=>{
  const sample=[{uf:'pr',name:'Carambeí',code:'75221',ibge:'4104659'},{uf:'sp',name:'Campinas',code:'62910',ibge:'3509502'}];
  assert.equal(normalizeSearch(' CARAMBÉI '),'carambei');
  assert.equal(searchMunicipalities(sample,'carambei')[0].code,'75221');
  assert.equal(searchMunicipalities(sample,'campinas','pr').length,0);
});
