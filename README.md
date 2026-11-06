# foreman-template-web-mobile

Template Foreman de produto **web + mobile**: um único app **Expo** (iOS, Android e Web) e uma API **Hono** no **Cloudflare Workers**, tudo em TypeScript, com tipos e schemas compartilhados.

- `apps/app`: Expo + Expo Router + NativeWind
- `apps/api`: Hono no Worker, Postgres (Neon) com Drizzle e login com Better Auth
- `packages/shared`: schemas zod e cliente tipado (Hono RPC)

Detalhes de stack, convenções e fluxo de trabalho: [CLAUDE.md](./CLAUDE.md).

## Requisitos

- Node 22 e pnpm (`corepack enable` usa a versão fixada em `package.json`)
- Para simuladores: Xcode (iOS, só macOS) ou Android Studio (emulador Android)
- Para celular: o app **Expo Go** (App Store / Google Play)

## Rodando

```sh
pnpm install
pnpm dev:api   # terminal 1: API em http://localhost:8787
pnpm dev:app   # terminal 2: Expo (Metro)
```

(`pnpm dev` sobe os dois juntos, mas sem os atalhos de teclado do Expo.)

No terminal do Expo:

- **Browser**: aperte `w` (abre http://localhost:8081).
- **Simulador iOS**: aperte `i` (macOS com Xcode).
- **Emulador Android**: aperte `a` (com um emulador do Android Studio aberto).
- **Celular (Expo Go)**: escaneie o QR code com a câmera (iOS) ou com o Expo Go (Android). O celular precisa estar na mesma rede Wi-Fi do computador.

O app abre na tela de **entrar**. Crie uma conta em **Cadastre-se** (e-mail e senha) e use a aba **Tarefas** (criar, concluir, apagar). Cada usuário só vê as próprias tarefas. A aba **Perfil** mostra o usuário e tem o botão **Sair**.

### Banco e login em desenvolvimento

Não precisa de conta nem de Docker: sem `DATABASE_URL`, o `pnpm dev:api` usa **PGlite** (Postgres em WASM) salvo em `apps/api/.data/pglite` e aplica as migrations ao subir. Para zerar, apague `apps/api/.data/`.

Para usar Neon (ou configurar login social), copie `apps/api/.dev.vars.example` para `apps/api/.dev.vars` e preencha:

- `DATABASE_URL`: connection string do Neon. Depois rode `pnpm db:migrate`.
- `BETTER_AUTH_SECRET`: obrigatório fora do dev local (`openssl rand -base64 32`).
- `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` e `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`: opcionais. Cada botão aparece no app só quando o par está definido. Callback: `<URL da API>/api/auth/callback/<github|google>`.
- `ENVIRONMENT=development`: liga os defaults locais (já vem no `.dev.vars.example`; o `pnpm dev:api` define sozinho). Em produção **não** defina: a API falha fechado e exige `TRUSTED_ORIGINS` e `BETTER_AUTH_URL` (sem eles responde 500 dizendo o que falta).
- `TRUSTED_ORIGINS`: origens aceitas pelo login. Em dev o padrão é `http://localhost:8081`, `foremanapp://` e `exp://`; em produção é obrigatório. Se abrir o app web por IP da rede (ex.: `http://192.168.0.10:8081`), adicione essa URL.

No web a sessão fica num cookie HTTP-only; no iOS/Android (inclusive Expo Go), no `expo-secure-store`.

### Banco: schema e migrations

```sh
pnpm db:generate   # gera a migration em apps/api/drizzle/ a partir de apps/api/src/db/schema.ts
pnpm db:migrate    # aplica no Neon (DATABASE_URL) ou no PGlite local
```

### URL da API

Por padrão, em desenvolvimento o app usa o mesmo host do Metro na porta 8787, então simulador, emulador e celular acham a API sozinhos. Para apontar para outra API, crie `apps/app/.env.local`:

```sh
EXPO_PUBLIC_API_URL=https://minha-api.exemplo.workers.dev
```

## Qualidade

```sh
pnpm check   # lint + typecheck + testes (o que o CI roda)
pnpm build   # bundle da API + export web do app
pnpm --filter @repo/app run doctor   # expo-doctor
```
