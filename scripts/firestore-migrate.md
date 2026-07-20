# Migracao do Firestore para outro projeto Firebase

Este projeto tem um script para copiar os dados do Firestore atual para um novo projeto Firebase, mesmo que ele esteja em outra conta Google.

## 1. Preparar o projeto novo

No Firebase da nova conta:

- crie o projeto novo
- ative Authentication com login Google
- crie o Cloud Firestore
- cadastre o app Web e copie as configs para `.env.local`
- se for usar Android, baixe um novo `android/app/google-services.json`

Exemplo de `.env.local`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GOOGLE_WEB_CLIENT_ID=...
VITE_NOTIFICATIONS_RELAY_URL=...
```

## 2. Baixar as service accounts

Baixe um JSON de service account do projeto antigo e outro do projeto novo:

Firebase Console > Configuracoes do projeto > Contas de servico > Gerar nova chave privada.

Salve os arquivos localmente, por exemplo:

```text
service-account-old.json
service-account-new.json
```

Esses arquivos estao no `.gitignore` e nao devem ser enviados para o repo.

## 3. Exportar o Firestore atual

```bash
npm run firestore:export -- --service-account ./service-account-old.json --out ./firestore-backups/firestore-export.json
```

Para exportar apenas algumas colecoes:

```bash
npm run firestore:export -- --service-account ./service-account-old.json --out ./firestore-backups/firestore-export.json --collections usuarios,territorios,territorios_contexto,configuracoes,campanhas,notificacoes
```

## 4. Testar importacao no projeto novo

```bash
npm run firestore:import -- --service-account ./service-account-new.json --in ./firestore-backups/firestore-export.json --dry-run
```

## 5. Importar de verdade

```bash
npm run firestore:import -- --service-account ./service-account-new.json --in ./firestore-backups/firestore-export.json
```

Use `--merge` se quiser preservar campos que ja existam no projeto novo:

```bash
npm run firestore:import -- --service-account ./service-account-new.json --in ./firestore-backups/firestore-export.json --merge
```

## 6. Publicar regras e app

Depois da importacao, publique as regras e o hosting no projeto novo:

```bash
firebase use novo-project-id
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```

Observacao: este script migra o Firestore. Usuarios do Firebase Auth nao sao copiados, mas como o app usa o e-mail como documento em `usuarios`, as permissoes continuam quando cada pessoa entrar novamente com Google no projeto novo.
