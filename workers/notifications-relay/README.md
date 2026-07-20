# Notifications Relay

Worker Cloudflare para:

- validar o `idToken` do Firebase recebido do app
- confirmar que o remetente e admin
- gravar o comunicado em `notificacoes`
- enviar push pelo OneSignal usando o e-mail do usuário como `external_id`
- usar FCM como fallback se OneSignal não estiver configurado

## Segredos por instância

Defina no Worker:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`

Cada congregação tem um Worker separado. Use sempre o arquivo de config da instância para evitar gravar secret no Worker errado.

Idiomas:

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --config wrangler.idiomas.toml
wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY --config wrangler.idiomas.toml
wrangler secret put ONESIGNAL_APP_ID --config wrangler.idiomas.toml
wrangler secret put ONESIGNAL_REST_API_KEY --config wrangler.idiomas.toml
```

General:

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --config wrangler.general.toml
wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY --config wrangler.general.toml
wrangler secret put ONESIGNAL_APP_ID --config wrangler.general.toml
wrangler secret put ONESIGNAL_REST_API_KEY --config wrangler.general.toml
```

Para conferir apenas quais secrets existem, sem exibir os valores:

```bash
wrangler secret list --config wrangler.idiomas.toml
```

O envio pelo OneSignal só fica ativo quando `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` existem no Worker. Se faltar algum deles, o relay usa o fallback FCM.

O login por link mágico não usa este Worker. O app envia o e-mail diretamente pelo Firebase Authentication.

## Variaveis

Ja previstas nos arquivos `wrangler.idiomas.toml` e `wrangler.general.toml`:

- `FIREBASE_PROJECT_ID`
- `PUBLIC_APP_URL`

## Deploy

1. `npm install`
2. Configure os secrets da instância
3. `wrangler deploy --config wrangler.idiomas.toml`
