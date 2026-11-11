# Publicar APIMETEO no Vercel + Render (sem Docker)

## Arquitetura
- Vercel: frontend React/Vite.
- Render: um único servidor Node/Express no runtime Node nativo (sem Docker) (`apimeteo-api`) com endpoints de geocodificação e previsão.

## Vercel
- Root Directory: pasta que contém `package.json`.
- Framework: Vite.
- Install: `npm ci`.
- Build: `npm run build`.
- Output: `dist`.

## Render
Crie um Blueprint a partir do `render.yaml`. O Blueprint publica apenas `apimeteo-api`. O Render injeta a variável `PORT`; o servidor usa essa porta automaticamente.

## Variável obrigatória no Vercel
`VITE_API_BASE_URL` = URL HTTPS pública de `apimeteo-api` no Render, sem `/api` ao final. Salve e faça Redeploy.

## Health check
Acesse `https://SUA-API.onrender.com/api/health`. A resposta deverá incluir `status: "ok"`, `providerConfigured: true` e `services.locations` e `services.weather` com `online`.

Nunca envie o `.env` ao GitHub. As variáveis `APIMETEO_*` ficam no Render; a variável `VITE_API_BASE_URL` contém somente a URL pública da API.
