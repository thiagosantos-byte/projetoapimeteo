# Deploy APIMETEO — Vercel + Render (sem Docker)

- **Vercel:** publica o frontend React/Vite (`dist`).
- **Render:** hospeda apenas um serviço Node/Express chamado `apimeteo-api`, usando o runtime Node nativo (sem Docker).
- Busca de cidades e previsão são módulos dentro desse único servidor, não serviços separados.

## 1. Render

1. Envie os arquivos do projeto para a raiz do repositório GitHub, incluindo `render.yaml`. Não envie `.env`.
2. No Render, selecione **New → Blueprint**, conecte o repositório e confirme a criação de somente `apimeteo-api`.
3. Após ficar **Live**, abra `https://SUA-API.onrender.com/api/health`. Deve retornar JSON com `status: "ok"` e `services.locations`/`services.weather` como `online`. `providerConfigured` deve ser `true`.

## 2. Vercel

1. Importe o mesmo repositório no Vercel. Defina o Root Directory como a pasta que contém `package.json`.
2. Use Framework `Vite`, Build Command `npm run build` e Output Directory `dist`.
3. Em Environment Variables, adicione `VITE_API_BASE_URL` com a URL HTTPS pública do `apimeteo-api` no Render, sem `/api` no final.
4. Faça Redeploy após salvar.

## 3. Testes finais

- `https://SUA-API.onrender.com/api/health`
- `https://SUA-API.onrender.com/api/locations?q=Salvador`
- `https://SUA-API.onrender.com/api/weather?city=Salvador`
- Abra o domínio Vercel, pesquise Salvador e compare com Recife.

Não configure `LOCATION_SERVICE_URL`, `WEATHER_SERVICE_URL` ou portas 3002/3003. Essa arquitetura não usa mais esses serviços separados.
