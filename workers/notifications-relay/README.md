# Notifications Relay

Worker Cloudflare para:

- validar o `idToken` do Firebase recebido do app
- confirmar que o remetente e admin
- gravar o comunicado em `notificacoes`
- enviar push pelo OneSignal usando o e-mail do usuário como `external_id`
- usar FCM como fallback se OneSignal não estiver configurado
- gerar link mágico de login para usuários aprovados e enviar pelo EmailJS

## Segredos de Idiomas

Defina no Worker:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`
- `EMAILJS_PRIVATE_KEY` (opcional, recomendado se habilitado no EmailJS)

Use sempre o arquivo de config de Idiomas para evitar gravar secret no Worker errado.

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --config wrangler.idiomas.toml
wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY --config wrangler.idiomas.toml
wrangler secret put ONESIGNAL_APP_ID --config wrangler.idiomas.toml
wrangler secret put ONESIGNAL_REST_API_KEY --config wrangler.idiomas.toml
wrangler secret put EMAILJS_PRIVATE_KEY --config wrangler.idiomas.toml
```

Para conferir apenas quais secrets existem, sem exibir os valores:

```bash
wrangler secret list --config wrangler.idiomas.toml
```

O envio pelo OneSignal só fica ativo quando `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` existem no Worker. Se faltar algum deles, o relay usa o fallback FCM.

O login por link mágico usa este Worker quando `VITE_NOTIFICATIONS_RELAY_URL` está configurado no app. O Worker gera o link pelo Firebase/Identity Toolkit apenas para e-mails aprovados em `usuarios` e envia o template pelo EmailJS.

## Variaveis

Ja previstas no arquivo `wrangler.idiomas.toml`:

- `FIREBASE_PROJECT_ID`
- `PUBLIC_APP_URL`
- `EMAILJS_SERVICE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_TEMPLATE_ID`

## Deploy

1. `npm install`
2. Configure os secrets da instância
3. `wrangler deploy --config wrangler.idiomas.toml`
