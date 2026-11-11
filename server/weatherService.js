// Serviço meteorológico interno. Não abre uma porta própria.
import { buildWeatherUrl, configuredWeatherFields, normalizeWeather } from './weatherAdapter.js';

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

export function weatherHealth() {
  return {
    provider: 'APIMETEO / Open-Meteo',
    providerConfigured: Boolean(process.env.APIMETEO_WEATHER_URL_TEMPLATE),
    mappedFields: configuredWeatherFields()
  };
}

export async function getWeather(cityInput) {
  const city = {
    name: String(cityInput?.name || '').trim(),
    region: String(cityInput?.region || '').trim(),
    country: String(cityInput?.country || '').trim(),
    latitude: Number(cityInput?.latitude),
    longitude: Number(cityInput?.longitude)
  };

  if (!city.name || !Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)
    || city.latitude < -90 || city.latitude > 90 || city.longitude < -180 || city.longitude > 180) {
    return { status: 400, body: { error: 'Selecione uma cidade válida antes de consultar a previsão.', code: 'INVALID_WEATHER_QUERY' } };
  }

  if (!process.env.APIMETEO_WEATHER_URL_TEMPLATE) {
    return {
      status: 503,
      body: {
        error: 'A integração meteorológica não está configurada no servidor.',
        detail: 'Configure APIMETEO_WEATHER_URL_TEMPLATE no arquivo .env ou nas variáveis do Render.',
        code: 'WEATHER_PROVIDER_NOT_CONFIGURED'
      }
    };
  }

  const cacheKey = `weather:${city.latitude.toFixed(4)}:${city.longitude.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { status: 200, body: cached.value };

  try {
    const url = buildWeatherUrl(city);
    const headers = { Accept: 'application/json' };
    const apiKey = process.env.APIMETEO_API_KEY;
    const authHeader = process.env.APIMETEO_AUTH_HEADER || 'Authorization';
    const authPrefix = process.env.APIMETEO_AUTH_PREFIX ?? 'Bearer';
    if (apiKey && !process.env.APIMETEO_API_KEY_QUERY_PARAM) {
      headers[authHeader] = authPrefix ? `${authPrefix} ${apiKey}` : apiKey;
    }

    const finalUrl = new URL(url);
    if (apiKey && process.env.APIMETEO_API_KEY_QUERY_PARAM) {
      finalUrl.searchParams.set(process.env.APIMETEO_API_KEY_QUERY_PARAM, apiKey);
    }

    const response = await fetch(finalUrl, { headers, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`O provedor meteorológico respondeu HTTP ${response.status}.`);

    const payload = await response.json();
    const normalized = normalizeWeather(payload, city);
    const hasMappedData = Object.entries(normalized.current).some(([key, value]) => key !== 'timezone' && key !== 'observationTime' && value !== null)
      || normalized.hourly.length > 0 || normalized.daily.length > 0;

    if (!hasMappedData) {
      return {
        status: 422,
        body: {
          error: 'A resposta chegou do provedor, mas os campos meteorológicos não foram mapeados.',
          detail: 'Confira o JSON retornado e os caminhos APIMETEO_PATH_* no arquivo .env.',
          code: 'WEATHER_FIELDS_NOT_MAPPED'
        }
      };
    }

    cache.set(cacheKey, { value: normalized, expiresAt: Date.now() + CACHE_TTL });
    return { status: 200, body: normalized };
  } catch (error) {
    console.error('[PREVISÃO] Falha ao consultar o provedor:', error.message);
    return {
      status: 502,
      body: {
        error: 'O provedor meteorológico está indisponível.',
        detail: error.name === 'TimeoutError' ? 'A consulta excedeu o limite de 12 segundos.' : error.message,
        code: 'WEATHER_UPSTREAM_FAILURE'
      }
    };
  }
}
