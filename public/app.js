'use strict';
const $=selector=>document.querySelector(selector);
const STATES=[['ac','Acre'],['al','Alagoas'],['ap','Amapá'],['am','Amazonas'],['ba','Bahia'],['ce','Ceará'],['df','Distrito Federal'],['es','Espírito Santo'],['go','Goiás'],['ma','Maranhão'],['mt','Mato Grosso'],['ms','Mato Grosso do Sul'],['mg','Minas Gerais'],['pa','Pará'],['pb','Paraíba'],['pr','Paraná'],['pe','Pernambuco'],['pi','Piauí'],['rj','Rio de Janeiro'],['rn','Rio Grande do Norte'],['rs','Rio Grande do Sul'],['ro','Rondônia'],['rr','Roraima'],['sc','Santa Catarina'],['sp','São Paulo'],['se','Sergipe'],['to','Tocantins']];
const STATE_NAMES=Object.fromEntries([['br','Brasil'],...STATES]);
const SLUGS={ac:'acre',al:'alagoas',ap:'amapa',am:'amazonas',ba:'bahia',ce:'ceara',df:'distrito-federal',es:'espirito-santo',go:'goias',ma:'maranhao',mt:'mato-grosso',ms:'mato-grosso-do-sul',mg:'minas-gerais',pa:'para',pb:'paraiba',pr:'parana',pe:'pernambuco',pi:'piaui',rj:'rio-de-janeiro',rn:'rio-grande-do-norte',rs:'rio-grande-do-sul',ro:'rondonia',rr:'roraima',sc:'santa-catarina',sp:'sao-paulo',se:'sergipe',to:'tocantins'};
const IBGE_CODES={ac:'12',al:'27',ap:'16',am:'13',ba:'29',ce:'23',df:'53',es:'32',go:'52',ma:'21',mt:'51',ms:'50',mg:'31',pa:'15',pb:'25',pr:'41',pe:'26',pi:'22',rj:'33',rn:'24',rs:'43',ro:'11',rr:'14',sc:'42',sp:'35',se:'28',to:'17'};
const IBGE_TO_UF=Object.fromEntries(Object.entries(IBGE_CODES).map(([uf,num])=>[num,uf]));
const OFFICES={presidente:'Presidente',governador:'Governador',senador:'Senador','deputado-federal':'Deputado federal','deputado-estadual':'Deputado estadual','deputado-distrital':'Deputado distrital'};
const TILES={rr:[0,2],ap:[0,5],am:[1,2],pa:[1,4],ma:[2,5],ce:[2,6],rn:[2,7],ac:[3,0],ro:[3,1],mt:[3,2],to:[3,4],pi:[3,5],pb:[3,7],pe:[4,6],al:[5,7],se:[5,6],ba:[5,5],ms:[4,2],go:[4,3],df:[4,4],mg:[5,4],es:[6,6],rj:[6,5],sp:[6,4],pr:[7,3],sc:[8,3],rs:[9,2]};
const fmtVotes=n=>Number(n||0).toLocaleString('pt-BR');
const fmtPct=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const fetchJson=async path=>{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);return response.json();};
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
let round=1,office='presidente',uf='br',municipality='',manualTurn=false,allCandidates=false;
let resultsSequence=0,mapSequence=0,statesData={},geoFeatures=null,mapRound=1,cityCache={},refreshTimer;
let cityGeoFeatures=null,cityGeoUF='',cityVoteCache=new Map();
const readStore=(key,defaultValue)=>{try{return localStorage.getItem(key)||defaultValue;}catch{return defaultValue;}};
const writeStore=(key,val)=>{try{localStorage.setItem(key,val);}catch{}};
function setTheme(theme){const isDark=theme==='dark';document.documentElement.dataset.theme=isDark?'dark':'light';$('#themeToggle').setAttribute('aria-pressed',String(isDark));$('#themeToggle').setAttribute('aria-label',isDark?'Ativar modo claro':'Ativar modo escuro');$('#themeIcon').textContent=isDark?'☀':'☾';$('#themeLabel').textContent=isDark?'Modo claro':'Modo escuro';writeStore('urnaflash-theme',theme);}
function toast(message){const node=$('#toast');node.textContent=message;node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,4000);}
const email=()=>['contato','urnaflash'].join('')+'@'+'gmail.com';
const pathFor=code=>code==='br'?'/':`/eleicoes-2026/${SLUGS[code]}`;
function applyURL(){const params=new URLSearchParams();if(manualTurn||round===2)params.set('turno',String(round));if(office!=='presidente')params.set('cargo',office);if(municipality)params.set('municipio',municipality);const query=params.toString();history.replaceState({},'',pathFor(uf)+(query?'?'+query:''));}
function setStatus(kind,title,msg){const node=$('#statusBanner');node.dataset.status=kind;$('#statusTitle').textContent=title;$('#statusMessage').textContent=msg;}
function resetCandidateList(){allCandidates=false;$('#candidateList').replaceChildren(el('div','empty-message','Aguardando a publicação dos resultados para esta seleção.'));$('#moreBar').hidden=true;
  for(const [key,txt] of [['progressPercent','—'],['validVotes','—'],['lastUpdated','—'],['sectionCounts','Sem informação'],['progressText','Sem informação']])$('#'+key).textContent=txt;
  $('#progressBar').style.width='0%';}
