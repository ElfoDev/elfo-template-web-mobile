# foreman-template-web-mobile

Template Foreman de produto **web + mobile**: um único app **Expo** (iOS, Android e Web) e uma API **Hono** no **Cloudflare Workers**, tudo em TypeScript, com tipos e schemas compartilhados.

- `apps/app`: Expo + Expo Router + NativeWind
- `apps/api`: Hono no Worker
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

A tela inicial chama `GET /health` e mostra se a API está online.

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
