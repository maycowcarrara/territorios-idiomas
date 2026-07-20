# Notifications Relay

Worker Cloudflare para:

- validar o `idToken` do Firebase recebido do app
- confirmar que o remetente e admin
- gravar o comunicado em `notificacoes`
- enviar push pelo OneSignal usando o e-mail do usuário como `external_id`
- usar FCM como fallback se OneSignal não estiver configurado
- gerar link mágico do Firebase para o app enviar pelo EmailJS

## Segredos por instância

Defina no Worker:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`

Cada congregação tem um Worker separado. Use sempre o arquivo de config da instância para evitar gravar secret no Worker errado:

```bash
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --config wrangler.general.toml
wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY --config wrangler.general.toml
wrangler secret put ONESIGNAL_APP_ID --config wrangler.general.toml
wrangler secret put ONESIGNAL_REST_API_KEY --config wrangler.general.toml
```

Para conferir apenas quais secrets existem, sem exibir os valores:

```bash
wrangler secret list --config wrangler.general.toml
```

O envio pelo OneSignal só fica ativo quando `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` existem no Worker. Se faltar algum deles, o relay usa o fallback FCM.

O envio do link mágico agora funciona em duas etapas:

1. o Worker gera o `oobLink` com o Firebase e devolve o payload pronto
2. o app envia o e-mail pelo EmailJS usando o template configurado no dashboard

Para o EmailJS, o app precisa destas variáveis em `.env.palmas` ou `.env.general`:

- `VITE_EMAILJS_PUBLIC_KEY`
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`

O template do EmailJS deve aceitar pelo menos estes parâmetros:

- `to_email`
- `to_name`
- `app_name`
- `app_subtitle`
- `app_icon_url`
- `app_url`
- `subject`
- `intro_text`
- `button_label`
- `hint_text`
- `footer_text`
- `magic_link`

## Variaveis

Ja previstas em `wrangler.toml`:

- `FIREBASE_PROJECT_ID`
- `PUBLIC_APP_URL`
- `APP_DISPLAY_NAME`
- `APP_SUBTITLE`
- `APP_ICON_PATH`
- `MAGIC_LINK_EMAIL_SUBJECT`
- `MAGIC_LINK_EMAIL_INTRO`
- `MAGIC_LINK_EMAIL_BUTTON_LABEL`
- `MAGIC_LINK_EMAIL_HINT`
- `MAGIC_LINK_EMAIL_FOOTER`

## Deploy

1. `npm install`
2. Configure os secrets da instância
3. `wrangler deploy --config wrangler.general.toml`