function populateOffices(){const select=$('#officeSelect'),current=office;
  [...select.options].forEach(opt=>{opt.disabled=round===2&&!['presidente','governador'].includes(opt.value)||opt.value==='deputado-distrital'&&uf!=='df'||opt.value==='deputado-estadual'&&uf==='df';});
  if(round===2&&!['presidente','governador'].includes(office))office='presidente';
  if(office==='deputado-distrital'&&uf!=='df')office='deputado-estadual';
  if(office==='deputado-estadual'&&uf==='df')office='deputado-distrital';
  select.value=office;}
function updateHeadings(){populateOffices();$('#roundSelect').value=String(round);$('#ufSelect').value=uf;
  $('#mapRoundLabel').textContent=round+'º turno';
  const title=STATE_NAMES[uf]||'Brasil';
  $('#officeCaption').textContent=OFFICES[office].toUpperCase();$('#electionHeading').textContent=`${round}º turno · ${title}${municipality?' · município':''}`;
  $('#resultsSubtitle').textContent=municipality?'Apuração municipal publicada pelo TSE':office==='senador'?'Duas vagas de senador em disputa por estado':'Resultados oficiais da eleição selecionada';
  $('#heroRound').textContent=round+'º turno';$('#heroTitle').textContent=round===1?'Resultados do 1º turno':'Apuração do 2º turno';
  $('#heroSubtitle').textContent=round===1?'4 de outubro · Dados oficiais do TSE':'25 de outubro · Acompanhamento oficial';
  applyURL();}
function changeRound(value,manual=true){round=value;if(manual)manualTurn=true;
  municipality='';populateOffices();updateHeadings();resetCandidateList();refreshResults();refreshMap();}
function changeOffice(value){office=value;municipality='';if(office==='deputado-distrital'){uf='df';$('#cityUF').value='df';}
  if(office==='deputado-estadual'&&uf==='df')office='deputado-distrital';
  populateOffices();updateHeadings();resetCandidateList();refreshResults();}
