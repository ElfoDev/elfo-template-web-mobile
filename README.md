# elfo-template-web-mobile

Template Elfo de produto **web + mobile**: um único app **Expo** (iOS, Android e Web) e uma API **Hono** no **Cloudflare Workers**, tudo em TypeScript, com tipos e schemas compartilhados.

- `apps/app`: Expo + Expo Router + NativeWind
- `apps/api`: Hono no Worker, Postgres (Neon) com Drizzle e login com Better Auth
- `packages/shared`: schemas zod e cliente tipado (Hono RPC)

Publicado, um único Worker serve o app web (export do Expo) na raiz e a API em `/api`, na mesma origem. Veja [Deploy](#deploy).

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
- `OAUTH_GITHUB_CLIENT_ID`/`OAUTH_GITHUB_CLIENT_SECRET` e `OAUTH_GOOGLE_CLIENT_ID`/`OAUTH_GOOGLE_CLIENT_SECRET`: opcionais. Cada botão aparece no app só quando o par está definido. Callback: `<URL da API>/api/auth/callback/<github|google>`.
- `ENVIRONMENT=development`: liga os defaults locais (já vem no `.dev.vars.example`; o `pnpm dev:api` define sozinho). Em produção **não** defina: lá só a própria origem da API e o scheme do app (`foremanapp://`) são confiáveis, o rate limit fica ligado e faltar `BETTER_AUTH_SECRET` ou `DATABASE_URL` responde 500 dizendo o que falta.
- `TRUSTED_ORIGINS`: origens aceitas pelo login além da própria API. Em dev o padrão é `http://localhost:8081`, `foremanapp://` e `exp://`. Se abrir o app web por IP da rede (ex.: `http://192.168.0.10:8081`), adicione essa URL.
- `BETTER_AUTH_URL`: opcional. Por padrão é a origem do request (em dev, `http://localhost:8787`; publicado, a URL do workers.dev ou o domínio próprio).

No web a sessão fica num cookie HTTP-only; no iOS/Android (inclusive Expo Go), no `expo-secure-store`.

### Banco: schema e migrations

```sh
pnpm db:generate   # gera a migration em apps/api/drizzle/ a partir de apps/api/src/db/schema.ts
pnpm db:migrate    # aplica no Neon (DATABASE_URL) ou no PGlite local
```

### URL da API

As rotas da API ficam em `/api` (`/api/health`, `/api/tasks`, `/api/auth/*`); a URL da API é só a origem, sem `/api`.

- **Em desenvolvimento** o app usa o mesmo host do Metro na porta 8787, então simulador, emulador e celular acham a API sozinhos.
- **No app web publicado** a API é a própria origem da página (o mesmo Worker serve os dois), em produção, staging ou domínio próprio, sem configurar nada.
- **Para apontar para outra API** (ex.: o app iOS/Android contra a API publicada), crie `apps/app/.env.local`:

```sh
EXPO_PUBLIC_API_URL=https://meu-app.minha-conta.workers.dev
```

## Qualidade

```sh
pnpm check   # lint + typecheck + testes (o que o CI roda)
pnpm build   # export web do app + bundle do Worker (que serve o export)
pnpm --filter @repo/app run doctor   # expo-doctor
```

O CI (`.github/workflows/ci.yml`) roda isso em todo PR e em todo push para `production` e `staging`.

## Deploy

Cloudflare Workers + Neon Postgres, por `.github/workflows/deploy.yml`.

**No Elfo**: no board deste repositório, abra **Settings → Deploy** e conecte a **Cloudflare** e o **Neon**. O Elfo grava os secrets no GitHub e dispara o primeiro deploy sozinho. Depois, todo merge publica.

| Branch               | Ambiente (GitHub) | Worker           | Banco (Neon)             |
| -------------------- | ----------------- | ---------------- | ------------------------ |
| `production`         | `production`      | `<repo>`         | branch padrão do projeto |
| `staging` (opcional) | `staging`         | `<repo>-staging` | branch `staging`         |
| PR aberto (preview)  | `preview-pr-<n>`  | `<repo>-pr-<n>`  | branch `preview/pr-<n>`  |

- **Staging é opcional.** Sem a branch `staging` nada publica lá. Com ela (o Elfo cria quando você marca _Staging_), os PRs vão para `staging`, cada push publica o Worker de staging, e promover para produção é um PR para `production`. No primeiro deploy de staging o workflow cria a branch `staging` no Neon a partir da branch padrão: ela começa como uma cópia do banco de produção daquele momento.
- **Um Worker por ambiente** serve o app web na raiz e a API em `/api`: `https://<repo>.<sua-conta>.workers.dev`. O login funciona de cara: a API usa a origem do próprio request como URL pública e origem confiável (a Cloudflare só entrega a este Worker os hostnames ligados a ele), e confia também no scheme do app (`foremanapp://`). `BETTER_AUTH_URL` e `TRUSTED_ORIGINS` são opcionais (veja `apps/api/wrangler.jsonc`).
- **Cada deploy**: `pnpm check`, `pnpm build`, migrations no banco do ambiente (antes da nova versão entrar no ar, por isso precisam ser compatíveis com a versão anterior), `wrangler deploy` com os secrets do app e um smoke test (`/` e `/api/health/db` respondendo 200). A URL aparece no resumo do run e no environment do GitHub.
- **Secrets** (o Elfo grava): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL` (direta, para migrations), `DATABASE_URL_POOLED` (o Worker usa), `NEON_API_KEY` e `NEON_PROJECT_ID` (staging e previews), e os do app listados em `foreman.json` (`BETTER_AUTH_SECRET`, OAuth opcionais). Para um secret novo no Worker, declare-o em `foreman.json` e passe-o pelo nome no passo "Worker secrets" de `.github/workflows/deploy.yml` e de `.github/workflows/preview.yml` (nunca todos os secrets de uma vez: o GitHub segura esse deploy em repositórios públicos).
- **Nome do Worker**: o do repositório. Para outro, crie a variável `CLOUDFLARE_WORKER_NAME` (Settings → Secrets and variables → Actions → Variables); staging vira `<nome>-staging` e o preview de um PR, `<nome>-pr-<n>`.

### Preview por PR

Todo PR para `production` ou `staging` ganha um ambiente só dele, publicado a cada push por `.github/workflows/preview.yml`:

- **Worker `<repo>-pr-<n>`** com o código do PR, servindo o app web e a API como em produção, em `https://<repo>-pr-<n>.<sua-conta>.workers.dev` (só workers.dev, sem domínio próprio).
- **Banco próprio**: a branch `preview/pr-<n>` do Neon, criada no primeiro preview do PR como cópia da branch `staging` (se existir) ou da branch padrão (produção). Os pushes seguintes mantêm os dados dela e só aplicam as migrations novas. Nada do que se faz no preview chega a staging ou produção.
- **A URL** fica num comentário do PR (o mesmo comentário, atualizado a cada push), no resumo do run, no environment `preview-pr-<n>` do GitHub e **no card do Elfo**.
- **App iOS/Android contra o preview**: aponte o app para a URL do preview com `EXPO_PUBLIC_API_URL=<URL do preview>` em `apps/app/.env.local` e teste num development build ([veja abaixo](#app-iosandroid-contra-a-api-publicada)).
- **Ao fechar o PR** (com ou sem merge) o workflow apaga o Worker e a branch do Neon do preview. Só esses nomes exatos: nunca o Worker de produção ou de staging, nem as branches padrão, protegidas, `production` ou `staging` do Neon.
- **Custo**: um Worker e uma branch do Neon (com o seu compute, que hiberna quando ninguém usa) para cada PR aberto, apagados quando o PR fecha. O plano do Neon limita quantas branches o projeto pode ter (o gratuito permite poucas) e conta as horas de compute de todas elas; a conta da Cloudflare também tem um limite de Workers. No limite, o preview falha dizendo o motivo: feche PRs antigos ou apague branches que sobraram.
- **Precisa** dos secrets da Cloudflare e do Neon (`NEON_API_KEY`, `NEON_PROJECT_ID`), que o Elfo grava em **Settings → Deploy**. Sem eles o preview é pulado (o run passa) e o comentário do PR diz o que conectar. PRs de forks e do Dependabot não têm preview (não recebem secrets).
- O preview não roda `pnpm check` (o CI do PR já roda): build, banco, migrations, `wrangler deploy` e o mesmo smoke test do deploy. Login com GitHub/Google não funciona no preview (os callbacks do OAuth são cadastrados para a URL de produção); e-mail e senha funcionam.

### Domínio próprio

O domínio precisa estar como zona na mesma conta da Cloudflare, e o token precisa de acesso a ela. Crie a variável do repositório e rode o deploy de novo:

```sh
gh variable set CUSTOM_DOMAIN --body app.exemplo.com.br           # produção
gh variable set STAGING_CUSTOM_DOMAIN --body staging.exemplo.com.br   # staging (opcional)
```

O deploy liga o domínio ao Worker (e substitui um registro DNS que já exista para esse nome). O workers.dev continua funcionando. O login segue o domínio em que a pessoa está; com GitHub/Google, cadastre o callback do domínio novo (`https://app.exemplo.com.br/api/auth/callback/github`).

### App iOS/Android contra a API publicada

Builds nativos (EAS) ficam fora deste template. Para usar a API publicada no simulador, emulador ou celular:

1. Em `apps/app/.env.local`: `EXPO_PUBLIC_API_URL=https://<repo>.<sua-conta>.workers.dev` (a URL do resumo do deploy; para testar um PR, a URL do preview dele).
2. Use um **development build** (`pnpm --filter @repo/app exec expo run:ios` / `run:android`, ou um build de desenvolvimento do EAS): ele faz login pelo scheme do app (`foremanapp://`), que a API publicada aceita. O **Expo Go** (`exp://`) só faz login na API local: fora do dev a API não confia em `exp://`, porque depois de um login social o Better Auth manda a sessão para esse link, e `exp://<qualquer host>` não é do app.
3. Num build da loja, defina `EXPO_PUBLIC_API_URL` nas variáveis do EAS.

### Rodando como em produção

```sh
pnpm --filter @repo/api dev:worker   # exporta o app web e sobe Worker + app em http://localhost:8787 (exige Neon em .dev.vars)
```
