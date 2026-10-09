import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const part=(a,b)=>{const i=js.indexOf(a),j=js.indexOf(b,i+1);assert.ok(i>=0&&j>i);return js.slice(i,j);};

test('botoes separados de cidade e estado, com busca acessivel no painel',()=>{
  for(const id of ['changeCityBtn','changePlaceBtn','inlineCityPicker','inlineCitySearch','inlineCitySuggestions','inlineCitySearchStatus','inlineCityClose']){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  assert.match(html,/aria-autocomplete="list"/);
  assert.match(js,/setupInlineCityPicker\(\)/);
});

test('trocar cidade atualiza o recorte sem mudar a UF nem pular para o topo',()=>{
  let selected,closed=false,focused=false;
  const ctx={
    uf:'pr', STATE_NAMES:{pr:'Paraná'},
    closeInlineCityPicker(){closed=true},
    selectCity(item,opts){selected={item,opts}},
    $(){return {focus(opts){focused=opts.preventScroll===true}}},
    announceSelection(){}
  };
  runInNewContext(part('function chooseInlineCity(', 'async function searchInlineCities(')+'\nchooseInlineCity({uf:"pr",code:"12345",name:"Castro"});',ctx);
  assert.equal(closed,true);
  assert.equal(focused,true);
  assert.equal(selected.item.name,'Castro');
  assert.equal(selected.opts.keepPosition,true);
});

test('busca de cidades filtra pelo estado atualmente selecionado',async()=>{
  let request='',items;
  const controls={
    '#inlineCitySearch':{value:'Ponta',setAttribute(){},removeAttribute(){}},
    '#inlineCityPicker':{hidden:false},
    '#inlineCitySearchStatus':{textContent:''}
  };
  const ctx={
    uf:'pr',inlineCitySearchSequence:0,inlineCitySearchTimer:null,
    $:(id)=>controls[id],clearTimeout(){},
    fetchJson:async(path)=>{request=path;return {state:'ok',cities:[{uf:'pr',name:'Ponta Grossa',code:'12345'},{uf:'sp',name:'Campinas',code:'54321'}]}},
    renderInlineCities(results){items=results;},
    encodeURIComponent,
  };
  await runInNewContext(part('async function searchInlineCities(', 'function toggleInlineCityPicker(')+'\nsearchInlineCities(true)',ctx);
  assert.equal(request,'/api/cities/search?q=Ponta&uf=pr');
  assert.equal(items.length,1);
  assert.equal(items[0].name,'Ponta Grossa');
});

test('troca pela busca de cidade nao faz rolagem automatica',()=>{
  assert.match(js,/function selectCity\(item,\{fromExplorer=false,keepPosition=false\}=\{\}\)/);
  assert.match(js,/if\(!keepPosition\)\$\('#resultados'\)\.scrollIntoView/);
  assert.doesNotMatch(part('function updateLocalVoteFinder(', 'function syncCityCandidateQuery('), /scrollIntoView/);
});