function changeUF(code){if(!STATE_NAMES[code])return;uf=code;municipality='';populateOffices();updateHeadings();resetCandidateList();refreshResults();drawMap();}
function candidateElement(candidate,i){
  const node=el('div','candidate');node.dataset.identity=candidate.number;
  node.append(el('span','candidate-rank',String(i+1).padStart(2,'0')));
  const main=el('div');main.append(el('div','candidate-name',candidate.name||'Nome não informado'),el('div','candidate-meta',`${candidate.party||'Partido não identificado'} · Nº ${candidate.number||'—'}`));
  if(candidate.elected)main.append(el('span','tiny-badge','Eleito conforme o arquivo'));
  node.append(main);
  const stats=el('div','candidate-votes');stats.append(el('strong','',fmtPct(candidate.percentage)),el('span','',`${fmtVotes(candidate.votes)} votos`));node.append(stats);
  const bar=el('div','candidate-bar'),fill=el('span');fill.style.width=`${Math.max(0,Math.min(100,candidate.percentage))}%`;bar.append(fill);node.append(bar);
  return node;
}
let latestCandidates=[];
function paintCandidates(){const max=allCandidates?latestCandidates.length:Math.min(latestCandidates.length,8);
  $('#candidateList').replaceChildren(...latestCandidates.slice(0,max).map(candidateElement));
  $('#moreBar').hidden=latestCandidates.length<=8||allCandidates;
}
function showResults(data){latestCandidates=data.candidates||[];allCandidates=false;paintCandidates();
  if(municipality&&office==='presidente'&&['ok','stale'].includes(data.state)){cityVoteCache.set(`${round}-${uf}-${municipality}`,data.candidates[0]);if(cityGeoUF===uf&&!$('#cityMapPanel').hidden)drawCityMap();}
  $('#progressPercent').textContent=fmtPct(data.progress);$('#progressBar').style.width=Math.min(100,Math.max(0,data.progress))+'%';
  $('#validVotes').textContent=fmtVotes(data.validVotes);$('#lastUpdated').textContent=data.generatedAt||'Não informada';
  $('#sectionCounts').textContent=`${fmtVotes(data.sectionsCounted)} de ${fmtVotes(data.sectionsTotal)} seções`;
  $('#progressText').textContent=data.finished?'Totalização concluída':'Resultado parcial · pode mudar';
  if(data.sourceUrl)$('#tseLink').href=data.sourceUrl;
}
async function refreshResults(){const my=++resultsSequence;updateHeadings();
  setStatus('loading','Consultando resultados oficiais','Buscando arquivo do TSE para a seleção atual.');
  const params=new URLSearchParams({round:String(round),uf,office});if(municipality)params.set('municipality',municipality);
  let data;try{data=await fetchJson('/api/results?'+params);}catch{data={state:'unavailable',message:'Servidor temporariamente indisponível.'};}
  if(my!==resultsSequence)return;
  if(data.state==='ok'||data.state==='stale'){
    showResults(data);
    setStatus(data.state==='ok'?'ok':'awaiting',data.state==='ok'?(data.finished?'Totalização concluída':'Números oficiais disponíveis'):'Último resultado conhecido',
      data.state==='stale'?'Atualização falhou, mostrando última leitura oficial disponível.':`Os dados são do TSE. ${data.finished?'Totalização finalizada no arquivo atual.':'Parcial: a distribuição pode mudar.'}`);
  }else{latestCandidates=[];resetCandidateList();
    setStatus(data.state==='awaiting'||data.state==='choose-state'?'awaiting':'error',
      data.state==='choose-state'?'Escolha um estado':data.state==='awaiting'?'Aguardando publicação do TSE':'Não foi possível carregar o resultado',data.message||'Tente novamente em instantes.');}
}
function mapClass(d){if(!d?.leader)return 'neutral';return d.leader.number==='13'?'red':d.leader.number==='22'?'green':'other';}
function mapFill(d){const cls=mapClass(d);return cls==='red'?'var(--red)':cls==='green'?'var(--green)':cls==='other'?'#917fc1':'var(--gray)';}
function statusByUF(code){return statesData[code]||null;}
function tooltipText(code){const d=statusByUF(code);if(!d?.leader)return `${STATE_NAMES[code]} · sem resultado disponível`;
  return `${STATE_NAMES[code]} · ${d.leader.name} (${d.leader.party||'partido não identificado'}) · ${fmtPct(d.leader.percentage)} · ${d.finished?'totalização concluída':'parcial: '+fmtPct(d.progress)+' das seções'}`;}
function drawTiles(){const root=el('div','map-tiles');root.setAttribute('role','group');root.setAttribute('aria-label','Estados do Brasil em mosaico esquemático');
  for(const [code] of STATES){const pos=TILES[code];if(!pos)continue;
    const button=el('button','state-tile '+mapClass(statusByUF(code)),code.toUpperCase());button.type='button';button.style.gridRow=String(pos[0]+1);button.style.gridColumn=String(pos[1]+1);
    button.setAttribute('aria-label',tooltipText(code));button.title=tooltipText(code);button.addEventListener('click',()=>selectState(code));root.append(button);
  }$('#geoMap').replaceChildren(root);}
function getCode(feature){const p=feature.properties||{};
  for(const raw of [p.codarea,p.CD_UF,p.cd_uf,p.codigo,p.id,feature.id]){const found=IBGE_TO_UF[String(raw??'').trim()];if(found)return found;}
  const str=String(p.sigla||p.uf||'').toLowerCase();if(STATE_NAMES[str])return str;return null;}
