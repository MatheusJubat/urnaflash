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
async function readCached(url,ttl){
  const now=Date.now();let entry=cache.get(url);
  if(entry?.value && now-entry.fetchedAt<ttl)return {value:entry.value,stale:false};
  if(entry?.inflight)return entry.inflight;
  if(!entry){entry={value:null,fetchedAt:0,etag:'',modified:'',inflight:null};cache.set(url,entry);}
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
  if(raw.cdabr && String(raw.cdabr).toLowerCase()!==uf)throw new Error('UF diferente da solicitada');
  const candidates=[];
  for(const cargo of raw.carg||[]){
    if(String(cargo.cd)!==role.code)continue;
    for(const group of cargo.agr||[]){
      for(const party of group.par||[]){
        for(const c of party.cand||[]){
          if(!c.n && !c.nm && !c.nmu)continue;
          candidates.push({
            number:safeText(c.n),name:safeText(c.nmu||c.nm),
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
    sectionsCounted:counted,sectionsTotal:total,
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
export async function loadStateMap(round){
  if(![1,2].includes(round))return {state:'invalid',message:'Turno inválido'};
  const statuses=[];
  // Limitar concorrencia para respeitar a infraestrutura do TSE.
  let i=0;async function worker(){while(i<STATE_CODES.length){const uf=STATE_CODES[i++];
    const d=await loadResult({round,uf,office:'presidente'});
    statuses.push({uf,state:d.state,progress:d.progress||0,finished:!!d.finished,
      generatedAt:d.generatedAt||null,
      leader:['ok','stale'].includes(d.state)&&d.candidates?.[0]?.votes>0?{
        name:d.candidates[0].name,party:d.candidates[0].party,number:d.candidates[0].number,
        percentage:d.candidates[0].percentage,votes:d.candidates[0].votes
      }:null});
  }}
  await Promise.all(Array.from({length:5},worker));
  statuses.sort((a,b)=>STATE_CODES.indexOf(a.uf)-STATE_CODES.indexOf(b.uf));
  return {state:'ok',round,states:statuses,checkedAt:new Date().toISOString()};
}
// EA12: municípios podem aparecer agrupados por abrangência/UF.
// Percorrer a árvore preservando o código da UF para não retornar somente o primeiro estado.
export function parseMunicipalities(json,uf){
  const matches=new Map();
  function visit(node,region=''){
    if(Array.isArray(node)){for(const part of node)visit(part,region);return;}
    if(!node||typeof node!=='object')return;
    const cd=String(node.cd??node.cm??'');
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
