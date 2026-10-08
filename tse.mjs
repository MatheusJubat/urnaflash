// Fonte unica dos resultados: Tribunal Superior Eleitoral (EA11, EA12 e EA20).
// ATENCAO: acesso oficial depende da publicacao efetiva dos dados. Nenhuma simulacao em producao.
const BASE = 'https://resultados.tse.jus.br/oficial';
const STATES = new Set('br ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to'.split(' '));
export const STATE_CODES = [...STATES].filter(code=>code!=='br');
export const OFFICIAL_CONFIG_URL = `${BASE}/comum/config/ele-c.json`;
export const OFFICES = Object.freeze({
  presidente:{code:'1',label:'Presidente',group:'federal',rounds:[1,2]},
  governador:{code:'3',label:'Governador',group:'estadual',rounds:[1,2]},
  senador:{code:'5',label:'Senador',group:'estadual',rounds:[1]},
  'deputado-federal':{code:'6',label:'Deputado federal',group:'estadual',rounds:[1]},
  'deputado-estadual':{code:'7',label:'Deputado estadual',group:'estadual',rounds:[1]},
  'deputado-distrital':{code:'8',label:'Deputado distrital',group:'estadual',rounds:[1]},
});
export const getStates = () => [...STATES];
export const toNum = value => {
  if (typeof value === 'number') return Number.isFinite(value)? value : 0;
  if(value===null || value===undefined || value==='')return 0;
  const normalized=String(value).trim().replace(/\./g,'').replace(',','.');
  return Number(normalized)||0;
};
const cache = new Map();
const CONFIG_TTL=5*60_000, RESULTS_TTL=30_000, MUNICIPALITIES_TTL=12*60*60_000;
const REQUEST_TIMEOUT=11_000;
// Limite de memória: a hospedagem gratuita não deve guardar cada cidade consultada para sempre.
function capResultsCache(){
  if(cache.size<=650)return;
  const removable=[...cache.entries()].filter(([,entry])=>!entry.inflight)
    .sort((a,b)=>(a[1].fetchedAt||0)-(b[1].fetchedAt||0));
  for(const [url] of removable){if(cache.size<=480)break;cache.delete(url);}
}
async function readCached(url,ttl){
  const now=Date.now();let entry=cache.get(url);
  if(entry?.value && now-entry.fetchedAt<ttl)return {value:entry.value,stale:false};
  if(entry?.inflight)return entry.inflight;
  if(!entry){entry={value:null,fetchedAt:0,etag:'',modified:'',inflight:null};cache.set(url,entry);capResultsCache();}
  entry.inflight=(async()=>{
    try{
      const h={Accept:'application/json'};
      if(entry.etag)h['If-None-Match']=entry.etag;
      if(entry.modified)h['If-Modified-Since']=entry.modified;
      const r=await fetch(url,{headers:h,signal:AbortSignal.timeout(REQUEST_TIMEOUT)});
      if(r.status===304 && entry.value){entry.fetchedAt=Date.now();return {value:entry.value,stale:false};}
      if(!r.ok)throw new Error(`Fonte retornou HTTP ${r.status}`);
      const data=await r.json();
      if(!data||typeof data!=='object')throw new Error('Resposta sem JSON valido');
      entry.value=data;entry.fetchedAt=Date.now();
      entry.etag=r.headers.get('etag')||'';entry.modified=r.headers.get('last-modified')||'';
      return {value:data,stale:false};
    }catch(e){if(entry.value)return {value:entry.value,stale:true};throw e;}
    finally{entry.inflight=null;}
  })();
  return entry.inflight;
}
export async function getElectionConfig(){return (await readCached(OFFICIAL_CONFIG_URL,CONFIG_TTL)).value;}
function electionEntries(config){
  return (config?.pl||[]).filter(p=>p.c==='ele2026' && String(p.dt||'').endsWith('/2026'))
    .flatMap(p=>(p.e||[]).map(e=>({...e,ciclo:p.c,electionDate:p.dt})));
}
export function electionFromConfig(config,round,office='presidente'){
  const role=OFFICES[office]; if(!role||!role.rounds.includes(Number(round)))return null;
  return electionEntries(config).find(e=>Number(e.t)===Number(round) &&
    (e.abr||[]).some(a=>(a.cp||[]).some(c=>String(c.cd)===role.code))) || null;
}
export function officialUrl(election,uf='br',office='presidente',municipality=''){
  const role=OFFICES[office];
  if(!role||!STATES.has(uf))throw new Error('UF ou cargo invalido');
  if(role.group==='estadual' && uf==='br')throw new Error('Escolha uma UF para esse cargo');
  const id=String(election?.cd||'');
  if(!/^\d{1,6}$/.test(id)||election.ciclo!=='ele2026')throw new Error('Eleicao invalida');
  if(municipality && (!/^[0-9]{5}$/.test(municipality)||uf==='br'))throw new Error('Codigo de municipio invalido');
  return `${BASE}/ele2026/${id}/dados/${uf}/${uf}${municipality}-c${role.code.padStart(4,'0')}-e${id.padStart(6,'0')}-u.json`;
}
function safeText(value){return String(value??'').trim().slice(0,180);}
export function normalizeTseResult(raw,{round,uf,office,municipality=''}){
  const role=OFFICES[office];if(!role)throw new Error('Cargo nao previsto');
  if(raw.t!==undefined && String(raw.t)!==String(round))throw new Error('Turno diferente do solicitado');
  // No arquivo municipal, cdabr identifica o MUNICIPIO, nao a sigla da UF.
  // Conferir ambas as abrangencias para evitar rejeitar votacoes validas.
  const abrangencia=String(raw.cdabr??'').toLowerCase();
  if(municipality){
    if(raw.tpabr && raw.tpabr!=='mu')throw new Error('Abrangencia municipal incorreta');
    if(abrangencia && abrangencia!==municipality)throw new Error('Municipio diferente do solicitado');
  }else if(abrangencia && abrangencia!==uf)throw new Error('UF diferente da solicitada');
  const candidates=[];
  for(const cargo of raw.carg||[]){
    if(String(cargo.cd)!==role.code)continue;
    for(const group of cargo.agr||[]){
      for(const party of group.par||[]){
        for(const c of party.cand||[]){
          if(!c.n && !c.nm && !c.nmu)continue;
          candidates.push({
            number:safeText(c.n),sqcand:/^\d{8,18}$/.test(String(c.sqcand||''))?String(c.sqcand):null,name:safeText(c.nmu||c.nm),
            party:safeText(party.sg||party.sgp||group.sg||''),
            votes:toNum(c.vap),percentage:toNum(c.pvap),
            status:safeText(c.st),elected:c.e==='s' || c.e==='S',
          });
        }
      }
    }
  }
  // Nao inventar resultado quando cargo veio vazio/inexistente.
  if(!candidates.length)throw new Error('Arquivo sem candidatos do cargo solicitado');
  candidates.sort((a,b)=>b.votes-a.votes||a.name.localeCompare(b.name,'pt-BR'));
  const total=toNum(raw.s?.ts),counted=toNum(raw.s?.st);
  const progress=total>0?counted/total*100:toNum(raw.s?.pst);
  return {
    round,office,uf:uf.toUpperCase(),municipality,
    source:'TSE · EA20',generatedAt:raw.dg&&raw.hg?`${raw.dg} ${raw.hg}`:null,
    progress:Math.max(0,Math.min(100,Number(progress.toFixed(2)))),
    sectionsCounted:counted,sectionsTotal:total,sectionsRemaining:total>0?Math.max(0,total-counted):null,
    validVotes:toNum(raw.v?.tvn??raw.v?.vv),totalVotes:toNum(raw.v?.tv),
    blankVotes:toNum(raw.v?.vb),nullVotes:toNum(raw.v?.vn),
    finished:raw.and==='f',candidates,
  };
}
const readyResult=result=>result.candidates.some(c=>c.votes>0) && result.sectionsCounted>0;
export async function loadResult({round=1,uf='br',office='presidente',municipality=''}){
  const role=OFFICES[office];
  if(![1,2].includes(round)||!STATES.has(uf)||!role?.rounds.includes(round))return {state:'invalid',message:'Combinacao de cargo, UF e turno invalida.'};
  if(role.group==='estadual'&&uf==='br')return {state:'choose-state',message:'Escolha um estado para esse cargo.'};
  if(role.code==='8'&&uf!=='df')return {state:'invalid',message:'Deputado distrital e exclusivo do DF.'};
  if(role.code==='7'&&uf==='df')return {state:'invalid',message:'No DF, selecione deputado distrital.'};
  if(municipality && (!/^[0-9]{5}$/.test(municipality)||uf==='br'))return {state:'invalid',message:'Municipio invalido.'};
  if(round===2 && office==='governador'){
    const first=await loadResult({round:1,uf,office:'governador'});
    if(['ok','stale'].includes(first.state)&&first.finished){
      const elected=first.candidates?.find(c=>c.elected);
      if(elected)return {state:'not-applicable',message:`${elected.name} aparece como eleito governador no primeiro turno segundo o TSE. Não há apuração de segundo turno para governador neste estado.`,firstRoundWinner:{name:elected.name,party:elected.party}};
    }
  }
  let config;
  try{config=await getElectionConfig();}catch{return {state:'unavailable',message:'Configuração de eleições do TSE indisponível.'};}
  const election=electionFromConfig(config,round,office);
  if(!election)return {state:'awaiting',message:'O TSE ainda não disponibilizou essa eleição no catálogo oficial.'};
  const url=officialUrl(election,uf,office,municipality);
  try{
    const {value,stale}=await readCached(url,RESULTS_TTL);
    const parsed=normalizeTseResult(value,{round,uf,office,municipality});
    if(!readyResult(parsed))return {state:'awaiting',message:'Aguardando votos válidos e seções totalizadas publicados pelo TSE.'};
    return {...parsed,state:stale?'stale':'ok',sourceUrl:url,
      ...(stale?{message:'Última versão oficial em cache; atualização indisponível.'}:{})};
  }catch{return {state:'unavailable',message:'Dados oficiais ainda indisponíveis para esta seleção.'};}
}
// Situação da eleição para governador, consultada apenas no estado selecionado.
// Não presumir segundo turno porque a data chegou ou porque o arquivo de um estado retorna 404.
export function governorSituationFromResults(first,second=null,{unlocked=false}={}){
  const valid=value=>['ok','stale'].includes(value?.state);
  if(!valid(first))return {state:'unknown',message:'Não foi possível confirmar a situação do governo estadual no TSE.'};
  const elected=first.finished?first.candidates?.find(c=>c.elected):null;
  if(elected)return {state:'decided-first',round:1,person:{name:elected.name,party:elected.party,number:elected.number},
    message:`${elected.name} aparece como eleito no 1º turno, conforme arquivo oficial do TSE.`};
  if(!first.finished)return {state:'checking-first',round:1,message:'A totalização do primeiro turno ainda não consta como encerrada.'};
  if(!unlocked)return {state:'pending',round:1,message:'Nenhum eleito confirmado neste arquivo do 1º turno. Verifique a situação no TSE antes do dia 25.'};
  if(valid(second)){
    const winner=second.finished?second.candidates?.find(c=>c.elected):null;
    if(winner)return {state:'decided-second',round:2,person:{name:winner.name,party:winner.party,number:winner.number},
      progress:second.progress,message:`${winner.name} aparece como eleito no 2º turno, conforme arquivo oficial do TSE.`};
    return {state:second.finished?'counted-second':'counting-second',round:2,progress:second.progress,
      leader:second.candidates?.[0]?.name||null,message:second.finished?'Seções totalizadas; aguardando confirmação oficial do eleito.':`Apuração do governo estadual em andamento: ${second.progress.toLocaleString('pt-BR')}% das seções totalizadas.`};
  }
  return {state:'pending',round:2,message:'Ainda não foram encontrados votos oficiais do segundo turno para governador neste estado. A disputa pode não ocorrer aqui.'};
}
export async function loadGovernorSituation(uf,{unlocked=false}={}){
  if(!STATES.has(uf)||uf==='br')return {state:'invalid',message:'Selecione um estado.'};
  const first=await loadResult({round:1,uf,office:'governador'});
  const firstSituation=governorSituationFromResults(first,null,{unlocked:false});
  if(!unlocked||firstSituation.state==='decided-first'||firstSituation.state==='unknown'||firstSituation.state==='checking-first')return firstSituation;
  const second=await loadResult({round:2,uf,office:'governador'});
  return governorSituationFromResults(first,second,{unlocked:true});
}
// Compartilhamos um snapshot de mapa entre visitantes. Reduz carga no Render e na CDN do TSE.
const mapCache=new Map();
export function stateMapRecord(uf,d){
  const valid=['ok','stale'].includes(d.state)&&d.candidates?.[0]?.votes>0;
  const first=valid?d.candidates[0]:null,second=valid?d.candidates[1]:null;
  return {uf,state:d.state,progress:valid?d.progress:null,finished:valid&&!!d.finished,
    sectionsCounted:valid?d.sectionsCounted:null,sectionsTotal:valid?d.sectionsTotal:null,
    sectionsRemaining:valid?d.sectionsRemaining:null,generatedAt:d.generatedAt||null,
    leader:first?{name:first.name,party:first.party,number:first.number,percentage:first.percentage,votes:first.votes}:null,
    second:second?{name:second.name,number:second.number,percentage:second.percentage,votes:second.votes}:null,
    leadVotes:first&&second?Math.max(0,first.votes-second.votes):null};
}
export async function loadStateMap(round){
  if(![1,2].includes(round))return {state:'invalid',message:'Turno inválido'};
  const prev=mapCache.get(round),now=Date.now();
  if(prev?.value && now-prev.at<60_000)return prev.value;
  if(prev?.inflight)return prev.inflight;
  const task=(async()=>{
    const statuses=new Array(STATE_CODES.length);
    let i=0;async function worker(){while(i<STATE_CODES.length){const index=i++,uf=STATE_CODES[index];
      const d=await loadResult({round,uf,office:'presidente'});
      statuses[index]=stateMapRecord(uf,d);
    }}
    await Promise.all(Array.from({length:5},worker));
    const value={state:'ok',round,states:statuses,checkedAt:new Date().toISOString()};
    mapCache.set(round,{at:Date.now(),value});return value;
  })();
  mapCache.set(round,{value:prev?.value,at:prev?.at||0,inflight:task});
  try{return await task;}catch(err){if(prev?.value)return prev.value;throw err;}
  finally{const entry=mapCache.get(round);if(entry?.inflight===task)mapCache.set(round,{value:entry.value,at:entry.at});}
}
// EA12: municípios podem aparecer agrupados por abrangência/UF.
// Percorrer a árvore preservando o código da UF para não retornar somente o primeiro estado.
export function parseMunicipalities(json,uf){
  const matches=new Map();
  function visit(node,region=''){
    if(Array.isArray(node)){for(const part of node)visit(part,region);return;}
    if(!node||typeof node!=='object')return;
    const value=node.cd??node.cm??'';
    const cd=/^\d{1,5}$/.test(String(value))?String(value).padStart(5,'0'):String(value);
    const nextRegion=/^[a-z]{2}$/i.test(cd)?cd.toLowerCase():
      /^[a-z]{2}$/i.test(String(node.uf??''))?String(node.uf).toLowerCase():region;
    const name=safeText(node.nm||node.n||node.ds||'');
    if(/^\d{5}$/.test(cd)&&name&&nextRegion===uf){
      matches.set(cd,{code:cd,ibge:String(node.cdi||node.ibge||''),name});
    }
    // Percorrer apenas os nós que podem conter outras abrangências/municípios.
    for(const key of ['abr','mu','mun','municipios','muns','mm','m','c','ufs','uf']){
      if(node[key] && typeof node[key]==='object')visit(node[key],nextRegion);
    }
  }
  visit(json);return [...matches.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
export async function loadMunicipalities(uf){
  if(!STATES.has(uf)||uf==='br')return {state:'invalid',municipalities:[]};
  let config;try{config=await getElectionConfig();}catch{return {state:'unavailable',municipalities:[]};}
  const election=electionFromConfig(config,1,'presidente');
  if(!election)return {state:'awaiting',municipalities:[]};
  const id=String(election.cd).padStart(6,'0');
  const url=`${BASE}/ele2026/${election.cd}/config/mun-e${id}-cm.json`;
  try{
    const raw=(await readCached(url,MUNICIPALITIES_TTL)).value;
    const municipalities=parseMunicipalities(raw,uf);
    if(!municipalities.length)return {state:'unavailable',municipalities:[]};
    return {state:'ok',municipalities};
  }catch{return {state:'unavailable',municipalities:[]};}
}
export function activeRoundFromResults(first,second){return ['ok','stale'].includes(second?.state)&&second?.candidates?.some(c=>c.votes>0)&&second?.sectionsCounted>0?2:1;}

// Municipio validado em tabela de codigos TSE de 2024 (Portaria 594/2024),
// corroborado pelo IBGE 4104659. Usado somente se o catalogo EA12 falhar;
// nao representa votos e NAO confirma a publicacao do arquivo EA20 de 2026.
const REFERENCE_MUNICIPALITIES=[{code:'75221',ibge:'4104659',name:'Carambeí',uf:'pr'}];
export function normalizeSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
export function searchMunicipalities(rows,q,uf='',limit=12){
  const term=normalizeSearch(q);
  if(term.length<2)return [];
  return rows.filter(city=>(!uf||city.uf===uf)&&normalizeSearch(city.name).includes(term))
    .sort((a,b)=>{
      const x=normalizeSearch(a.name),y=normalizeSearch(b.name);
      return Number(!x.startsWith(term))-Number(!y.startsWith(term))||x.length-y.length||x.localeCompare(y,'pt-BR');
    }).slice(0,limit);
}
let catalogCache={at:0,value:null,inflight:null};
export async function searchCities(q,uf=''){
  if(normalizeSearch(q).length<2)return {state:'ok',cities:[]};
  if(uf && (!STATES.has(uf)||uf==='br'))return {state:'invalid',cities:[]};
  const recent=catalogCache.value && Date.now()-catalogCache.at<MUNICIPALITIES_TTL;
  let catalog=recent?catalogCache.value:null;
  if(!catalog){
    if(!catalogCache.inflight){
      catalogCache.inflight=(async()=>{
        const cfg=await getElectionConfig();
        const e=electionFromConfig(cfg,1,'presidente');
        if(!e)throw new Error('Eleicao federal nao encontrada');
        const id=String(e.cd).padStart(6,'0');
        const raw=(await readCached(`${BASE}/ele2026/${e.cd}/config/mun-e${id}-cm.json`,MUNICIPALITIES_TTL)).value;
        const rows=STATE_CODES.flatMap(code=>parseMunicipalities(raw,code).map(city=>({...city,uf:code})));
        if(rows.length<500)throw new Error('Catalogo de municipios incompleto');
        catalogCache={at:Date.now(),value:rows,inflight:null};return rows;
      })().finally(()=>catalogCache.inflight=null);
    }
    try{catalog=await catalogCache.inflight;}catch{catalog=catalogCache.value;}
  }
  if(!catalog){return {state:'partial',cities:searchMunicipalities(REFERENCE_MUNICIPALITIES,q,uf),message:'A busca completa de cidades esta temporariamente indisponivel. Tente novamente em instantes.'};}
  // Fallback pontual somente se houver inconsistencias no cadastro recebido.
  return {state:'ok',cities:searchMunicipalities(catalog,q,uf)};
}