function polygonsFor(geometry){if(geometry?.type==='Polygon')return [geometry.coordinates];if(geometry?.type==='MultiPolygon')return geometry.coordinates;return [];}
function drawGeoMap(){const f=geoFeatures;if(!f?.length){drawTiles();return;}
  let all=[];for(const feature of f){for(const poly of polygonsFor(feature.geometry)){for(const ring of poly){for(const pt of ring){if(Number.isFinite(pt[0])&&Number.isFinite(pt[1]))all.push(pt);}}}}
  if(!all.length){drawTiles();return;}
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [x,y] of all){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  const width=620,height=425,pad=12;const scale=Math.min((width-2*pad)/(maxX-minX||1),(height-2*pad)/(maxY-minY||1));
  const w=(maxX-minX)*scale,h=(maxY-minY)*scale,offsetX=(width-w)/2,offsetY=(height-h)/2;
  const px=x=>offsetX+(x-minX)*scale,py=y=>offsetY+(maxY-y)*scale;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','group');svg.setAttribute('aria-label','Mapa geográfico interativo das unidades federativas do Brasil');
  let rendered=0;
  for(const feature of f){const code=getCode(feature);if(!code)continue;
    const paths=[];for(const poly of polygonsFor(feature.geometry)){for(const ring of poly){if(!Array.isArray(ring)||ring.length<3)continue;
      paths.push(ring.map((p,i)=>(i?'L':'M')+px(p[0]).toFixed(1)+','+py(p[1]).toFixed(1)).join(' ')+'Z');}}
    if(!paths.length)continue;
    const p=document.createElementNS(ns,'path');p.setAttribute('d',paths.join(' '));p.setAttribute('fill',mapFill(statusByUF(code)));
    p.setAttribute('fill-rule','evenodd');p.setAttribute('class','geo-state');p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',tooltipText(code));
    const title=document.createElementNS(ns,'title');title.textContent=tooltipText(code);p.append(title);
    p.addEventListener('click',()=>selectState(code));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectState(code);}});svg.append(p);rendered++;
  }
  if(rendered<15){drawTiles();return;}
  $('#geoMap').replaceChildren(svg);
}
function drawMap(){if(geoFeatures)drawGeoMap();else drawTiles();}
function renderStateList(){const root=$('#statesList'),q=$('#stateSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();root.replaceChildren();
  let available=0;
  for(const [code,name] of STATES){if(!name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)&&!code.includes(q))continue;
    const data=statusByUF(code),btn=el('button','state-row');btn.type='button';
    const left=el('div');left.append(el('b','',name),el('div','',code.toUpperCase()));left.lastChild.className='caption';btn.append(left);
    const right=el('div','state-value');if(data?.leader){right.append(el('span','value-main',data.leader.name),el('small','',`${fmtPct(data.leader.percentage)} · ${data.finished?'Concluído':'Parcial'}`));available++;}
    else right.append(el('small','','Aguardando dados'));
    btn.append(right);btn.addEventListener('click',()=>selectState(code));root.append(btn);
  }
  if(!root.children.length)root.append(el('div','empty-message','Nenhum estado encontrado.'));
  $('#statesReady').textContent=`${Object.values(statesData).filter(x=>x.leader).length}/27 com dados`;
}
async function refreshMap(){const seq=++mapSequence;mapRound=round;$('#statesReady').textContent='Consultando...';
  try{const data=await fetchJson('/api/map?round='+mapRound);if(seq!==mapSequence)return;
    statesData=Object.fromEntries((data.states||[]).map(s=>[s.uf,s]));renderStateList();drawMap();}
  catch{if(seq!==mapSequence)return;$('#statesReady').textContent='Indisponível';renderStateList();drawMap();}
}
async function loadGeometry(){try{const data=await fetchJson('/api/geo/states');if(data?.features?.length){geoFeatures=data.features;drawMap();}}catch{drawTiles();}}
function selectState(code){changeUF(code);$('#resultados').scrollIntoView({behavior:'smooth',block:'start'});}
async function loadCities(code){const select=$('#citySelect');select.disabled=true;$('#citySearchBtn').disabled=true;$('#cityMapToggle').disabled=true;select.replaceChildren(new Option('Carregando municípios...',''));
  if(!code){select.replaceChildren(new Option('Selecione primeiro um estado',''));return;}
  let data=cityCache[code];
  try{if(!data){data=await fetchJson(`/api/municipalities?uf=${code}`);if(data.state==='ok')cityCache[code]=data;}}
  catch{data={state:'unavailable'};}
  if(code!==$('#cityUF').value)return;
  if(data.state!=='ok'||!data.municipalities?.length){select.replaceChildren(new Option('Municípios indisponíveis no TSE',''));
    $('#cityHint').textContent='O catálogo de municípios não respondeu. Consulte a fonte TSE e tente novamente mais tarde.';return;}
  select.replaceChildren(new Option('Selecione um município',''),...data.municipalities.map(city=>new Option(city.name,city.code)));
  select.disabled=false;$('#cityMapToggle').disabled=false;$('#cityHint').textContent=`${fmtVotes(data.municipalities.length)} municípios no catálogo oficial. Selecione uma cidade para consultar o resultado.`;
}
function cityGeoId(feature){
  const p=feature.properties||{};for(const raw of [p.codarea,p.CD_MUN,p.codigo,p.id,feature.id]){const id=String(raw||'').trim();if(/^\d{7}$/.test(id))return id;}
  return null;
}
function drawCityMap(){
  if(!cityGeoFeatures?.length){$('#cityMap').replaceChildren(el('p','loading-state','Mapa geográfico municipal indisponível no momento.'));return;}
  const lookup=new Map((cityCache[cityGeoUF]?.municipalities||[]).map(city=>[city.ibge,city]));
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const f of cityGeoFeatures)for(const poly of polygonsFor(f.geometry))for(const ring of poly)for(const pt of ring){
    const [x,y]=pt;if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  if(!Number.isFinite(minX)||maxX<=minX){$('#cityMap').replaceChildren(el('p','loading-state','Geometria municipal não disponível.'));return;}
  const width=790,height=530,scale=Math.min(750/(maxX-minX),490/(maxY-minY));
  const dx=(width-(maxX-minX)*scale)/2,dy=(height-(maxY-minY)*scale)/2;
  const X=x=>dx+(x-minX)*scale,Y=y=>dy+(maxY-y)*scale;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','group');svg.setAttribute('aria-label','Malha municipal do IBGE; escolha uma cidade para consultar seus resultados');
  let drawn=0;
  for(const feature of cityGeoFeatures){
    const item=lookup.get(cityGeoId(feature));if(!item)continue;
    const segments=[];for(const poly of polygonsFor(feature.geometry))for(const ring of poly){if(ring.length<3)continue;
      segments.push(ring.map((pt,index)=>(index?'L':'M')+X(pt[0]).toFixed(1)+','+Y(pt[1]).toFixed(1)).join(' ')+'Z');}
    if(!segments.length)continue;
    const outcome=cityVoteCache.get(`${round}-${cityGeoUF}-${item.code}`);
    const fill=outcome?mapFill({leader:outcome}):'var(--gray)';
    const path=document.createElementNS(ns,'path');path.setAttribute('d',segments.join(' '));path.setAttribute('fill',fill);path.setAttribute('fill-rule','evenodd');path.setAttribute('class','geo-state');
    path.setAttribute('tabindex','0');path.setAttribute('role','button');
    const title=outcome?`${item.name} · ${outcome.name} · ${fmtPct(outcome.percentage)}`:`${item.name} · clique para consultar`;path.setAttribute('aria-label',title);
    const t=document.createElementNS(ns,'title');t.textContent=title;path.append(t);
    const show=()=>{$('#citySelect').value=item.code;$('#citySearchBtn').disabled=false;$('#citySearchBtn').click();};
    path.addEventListener('click',show);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
    svg.append(path);drawn++;
  }
  if(!drawn){$('#cityMap').replaceChildren(el('p','loading-state','Não foi possível relacionar esta malha aos códigos municipais do TSE.'));return;}
  $('#cityMap').replaceChildren(svg);
}
async function openCityMap(){
  const selected=$('#cityUF').value;if(!selected||!cityCache[selected]){toast('Selecione um estado com lista de municípios disponível.');return;}
  $('#cityMapPanel').hidden=false;$('#cityMapTitle').textContent='Mapa dos municípios · '+STATE_NAMES[selected];
  if(cityGeoUF===selected&&cityGeoFeatures){drawCityMap();return;}
  $('#cityMap').replaceChildren(el('p','loading-state','Carregando os limites municipais do IBGE...'));
  try{const data=await fetchJson('/api/geo/cities?uf='+selected);
    if(selected!==$('#cityUF').value)return;
    cityGeoFeatures=data.features||null;cityGeoUF=selected;drawCityMap();
  }catch{cityGeoFeatures=null;cityGeoUF='';drawCityMap();}
}
async function checkAutomaticRound(){if(manualTurn)return;
  try{const data=await fetchJson('/api/auto');const candidate=data.recommendedRound===2?2:1;
    $('#autoStatus').textContent=candidate===2?'Segundo turno com votos oficialmente publicados':'Primeiro turno disponível · segundo turno em preparação';
    if(candidate!==round)changeRound(candidate,false);
  }catch{$('#autoStatus').textContent='Acompanhe a publicação dos resultados oficiais';}
}
function setupSharing(){
  $('#shareBtn').addEventListener('click',async()=>{const link=location.href;if(navigator.share){try{await navigator.share({title:'UrnaFlash 2026',url:link});return;}catch{}}
    try{await navigator.clipboard.writeText(link);toast('Link copiado para compartilhar!');}catch{toast('Copie o endereço da barra do navegador.');}});
  $('#advertBtn').addEventListener('click',()=>{
    const subject=encodeURIComponent('Interesse em anunciar no UrnaFlash');const body=encodeURIComponent('Olá! Tenho interesse em divulgar minha empresa no UrnaFlash.\n\nNome:\nEmpresa:\nCidade:\nMensagem:\n');
    location.href=`mailto:${email()}?subject=${subject}&body=${body}`;
  });
  $('#copyEmailBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(email());toast('E-mail comercial copiado.');}catch{toast('Contato: '+email());}});
}
async function cleanupOldSW(){try{if('serviceWorker' in navigator)for(const r of await navigator.serviceWorker.getRegistrations())if(r.scope.startsWith(location.origin))await r.unregister();}catch{}
  try{if('caches' in window)for(const k of await caches.keys())if(k.startsWith('urnaflash-shell-'))await caches.delete(k);}catch{}}
function init(){setTheme(readStore('urnaflash-theme','light'));$('#themeToggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  for(const [code,name] of STATES){$('#ufSelect').append(new Option(name,code));$('#cityUF').append(new Option(name,code));}
  const path=location.pathname.split('/').filter(Boolean),code=Object.entries(SLUGS).find(([,slug])=>slug===path[1])?.[0];
  uf=code||'br';const params=new URLSearchParams(location.search);
  manualTurn=params.get('turno')==='1'||params.get('turno')==='2';round=params.get('turno')==='2'?2:1;
  office=OFFICES[params.get('cargo')]?params.get('cargo'):'presidente';municipality=/^\d{5}$/.test(params.get('municipio')||'')?params.get('municipio'):'';
  $('#roundSelect').addEventListener('change',e=>changeRound(Number(e.target.value)));
  $('#officeSelect').addEventListener('change',e=>changeOffice(e.target.value));
  $('#ufSelect').addEventListener('change',e=>changeUF(e.target.value));
  $('#refreshBtn').addEventListener('click',refreshResults);$('#mapRefresh').addEventListener('click',refreshMap);
  $('#stateSearch').addEventListener('input',renderStateList);
  $('#moreCandidates').addEventListener('click',()=>{allCandidates=true;paintCandidates();});
  $('#cityUF').addEventListener('change',e=>{$('#cityMapPanel').hidden=true;loadCities(e.target.value);});
  $('#cityMapToggle').addEventListener('click',openCityMap);$('#cityMapClose').addEventListener('click',()=>$('#cityMapPanel').hidden=true);
  $('#citySelect').addEventListener('change',e=>{$('#citySearchBtn').disabled=!e.target.value;});
  $('#citySearchBtn').addEventListener('click',()=>{if(!$('#citySelect').value)return;
    uf=$('#cityUF').value;municipality=$('#citySelect').value;updateHeadings();resetCandidateList();refreshResults();$('#resultados').scrollIntoView({behavior:'smooth'});
  });
  setupSharing();updateHeadings();drawTiles();renderStateList();refreshResults();refreshMap();loadGeometry();checkAutomaticRound();cleanupOldSW();
  refreshTimer=setInterval(()=>{if(document.hidden)return;refreshResults();refreshMap();checkAutomaticRound();},60_000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshResults();refreshMap();checkAutomaticRound();}});
}
init();
