import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getElectionConfig, electionFromConfig, loadResult, getStates } from './tse.mjs';
import { REGIONS, regionBySlug, slugPath } from './regions.mjs';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const indexTemplate = await readFile(path.join(root, 'index.html'), 'utf8');
const types = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8'
};
function security(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
}
function send(res, status, body, mime, head=false, cache='no-store') {
  res.writeHead(status, {'Content-Type':mime, 'Cache-Control':cache});
  res.end(head ? undefined : body);
}
function json(res, status, obj, head=false) { send(res,status,JSON.stringify(obj),'application/json; charset=utf-8',head); }
function originFor(req) {
  if (process.env.PUBLIC_SITE_URL) {
    try { const u=new URL(process.env.PUBLIC_SITE_URL); if (['http:','https:'].includes(u.protocol)) return u.origin; } catch {}
  }
  const host = (req.headers.host || '').toLowerCase();
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host)) return 'https://urnaflash.com.br';
  return `${process.env.NODE_ENV==='production' ? 'https':'http'}://${host}`;
}
function pageFor(region, origin) {
  const [uf,name] = region;
  const title = uf==='br' ? 'Eleições 2026: Apuração do 2º Turno ao Vivo | UrnaFlash' : `Eleições 2026 em ${name}: Apuração do 2º Turno | UrnaFlash`;
  const description = `Eleições 2026${uf==='br'?' no Brasil':` em ${name}`}: acompanhe a apuração presidencial do 2º turno, resultados do TSE, votos de Lula e Flávio Bolsonaro, gráficos e seções totalizadas.`;
  const url = `${origin}${slugPath(uf)}`;
  const structured = JSON.stringify({
    '@context':'https://schema.org', '@type':'WebPage', name:title,description,
    url, inLanguage:'pt-BR',isAccessibleForFree:true,
    isPartOf:{'@type':'WebSite',name:'UrnaFlash',url:origin+'/'}
  }).replace(/</g,'\\u003c');
  const substitutions={
    '{{PAGE_TITLE}}':title, '{{PAGE_DESCRIPTION}}':description,
    '{{PAGE_URL}}':url, '{{OG_IMAGE_URL}}':origin+'/share.png',
    '{{PAGE_REGION}}':name, '{{JSON_LD}}':structured
  };
  let html=indexTemplate;
  for (const [key,val] of Object.entries(substitutions)) html=html.replaceAll(key,val);
  return html;
}
export const server=http.createServer(async (req,res)=>{
  security(res);
  const head=req.method==='HEAD';
  if (req.method!=='GET' && !head) return json(res,405,{error:'Método não permitido'});
  let url;
  try { url=new URL(req.url, `http://${req.headers.host||'localhost'}`); }
  catch { return json(res,400,{error:'URL inválida'},head); }
  if (url.pathname==='/api/health') return json(res,200,{ok:true,service:'urnaflash',version:'2.0.0'},head);
  if (url.pathname==='/api/status') {
    try {
      const config=await getElectionConfig();
      return json(res,200,{source:'TSE',rounds:{'1':!!electionFromConfig(config,1),'2':!!electionFromConfig(config,2)},checkedAt:new Date().toISOString()},head);
    } catch { return json(res,503,{source:'TSE',rounds:{'1':false,'2':false},error:'Fonte indisponível'},head); }
  }
  if (url.pathname==='/api/results') {
    const valueRound=url.searchParams.get('round')||'2';
    const uf=(url.searchParams.get('uf')||'br').toLowerCase();
    if (!['1','2'].includes(valueRound)||!getStates().includes(uf)) return json(res,400,{error:'Turno ou UF inválida'},head);
    const value=await loadResult({round:Number(valueRound),uf});
    return json(res,value.state==='unavailable'?503:200,value,head);
  }
  const origin=originFor(req);
  if (url.pathname==='/robots.txt') return send(res,200,`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,'text/plain; charset=utf-8',head,'public, max-age=1800');
  if (url.pathname==='/sitemap.xml') {
    const pages=[['br','Brasil'],...REGIONS.filter(([uf])=>uf!=='br')];
    const xml='<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(([uf])=>`  <url><loc>${origin}${slugPath(uf)}</loc></url>`).join('\n')+'\n</urlset>';
    return send(res,200,xml,'application/xml; charset=utf-8',head,'public, max-age=1800');
  }
  const segments=url.pathname.split('/').filter(Boolean);
  const region=(segments.length===0 || (segments.length===1&&segments[0]==='eleicoes-2026')) ? REGIONS[0]
    : (segments.length===2&&segments[0]==='eleicoes-2026' ? regionBySlug(segments[1]) : null);
  if(region){return send(res,200,pageFor(region,origin),'text/html; charset=utf-8',head,'public, max-age=120');}
  if (url.pathname.startsWith('/eleicoes-2026/')) return json(res,404,{error:'Região não encontrada'},head);
  let requested;
  try{requested=decodeURIComponent(url.pathname);}catch{return json(res,400,{error:'Caminho inválido'},head);}
  const file=path.resolve(root, '.'+requested);
  if(!file.startsWith(root+path.sep)) return json(res,403,{error:'Acesso negado'},head);
  try {
    const info=await stat(file);
    if(!info.isFile()) throw new Error('not-file');
    const bytes=await readFile(file);
    const type=types[path.extname(file)]||'application/octet-stream';
    return send(res,200,bytes,type,head,path.basename(file)==='sw.js'?'no-cache':'public, max-age=300');
  }catch{return json(res,404,{error:'Arquivo não encontrado'},head);}
});
if (process.env.NODE_ENV!=='test') server.listen(PORT,HOST,()=>console.log(`UrnaFlash disponível em ${HOST}:${PORT}`));
