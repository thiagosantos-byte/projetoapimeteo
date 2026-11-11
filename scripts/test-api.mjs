const BASE_URL = (process.env.APIMETEO_TEST_URL || 'http://127.0.0.1:3100').replace(/\/$/, '');
const checks = [];

async function expectStatus(label, endpoint, expectedStatus) {
  const response = await fetch(`${BASE_URL}${endpoint}`, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  const passed = response.status === expectedStatus;
  checks.push({ label, expectedStatus, actualStatus: response.status, passed });
  if (passed) console.log(`OK: ${label} — HTTP ${response.status}`);
  else console.error(`FALHOU: ${label} — esperado HTTP ${expectedStatus}, recebido ${response.status}`, body);
  return { response, body };
}

async function main() {
  console.log(`Testando a API única em ${BASE_URL}\n`);
  await expectStatus('Health check', '/api/health', 200);
  await expectStatus('Campo cidade vazio', '/api/locations?q=', 400);
  await expectStatus('Cidade inexistente', '/api/locations?q=LocalidadeInexistente987654', 404);
  await expectStatus('Previsão sem cidade', '/api/weather?city=', 400);

  for (const cityName of ['Salvador', 'Recife', 'São Paulo', 'Lisboa']) {
    const encoded = encodeURIComponent(cityName);
    await expectStatus(`Busca de ${cityName}`, `/api/locations?q=${encoded}`, 200);
    await expectStatus(`Previsão de ${cityName}`, `/api/weather?city=${encoded}`, 200);
  }

  const failed = checks.filter((check) => !check.passed);
  console.log(`\nResultado: ${checks.length - failed.length}/${checks.length} testes passaram.`);
  if (failed.length) process.exitCode = 1;
  else console.log('Contrato HTTP validado. As consultas meteorológicas exigem conectividade com o provedor configurado.');
}

main().catch((error) => {
  console.error('Não foi possível executar os testes. Confirme se a API está ativa na porta 3100.', error);
  process.exitCode = 1;
});
