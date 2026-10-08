import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {getElectionConfig,electionFromConfig,loadResult,loadStateMap,loadMunicipalities,getStates,OFFICES,searchCities,loadGovernorSituation} from './tse.mjs';
import {REGIONS,regionBySlug,slugPath} from './regions.mjs';
import {brasilDate,secondRoundUnlocked,defaultRound,SECOND_ROUND_DATE} from './schedule.mjs';

const PORT=Number(process.env.PORT||3000), HOST=process.env.HOST||'0.0.0.0';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const template=await readFile(path.join(root,'index.html'),'utf8');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8'};
const IBGE_CODES={ac:12,al:27,ap:16,am:13,ba:29,ce:23,df:53,es:32,go:52,ma:21,mt:51,ms:50,mg:31,pa:15,pb:25,pr:41,pe:26,pi:22,rj:33,rn:24,rs:43,ro:11,rr:14,sc:42,sp:35,se:28,to:17};
const geometryCache=new Map();
function security(res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
}
function send(res,status,body,mime,head=false,cache='no-store'){
  res.writeHead(status,{'Content-Type':mime,'Cache-Control':cache});res.end(head?undefined:body);
}
function json(res,status,obj,head=false){send(res,status,JSON.stringify(obj),'application/json; charset=utf-8',head);}
function originFor(req){
  if(process.env.PUBLIC_SITE_URL){try{const u=new URL(process.env.PUBLIC_SITE_URL);if(['https:','http:'].includes(u.protocol))return u.origin;}catch{}}
  const host=(req.headers.host||'').toLowerCase();if(!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host))return 'https://urnaflash.com.br';
  return `${process.env.NODE_ENV==='production'?'https':'http'}://${host}`;
}
function pageFor(region,origin){
  const [uf,name]=region;
  const title=uf==='br'?'Eleições 2026: resultados do 1º e 2º turno e mapa | UrnaFlash':`Eleições 2026 em ${name}: resultados e mapa | UrnaFlash`;
  const description=`Eleições 2026${uf==='br'?'':` em ${name}`}: resultados oficiais do TSE para presidente, governadores, senadores e deputados, com mapa interativo e apuração por estado.`;
  const url=`${origin}${slugPath(uf)}`;
  const structured=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:title,description,url,inLanguage:'pt-BR',isAccessibleForFree:true,isPartOf:{'@type':'WebSite',name:'UrnaFlash',url:origin+'/'}}).replace(/</g,'\\u003c');
  const replacements={'{{PAGE_TITLE}}':title,'{{PAGE_DESCRIPTION}}':description,'{{PAGE_URL}}':url,'{{OG_IMAGE_URL}}':origin+'/share.png','{{PAGE_REGION}}':name,'{{JSON_LD}}':structured};
  let html=template;for(const [key,value] of Object.entries(replacements))html=html.replaceAll(key,value);return html;
}
async function getGeometry(kind,uf=''){
  const key=kind+uf,old=geometryCache.get(key);if(old?.value && Date.now()-old.at<24*3600_000)return old.value;
  if(old?.inflight)return old.inflight;
  const code=IBGE_CODES[uf];
  if(kind==='cities'&&!code)throw new Error('UF inválida');
  const base='https://servicodados.ibge.gov.br/api/v3/malhas';
  const url=kind==='states'?`${base}/paises/BR?intrarregiao=UF&formato=application/vnd.geo%2Bjson&qualidade=minima`:
    `${base}/estados/${code}?intrarregiao=municipio&formato=application/vnd.geo%2Bjson&qualidade=minima`;
  const flight=(async()=>{
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(13_000)});
      if(!response.ok)throw new Error(`IBGE respondeu ${response.status}`);
      const len=Number(response.headers.get('content-length')||0);if(len>14_000_000)throw new Error('Malha muito grande');
      const text=await response.text();if(text.length>14_000_000)throw new Error('Malha muito grande');
      const parsed=JSON.parse(text);
      if(parsed?.type!=='FeatureCollection'||!Array.isArray(parsed.features))throw new Error('GeoJSON IBGE não reconhecido');
      geometryCache.set(key,{at:Date.now(),value:parsed});
      // Manter Brasil e no máximo dois mapas estaduais em memória.
      const completed=[...geometryCache.entries()].filter(([,entry])=>entry.value).sort((a,b)=>a[1].at-b[1].at);
      for(const [oldKey] of completed){if(completed.length<=3)break;if(oldKey!==key){geometryCache.delete(oldKey);completed.shift();}}
      return parsed;
    }catch(err){if(old?.value)return old.value;throw err;}
  })();geometryCache.set(key,{...old,inflight:flight});
  try{return await flight;}finally{const entry=geometryCache.get(key);if(entry?.inflight===flight)geometryCache.delete(key);}
}
export const server=http.createServer(async(req,res)=>{
  security(res);const head=req.method==='HEAD';if(req.method!=='GET'&&!head)return json(res,405,{error:'Metodo nao permitido'});
  let url;try{url=new URL(req.url,`http://${req.headers.host||'localhost'}`);}catch{return json(res,400,{error:'URL invalida'},head);}
  if(url.pathname==='/api/health')return json(res,200,{ok:true,service:'urnaflash',version:'6.1.0'},head);
  if(url.pathname==='/api/status'){
    try{const c=await getElectionConfig();return json(res,200,{source:'TSE',rounds:{'1':!!electionFromConfig(c,1),'2':!!electionFromConfig(c,2)},checkedAt:new Date().toISOString()},head);}catch{return json(res,503,{error:'Fonte TSE indisponivel'},head);}
  }
  if(url.pathname==='/api/auto'){
    const enabled=secondRoundUnlocked(),now=brasilDate();
    // Antes de 25/10 não consultar arquivos que podem nem estar publicados (evita 404 no TSE).
    return json(res,200,{recommendedRound:defaultRound(),unlocked:enabled,brasilDate:now,
      unlockDate:SECOND_ROUND_DATE,checkedAt:new Date().toISOString()},head);
  }
  if(url.pathname==='/api/governor-status'){
    const uf=(url.searchParams.get('uf')||'').toLowerCase();
    if(!IBGE_CODES[uf])return json(res,400,{state:'invalid',message:'Escolha um estado válido.'},head);
    return json(res,200,await loadGovernorSituation(uf,{unlocked:secondRoundUnlocked()}),head);
  }
  if(url.pathname==='/api/results'){
    const round=Number(url.searchParams.get('round')||1),office=url.searchParams.get('office')||'presidente';
    const uf=(url.searchParams.get('uf')||'br').toLowerCase(),municipality=url.searchParams.get('municipality')||'';
    if(![1,2].includes(round)||!getStates().includes(uf)||!OFFICES[office]|| (municipality&&!/^\d{5}$/.test(municipality)))return json(res,400,{state:'invalid',message:'Parametros invalidos'},head);
    const data=await loadResult({round,uf,office,municipality});
    return json(res,data.state==='invalid'?400:200,data,head);
  }
  if(url.pathname==='/api/map'){
    const round=Number(url.searchParams.get('round')||1);if(![1,2].includes(round))return json(res,400,{state:'invalid'},head);
    return json(res,200,await loadStateMap(round),head);
  }
  if(url.pathname==='/api/cities/search'){
    const q=(url.searchParams.get('q')||'').slice(0,90);
    const state=(url.searchParams.get('uf')||'').toLowerCase();
    if(state && !IBGE_CODES[state])return json(res,400,{state:'invalid',cities:[]},head);
    return json(res,200,await searchCities(q,state),head);
  }
  if(url.pathname==='/api/municipalities'){
    const uf=(url.searchParams.get('uf')||'').toLowerCase();if(!IBGE_CODES[uf])return json(res,400,{state:'invalid'},head);
    return json(res,200,await loadMunicipalities(uf),head);
  }
  if(url.pathname==='/api/geo/states'||url.pathname==='/api/geo/cities'){
    const kind=url.pathname.endsWith('states')?'states':'cities',uf=(url.searchParams.get('uf')||'').toLowerCase();
    if(kind==='cities'&&!IBGE_CODES[uf])return json(res,400,{error:'UF inválida'},head);
    try{return json(res,200,await getGeometry(kind,uf),head);}catch{return json(res,503,{error:'Malha geográfica IBGE temporariamente indisponível'},head);}
  }
  const origin=originFor(req);
  if(url.pathname==='/robots.txt')return send(res,200,`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,'text/plain; charset=utf-8',head,'public, max-age=1800');
  if(url.pathname==='/sitemap.xml'){
    const xml='<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+REGIONS.map(([uf])=>`<url><loc>${origin}${slugPath(uf)}</loc></url>`).join('\n')+'\n</urlset>';
    return send(res,200,xml,'application/xml; charset=utf-8',head,'public, max-age=1800');
  }
  const segments=url.pathname.split('/').filter(Boolean);
  const region=(!segments.length||(segments.length===1&&segments[0]==='eleicoes-2026'))?REGIONS[0]:
    segments.length===2&&segments[0]==='eleicoes-2026'?regionBySlug(segments[1]):null;
  if(region)return send(res,200,pageFor(region,origin),'text/html; charset=utf-8',head,'public, max-age=120');
  if(url.pathname.startsWith('/eleicoes-2026/'))return json(res,404,{error:'Regiao nao encontrada'},head);
  let requested;try{requested=decodeURIComponent(url.pathname);}catch{return json(res,400,{error:'Caminho invalido'},head);}
  const file=path.resolve(root,'.'+requested);
  if(!file.startsWith(root+path.sep))return json(res,403,{error:'Acesso negado'},head);
  try{const info=await stat(file);if(!info.isFile())throw Error();const bytes=await readFile(file);
    return send(res,200,bytes,types[path.extname(file)]||'application/octet-stream',head,'public,max-age=300');}
  catch{return json(res,404,{error:'Arquivo nao encontrado'},head);}
});
if(process.env.NODE_ENV!=='test')server.listen(PORT,HOST,()=>console.log(`UrnaFlash v6 em ${HOST}:${PORT}`));
