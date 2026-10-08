// Integração com os arquivos EA11 e EA20 do TSE (2026).
// Todos os acessos são server-side, centralizados e com cache.
const OFFICIAL_BASE = 'https://resultados.tse.jus.br/oficial';
const STATES = new Set('br ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to'.split(' '));
const CONFIG_TTL = 5 * 60_000;
const RESULTS_TTL = 30_000;
const REQUEST_TIMEOUT = 9_000;

const configState = { value: null, fetchedAt: 0, etag: '', modified: '', inflight: null };
const resultsCache = new Map();

export const OFFICIAL_CONFIG_URL = `${OFFICIAL_BASE}/comum/config/ele-c.json`;
export const getStates = () => [...STATES];
export const toNum = value => {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return 0;
  // Campo percentual vem como "47,03"; totais de votos como "56103033".
  const normalized = String(value).trim().replace(/\./g, '').replace(',', '.');
  return Number(normalized) || 0;
};

async function fetchJson(url, cached) {
  const headers = { Accept: 'application/json', 'User-Agent': 'UrnaFlash/1.0 (projeto independente)' };
  if (cached?.etag) headers['If-None-Match'] = cached.etag;
  if (cached?.modified) headers['If-Modified-Since'] = cached.modified;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (response.status === 304 && cached?.value) return { value: cached.value, etag: cached.etag, modified: cached.modified };
  if (!response.ok) throw new Error(`Fonte TSE retornou HTTP ${response.status}`);
  const value = await response.json();
  if (!value || typeof value !== 'object') throw new Error('Resposta JSON inválida');
  return { value, etag: response.headers.get('etag') || '', modified: response.headers.get('last-modified') || '' };
}

export async function getElectionConfig() {
  if (configState.value && Date.now() - configState.fetchedAt < CONFIG_TTL) return configState.value;
  if (configState.inflight) return configState.inflight;
  configState.inflight = (async () => {
    try {
      const result = await fetchJson(OFFICIAL_CONFIG_URL, configState);
      Object.assign(configState, result, { fetchedAt: Date.now() });
      return result.value;
    } catch (err) {
      if (configState.value) return configState.value;
      throw err;
    } finally { configState.inflight = null; }
  })();
  return configState.inflight;
}

// Não consulta o endpoint do segundo turno até ele constar no catálogo oficial.
// Isso evita 404 repetidos, bloqueio de IP e números atribuídos ao turno errado.
export function electionFromConfig(config, round) {
  const rounds = (config?.pl || [])
    .filter(p => p.c === 'ele2026' && p.dt?.endsWith('/2026'))
    .flatMap(p => (p.e || []).map(e => ({ ...e, ciclo: p.c, electionDate: p.dt })));
  return rounds.find(e => String(e.t) === String(round) && (e.abr || []).some(
    a => (a.cp || []).some(cp => String(cp.cd) === '1')
  )) || null;
}

export function officialUrl(election, uf = 'br') {
  if (!STATES.has(uf)) throw new Error('UF inválida');
  const id = String(election.cd);
  if (!/^\d{1,6}$/.test(id) || election.ciclo !== 'ele2026') throw new Error('Configuração de eleição inválida');
  return `${OFFICIAL_BASE}/${election.ciclo}/${id}/dados/${uf}/${uf}-c0001-e${id.padStart(6, '0')}-u.json`;
}

export function normalizeTseResult(raw, round, uf) {
  if (String(raw?.t) !== String(round)) throw new Error('Turno dos dados não corresponde ao solicitado');
  if (raw?.cdabr && String(raw.cdabr).toLowerCase() !== uf) throw new Error('Abrangência dos dados não corresponde à solicitada');
  const candidates = [];
  for (const role of raw.carg || []) {
    if (String(role.cd) !== '1') continue;
    for (const group of role.agr || []) {
      for (const party of group.par || []) {
        for (const candidate of party.cand || []) {
          candidates.push({
            number: String(candidate.n),
            name: String(candidate.nmu || candidate.nm || '').trim(),
            votes: toNum(candidate.vap),
            percentage: toNum(candidate.pvap),
            party: String(party.sg || ''),
            status: String(candidate.st || ''),
            voteDestination: String(candidate.dvt || ''),
            elected: candidate.e === 's',
          });
        }
      }
    }
  }
  candidates.sort((a,b) => b.votes - a.votes);
  if (!candidates.length) throw new Error('Não foram encontrados candidatos presidenciais nos dados');
  const totalSections = toNum(raw.s?.ts);
  const countedSections = toNum(raw.s?.st);
  const progress = totalSections > 0 ? 100 * countedSections / totalSections : toNum(raw.s?.pst);
  const updated = raw.dg && raw.hg ? `${raw.dg} ${raw.hg}` : null;
  return {
    round, uf: uf.toUpperCase(), source: 'TSE — arquivo EA20',
    sourceUrl: null, generatedAt: updated,
    progress: Math.max(0, Math.min(progress, 100)),
    sectionsCounted: countedSections, sectionsTotal: totalSections,
    validVotes: toNum(raw.v?.tvn || raw.v?.vv),
    totalVotes: toNum(raw.v?.tv),
    blankVotes: toNum(raw.v?.vb), nullVotes: toNum(raw.v?.vn),
    finished: raw.and === 'f', candidates,
  };
}

export async function loadResult({ round, uf }) {
  if (![1,2].includes(round) || !STATES.has(uf)) throw new Error('Parâmetros inválidos');
  let config;
  try { config = await getElectionConfig(); }
  catch (error) { return { state: 'unavailable', message: 'Não foi possível consultar a configuração oficial do TSE.' }; }
  const election = electionFromConfig(config, round);
  if (!election) {
    return { state: 'awaiting', round, uf: uf.toUpperCase(),
      message: 'O TSE ainda não publicou a configuração oficial de resultados deste turno.' };
  }
  const url = officialUrl(election, uf);
  const key = `${round}-${uf}`;
  let entry = resultsCache.get(key) || { value: null, fetchedAt: 0, inflight: null, etag: '', modified: '' };
  resultsCache.set(key, entry);
  if (entry.value && Date.now() - entry.fetchedAt < RESULTS_TTL) return { state: 'ok', ...entry.value };
  if (entry.inflight) return entry.inflight;
  entry.inflight = (async () => {
    try {
      const result = await fetchJson(url, {value:entry.raw, etag:entry.etag, modified:entry.modified});
      const parsed = normalizeTseResult(result.value, round, uf);
      parsed.sourceUrl = url;
      Object.assign(entry, {raw:result.value, etag:result.etag, modified:result.modified, value: parsed, fetchedAt: Date.now() });
      return { state: 'ok', ...parsed };
    } catch (error) {
      if (entry.value) return { state: 'stale', ...entry.value, message: 'Exibindo última leitura salva, sem atualização recente.' };
      return { state: 'unavailable', round, uf: uf.toUpperCase(), message: 'O resultado oficial está temporariamente indisponível.' };
    } finally { entry.inflight = null; }
  })();
  return entry.inflight;
}
