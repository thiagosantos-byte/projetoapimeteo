// Serviço interno de geocodificação. Não abre uma porta própria.
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;

const BRAZIL_CITY_FALLBACKS = [
  { id: 'br-salvador', name: 'Salvador', region: 'Bahia', country: 'Brasil', latitude: -12.9714, longitude: -38.5014, timezone: 'America/Bahia', aliases: ['salvador'] },
  { id: 'br-sao-paulo', name: 'São Paulo', region: 'São Paulo', country: 'Brasil', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo', aliases: ['sao paulo', 'saopaulo'] },
  { id: 'br-rio-de-janeiro', name: 'Rio de Janeiro', region: 'Rio de Janeiro', country: 'Brasil', latitude: -22.9068, longitude: -43.1729, timezone: 'America/Sao_Paulo', aliases: ['rio', 'rio de janeiro'] },
  { id: 'br-brasilia', name: 'Brasília', region: 'Distrito Federal', country: 'Brasil', latitude: -15.7939, longitude: -47.8828, timezone: 'America/Sao_Paulo', aliases: ['brasilia'] },
  { id: 'br-recife', name: 'Recife', region: 'Pernambuco', country: 'Brasil', latitude: -8.0476, longitude: -34.8770, timezone: 'America/Recife', aliases: ['recife'] },
  { id: 'br-fortaleza', name: 'Fortaleza', region: 'Ceará', country: 'Brasil', latitude: -3.7319, longitude: -38.5267, timezone: 'America/Fortaleza', aliases: ['fortaleza'] },
  { id: 'br-belo-horizonte', name: 'Belo Horizonte', region: 'Minas Gerais', country: 'Brasil', latitude: -19.9167, longitude: -43.9345, timezone: 'America/Sao_Paulo', aliases: ['belo horizonte'] },
  { id: 'br-curitiba', name: 'Curitiba', region: 'Paraná', country: 'Brasil', latitude: -25.4284, longitude: -49.2733, timezone: 'America/Sao_Paulo', aliases: ['curitiba'] },
  { id: 'br-manaus', name: 'Manaus', region: 'Amazonas', country: 'Brasil', latitude: -3.1190, longitude: -60.0217, timezone: 'America/Manaus', aliases: ['manaus'] },
  { id: 'br-porto-alegre', name: 'Porto Alegre', region: 'Rio Grande do Sul', country: 'Brasil', latitude: -30.0346, longitude: -51.2177, timezone: 'America/Sao_Paulo', aliases: ['porto alegre'] }
];

function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function fallbackCitySearch(query) {
  const normalized = normalizeSearchText(query);
  return BRAZIL_CITY_FALLBACKS
    .filter((city) => [city.name, ...city.aliases].some((name) => normalizeSearchText(name).startsWith(normalized)))
    .slice(0, 5)
    .map(({ aliases, ...city }) => ({
      ...city,
      displayName: [city.name, city.region, city.country].filter(Boolean).join(', '),
      source: 'local-fallback'
    }));
}

export async function searchLocations(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (query.length < 2) {
    return { status: 400, body: { error: 'Informe uma cidade com pelo menos dois caracteres.', code: 'INVALID_CITY_QUERY' } };
  }

  const key = `geo:${normalizeSearchText(query)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', query);
    url.searchParams.set('count', '10');
    url.searchParams.set('language', 'pt');
    url.searchParams.set('format', 'json');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Open-Meteo Geocoding respondeu HTTP ${response.status}.`);

    const data = await response.json();
    if (data.error) throw new Error(data.reason || 'A busca de cidades foi recusada pelo serviço externo.');

    const results = (data.results || []).map((item) => {
      const name = item.name || query;
      const region = item.admin1 || item.admin2 || null;
      const country = item.country || null;
      return {
        id: item.id || `${item.latitude}-${item.longitude}`,
        name,
        region,
        country,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        timezone: item.timezone || null,
        displayName: [name, region, country].filter(Boolean).join(', ')
      };
    }).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

    const finalResults = results.length ? results : fallbackCitySearch(query);
    if (!finalResults.length) {
      const value = { status: 404, body: { error: `Nenhum local encontrado para “${query}”.`, code: 'CITY_NOT_FOUND' } };
      cache.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
      return value;
    }

    const value = {
      status: 200,
      body: {
        results: finalResults,
        source: results.length ? 'open-meteo' : 'local-fallback',
        ...(!results.length ? { notice: 'Busca local temporária: o serviço externo está indisponível.' } : {})
      }
    };
    cache.set(key, { value, expiresAt: results.length ? CACHE_TTL : 10 * 60 * 1000 });
    return value;
  } catch (error) {
    console.error(`[GEOCODIFICAÇÃO] Falha ao pesquisar “${query}”:`, error.message);
    const fallbackResults = fallbackCitySearch(query);
    if (fallbackResults.length) {
      const value = {
        status: 200,
        body: { results: fallbackResults, source: 'local-fallback', notice: 'Busca local temporária: o serviço externo está indisponível.' }
      };
      cache.set(key, { value, expiresAt: 10 * 60 * 1000 });
      return value;
    }
    return {
      status: 502,
      body: {
        error: 'O serviço de geocodificação está indisponível.',
        detail: error.name === 'TimeoutError' ? 'Tempo limite excedido ao consultar Open-Meteo.' : error.message,
        code: 'GEOCODING_UPSTREAM_FAILURE'
      }
    };
  }
}
