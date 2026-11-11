const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

function readableError(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value instanceof Error && value.message) return value.message;

  if (value && typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) return value.message.trim();
    if (typeof value.error === 'string' && value.error.trim()) return value.error.trim();
    if (value.error && typeof value.error === 'object') {
      return readableError(value.error, fallback);
    }
    if (typeof value.detail === 'string' && value.detail.trim()) return value.detail.trim();
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // Continua para a mensagem alternativa.
    }
  }

  return fallback;
}

function getRequestUrl(path) {
  if (import.meta.env.PROD && !API_BASE_URL) {
    throw new Error(
      'Backend da APIMETEO não configurado no Vercel. Em Settings → Environment Variables, crie VITE_API_BASE_URL com a URL HTTPS do serviço apimeteo-api no Render e faça um novo Redeploy.'
    );
  }

  if (API_BASE_URL && !/^https?:\/\/[^\s]+$/i.test(API_BASE_URL)) {
    throw new Error(
      'VITE_API_BASE_URL está inválida. Informe somente a URL HTTPS pública do serviço apimeteo-api no Render, por exemplo: https://apimeteo-api.onrender.com.'
    );
  }

  return `${API_BASE_URL}${path}`;
}

async function request(path) {
  const url = getRequestUrl(path);
  let response;

  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' }
    });
  } catch (cause) {
    const error = new Error(
      'Não foi possível conectar ao servidor da APIMETEO. Confira se o serviço apimeteo-api está ativo no Render e se VITE_API_BASE_URL contém a URL pública correta.'
    );
    error.cause = cause;
    throw error;
  }

  const responseText = await response.text();
  let body = {};
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    const message = readableError(
      body?.error,
      `O servidor da APIMETEO respondeu com HTTP ${response.status}.`
    );
    const detail = readableError(
      body?.detail,
      responseText && !Object.keys(body).length
        ? 'O endereço configurado não retornou JSON. Confira se VITE_API_BASE_URL aponta para o API do Render, e não para o domínio do frontend.'
        : 'Confira os logs do serviço apimeteo-api no Render.'
    );
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  if (!responseText) return {};
  if (!Object.keys(body).length) {
    throw new Error(
      'O API da APIMETEO respondeu em um formato inesperado. Confira se VITE_API_BASE_URL aponta para o serviço apimeteo-api no Render.'
    );
  }
  return body;
}

export async function searchCities(query) {
  const params = new URLSearchParams({ q: query });
  const data = await request(`/api/locations?${params}`);
  return Array.isArray(data.results) ? data.results : [];
}

export async function getWeather(city) {
  const params = new URLSearchParams({
    city: city.name,
    region: city.region || '',
    country: city.country || '',
    lat: String(city.latitude),
    lon: String(city.longitude)
  });
  return request(`/api/weather?${params}`);
}

export async function getApiHealth() {
  return request('/api/health');
}
