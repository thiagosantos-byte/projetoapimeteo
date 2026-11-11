# APIMETEO — experiência meteorológica imersiva

Aplicação responsiva feita com **React, JSX, HTML5, CSS3, JavaScript e Node.js/Express**, sem Docker ou containers. A interface mantém a pesquisa de cidades, condições atuais, previsão horária, previsão de cinco dias e comparação entre duas cidades. A arquitetura foi simplificada: há **um único servidor Express** que executa internamente a busca de cidades e a consulta meteorológica.

## Funcionalidades

- Busca de cidades brasileiras e internacionais pela Open-Meteo Geocoding API.
- Condições atuais, sensação térmica, umidade, vento, pressão, UV, visibilidade e precipitação quando disponibilizados pelo provedor.
- Previsão horária e diária de cinco dias.
- Tradução dos códigos meteorológicos WMO para descrições em português.
- Comparação de duas cidades e histórico local de consultas.
- Cache no servidor, fallback de busca para capitais brasileiras e mensagens de erro legíveis.
- Interface responsiva para desktop, tablet e celular.

## Arquitetura simplificada

```text
Navegador (React + Vite)
        | /api/locations | /api/weather | /api/health
        v
API única (Node.js + Express) — porta 3100 local / PORT do Render
        |
        +--> Geocoding Open-Meteo
        |
        +--> URL meteorológica configurada em APIMETEO_WEATHER_URL_TEMPLATE

Vercel: frontend estático (dist)
Render: uma única API Express
```

`server/index.js` registra as rotas HTTP. `server/locationService.js` e `server/weatherService.js` são módulos internos: **não iniciam servidores nem abrem portas**. `server/weatherAdapter.js` normaliza o JSON do provedor.

## Executar no Windows (sem Docker)

1. Abra o terminal na pasta que contém `package.json`.
2. Crie o arquivo de configuração local: `copy .env.example .env` no PowerShell ou `cp .env.example .env` no Git Bash. Se já existir um `.env` de uma versão antiga, faça uma cópia de segurança e substitua-o pelo `.env.example` atualizado; ele define `API_PORT=3100`.
3. Instale dependências: `npm install`.
4. Inicie a aplicação: `npm run dev`. O comando inicia a API Express (porta 3100) e o Vite (porta 5173); não instala, inicia ou depende de Docker.

A interface estará em `http://localhost:5173` e a API em `http://localhost:3100`. O Vite encaminha automaticamente as chamadas `/api` para a API local. Não inicie `server/locationService.js` nem `server/weatherService.js` separadamente.

## Testes

Com `npm run dev` ativo, abra outro terminal e execute:

```bash
npm run check
npm run test:api
```

Rotas úteis:

| Rota | Resultado |
|---|---|
| `GET http://localhost:3100/api/health` | Estado da API e integração |
| `GET http://localhost:3100/api/locations?q=Salvador` | Resultados da busca |
| `GET http://localhost:3100/api/weather?city=Salvador` | Previsão para a cidade |

A consulta meteorológica depende do endpoint configurado e de conectividade com o provedor. A busca de cidades tem fallback local para algumas capitais brasileiras, mas a previsão real não é inventada quando o provedor está indisponível.

## Configuração APIMETEO

O `.env.example` contém a URL de exemplo da Open-Meteo Forecast API e os caminhos dos campos usados para normalizar a resposta. O `.env` é local e não deve ser enviado ao GitHub. Se o professor fornecer outro endpoint, ajuste `APIMETEO_WEATHER_URL_TEMPLATE` e os `APIMETEO_PATH_*` de acordo com o JSON real. Não coloque chaves privadas no React nem em variáveis `VITE_`.

## Publicação

### Render — backend

1. Envie a pasta do projeto para o GitHub, incluindo `render.yaml`, mas sem `.env`.
2. No Render, escolha **New → Blueprint** e conecte o repositório.
3. O Blueprint cria apenas um serviço: `apimeteo-api`.
4. Aguarde o serviço ficar **Live** e teste `https://SUA-API.onrender.com/api/health`.
5. Se usar um domínio Vercel próprio, configure `FRONTEND_ORIGIN` com a URL exata do frontend. Os domínios padrão `*.vercel.app` também são aceitos.

### Vercel — frontend

1. Importe o mesmo repositório no Vercel.
2. Root Directory: a pasta que contém `package.json`.
3. Framework: Vite; Build: `npm run build`; Output: `dist`.
4. Em **Settings → Environment Variables**, crie `VITE_API_BASE_URL` com a URL HTTPS do serviço `apimeteo-api` no Render, sem `/api` no final.
5. Faça um novo Redeploy depois de salvar a variável.

`VITE_API_BASE_URL` é pública e aponta apenas para o endereço do backend. As configurações `APIMETEO_*` ficam no Render.

## Estrutura principal

```text
server/
  index.js             # API Express única
  locationService.js  # módulo interno de busca de cidades
  weatherService.js   # módulo interno de previsão
  weatherAdapter.js   # mapeamento da resposta meteorológica
src/                  # React, JSX, CSS e interface
scripts/test-api.mjs  # testes HTTP
.env.example
render.yaml
vercel.json
package.json
```
