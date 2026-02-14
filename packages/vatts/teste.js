const https = require('https');

// --- CONFIGURAÇÃO ---
// Coloque aqui a porta HTTPS TCP onde seu servidor Vatts está rodando.
// NÃO coloque a porta UDP (8443), coloque a porta principal (ex: 443, 3000, 8080).
const PORT = 443;
const HOST = 'localhost';

const MAX_BODY_CHARS = 8000;

const options = {
    hostname: HOST,
    port: PORT,
    path: '/',
    method: 'GET',
    // Importante: Permite testar com certificados self-signed sem crashar
    rejectUnauthorized: false,
    headers: {
        'User-Agent': 'Vatts-Tester/1.0'
    }
};

console.log(`\n🔍 Iniciando teste de conexão em https://${HOST}:${PORT}...`);

const req = https.request(options, (res) => {
    // enviar body

    const chunks = [];
    res.setEncoding('utf8');

    res.on('data', (chunk) => {
        chunks.push(chunk);
    });

    res.on('end', () => {
        const body = chunks.join('');
        const preview = body.length > MAX_BODY_CHARS
            ? `${body.slice(0, MAX_BODY_CHARS)}\n... (truncado, ${body.length} chars)`
            : body;

        console.log('\n--- BODY ---');
        console.log(preview);
        console.log('------------');
    });

    console.log(`\n📡 Status Code: ${res.statusCode}`);
    console.log('---------------------------------------------------');
    console.log('RECEIVING HEADERS:');
    console.log('---------------------------------------------------');

    // Imprime todos os headers recebidos
    Object.keys(res.headers).forEach(key => {
        console.log(`${key}: ${res.headers[key]}`);
    });

    console.log('---------------------------------------------------');

    const altSvc = res.headers['alt-svc'];

    if (altSvc) {
        console.log(`\n✅ SUCESSO! Header encontrado!`);
        console.log(`Valor: \x1b[32m${altSvc}\x1b[0m`); // Verde
    } else {
        console.log(`\n❌ FALHA: Header 'alt-svc' NÃO está presente na resposta.`);
        console.log(`Verifique se a porta TCP (${PORT}) está correta e se o servidor subiu sem erros.`);
    }
});

req.on('error', (e) => {
    console.error(`\n🔥 Erro na conexão: ${e.message}`);
    console.log('Dica: Verifique se o servidor está rodando e se a porta está correta.');
});

req.end();