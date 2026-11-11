import dotenv from 'dotenv';
import express from 'express';
import { searchLocations } from './locationService.js';
import { getWeather, weatherHealth } from './weatherService.js';
import { configuredWeatherFields } from './weatherAdapter.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
// Render injects PORT in production; local development uses API_PORT (3100 by default).
const PORT = Number(process.env.PORT || process.env.API_PORT || 3100);
app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));

const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isVercelOrigin = typeof origin === 'string' && /^https:\/\/[a-z0-9-]+(?:-[a-z0-9-]+)*\.vercel\.app$/i.test(origin);
  if (origin && (allowedOrigins.has(origin.replace(/\/$/, '')) || isVercelOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Accept,Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (_req, res) => {
  const health = weatherHealth();
  res.json({
    status: 'ok',
    service: 'apimeteo-api',
    architecture: 'single-express-api',
    provider: health.provider,
    providerConfigured: health.providerConfigured,
    mappedFields: configuredWeatherFields(),
    services: { locations: 'online', weather: 'online' }
  });
});

app.get('/api/locations', async (req, res) => {
  const result = await searchLocations(req.query.q);
  return res.status(result.status).json(result.body);
});

app.get('/api/weather', async (req, res) => {
  const cityName = String(req.query.city || '').trim();
  if (!cityName) {
    return res.status(400).json({ error: 'Informe o nome de uma cidade.', code: 'INVALID_CITY_QUERY' });
  }

  const hasLatitude = req.query.lat !== undefined && req.query.lat !== '';
  const hasLongitude = req.query.lon !== undefined && req.query.lon !== '';
  if (hasLatitude !== hasLongitude) {
    return res.status(400).json({ error: 'Latitude e longitude devem ser informadas juntas.', code: 'INVALID_COORDINATES' });
  }

  let city;
  if (hasLatitude) {
    city = {
      name: cityName,
      region: String(req.query.region || ''),
      country: String(req.query.country || ''),
      latitude: Number(req.query.lat),
      longitude: Number(req.query.lon)
    };
  } else {
    const locationResult = await searchLocations(cityName);
    if (locationResult.status !== 200) return res.status(locationResult.status).json(locationResult.body);
    const match = locationResult.body.results?.[0];
    if (!match) {
      return res.status(404).json({ error: `Nenhum local encontrado para “${cityName}”.`, code: 'CITY_NOT_FOUND' });
    }
    city = {
      name: match.name,
      region: match.region || '',
      country: match.country || '',
      latitude: match.latitude,
      longitude: match.longitude
    };
  }

  const result = await getWeather(city);
  return res.status(result.status).json(result.body);
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Rota da API não encontrada.', code: 'API_ROUTE_NOT_FOUND' });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'APIMETEO API',
    status: 'online',
    health: '/api/health',
    endpoints: ['/api/locations?q=Salvador', '/api/weather?city=Salvador']
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`APIMETEO API disponível em http://localhost:${PORT}`);
  console.log(`Integração meteorológica: ${process.env.APIMETEO_WEATHER_URL_TEMPLATE ? 'configurada' : 'não configurada'}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} já está em uso. Feche o processo que a utiliza ou altere API_PORT no arquivo .env.`);
  } else {
    console.error('Não foi possível iniciar a API APIMETEO:', error.message);
  }
  process.exit(1);
});
