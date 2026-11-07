# CLAUDE.md

Guia para agents (e humanos) trabalhando neste repo. Leia antes de mudar código.

## Stack

- **Monorepo pnpm** (versão fixa em `packageManager`), Node 22, TypeScript strict em todos os pacotes.
- **`apps/app`**: um único app **Expo** (SDK 58) para iOS, Android e Web, com **Expo Router** (rotas por arquivo em `src/app/`) e **NativeWind** v4 (Tailwind v3 via `className`).
- **`apps/api`**: **Hono** rodando em **Cloudflare Workers** (`wrangler`). Todas as rotas ficam sob **`/api`**; publicado, o mesmo Worker serve o export web do app (`apps/app/dist`) como static assets em todo o resto, na mesma origem.
  - Banco: **Postgres** com **Drizzle**. Produção: **Neon** via HTTP (`@neondatabase/serverless`, driver `neon-http`). Local e testes: **PGlite** (Postgres em WASM, sem conta nem Docker).
  - Login: **Better Auth** em `/api/auth/*` (e-mail + senha; GitHub e Google opcionais via env) com o plugin **`@better-auth/expo`**.
- **`packages/shared`**: schemas **zod**, tipos e o cliente tipado da API via **Hono RPC** (`hc<AppType>`).
- Qualidade: **Biome** (lint + format), **Vitest** (api e shared), **jest-expo + Testing Library** (app), `expo export --platform web` no build e `expo-doctor` no CI.
- Login no app: `better-auth/react` + `expoClient` (sessão no `expo-secure-store` no iOS/Android, cookie HTTP-only no web).
- Deploy: **Cloudflare Workers + Neon** por `.github/workflows/deploy.yml` (branch `production` → produção, `staging` opcional → staging) e um preview por PR (`.github/workflows/preview.yml`: Worker e branch do Neon próprios, apagados quando o PR fecha). Veja "Deploy" abaixo e no README.

## Comandos (na raiz)

- `pnpm install`: instala tudo (workspaces).
- `pnpm dev`: sobe API (`:8787`) e Expo juntos. Para usar os atalhos do Expo (`i`, `a`, `w`), rode `pnpm dev:api` e `pnpm dev:app` em terminais separados.
- `pnpm dev:api`: a mesma app Hono do Worker, rodando em Node (`apps/api/scripts/dev.ts`). Sem `DATABASE_URL` usa PGlite em `apps/api/.data/pglite` (migrations aplicadas ao subir); com `DATABASE_URL` em `apps/api/.dev.vars` usa Neon. Para rodar como em produção, no runtime real do Workers com o app web junto (exige Neon): `pnpm --filter @repo/api dev:worker` (exporta o app web antes).
- `pnpm lint`: Biome (lint + formatação + imports), sem escrever.
- `pnpm format`: Biome com `--write` (corrige formatação e o que for seguro).
- `pnpm typecheck`: `tsc --noEmit` em todos os pacotes.
- `pnpm test`: Vitest (api, shared) e Jest (app).
- `pnpm build`: export web do app (`expo export --platform web`, em `apps/app/dist`, com `404.html`) e depois o bundle do Worker (`wrangler deploy --dry-run`), que inclui esse export como assets. Nessa ordem: o Worker exige o `dist/` do app.
- `pnpm check`: **lint + typecheck + test**. É o que agents e CI rodam. Tem que ficar verde.
- `pnpm --filter @repo/app run doctor`: `expo-doctor` (dependências e config do Expo). Use `run`, porque `pnpm doctor` é um comando do próprio pnpm.

- `pnpm db:generate`: gera a migration SQL em `apps/api/drizzle/` a partir de `apps/api/src/db/schema.ts` (não precisa de banco). Commite o resultado. Para nomear: `pnpm --filter @repo/api db:generate --name <nome>`.
- `pnpm db:migrate`: aplica as migrations no Neon se `DATABASE_URL` estiver definida (env ou `.dev.vars`), senão no PGlite local (pare o `pnpm dev:api` antes: um processo por vez). Para zerar o banco local: apague `apps/api/.data/`.

Comandos por pacote: `pnpm --filter @repo/api <script>`, `pnpm --filter @repo/app <script>`, `pnpm --filter @repo/shared <script>`.

## Estrutura

```
apps/
  api/                    Hono no Cloudflare Workers
    src/app.ts            createApp(): middlewares + todas as rotas encadeadas sob /api; fora de /api, entrega aos assets (app web); exporta AppType
    src/index.ts          entry do Worker (createApp() com Neon)
    src/routes/*.ts       uma sub-app Hono por recurso (health, health/db, tasks, auth-providers)
    src/auth.ts           Better Auth (createAuth por request, trusted origins, rate limit, OAuth)
    src/config.ts         ConfigError (vira 500 com mensagem) e isDevelopment(env)
    src/services.ts       db + auth do request, criados sob demanda (c.var.services)
    src/middleware/       requireUser: 401 sem sessão, expõe c.var.user
    src/db/schema.ts      schema Drizzle (tabelas do Better Auth + task)
    src/db/client.ts      tipo Database + Neon (HTTP)
    src/db/pglite.ts      PGlite + migrations (testes e dev local; nunca no Worker)
    src/test/helpers.ts   createTestApi(): app real + PGlite em memória + signUp()
    src/env.ts            tipo das bindings (vars, secrets) do Worker
    scripts/              Node: dev server, migrate (tsconfig próprio com tipos do Node)
    drizzle/              migrations geradas (commitadas; não edite à mão)
    wrangler.jsonc        config do Worker (assets = apps/app/dist, /api/* sempre no Worker; vars não secretas)
    .dev.vars.example     secrets locais (copie para .dev.vars)
  app/                    Expo (iOS, Android, Web)
    src/app/              rotas do Expo Router (cada arquivo é uma tela)
      _layout.tsx         layout raiz (tema + guarda de rotas com Stack.Protected)
      sign-in.tsx         entrar (só sem sessão)
      sign-up.tsx         cadastrar (só sem sessão)
      (tabs)/             tabs (só com sessão): index = Início, tasks, profile, about
    src/__tests__/        testes de tela e de navegação (fora de src/app, que só tem rotas)
    src/components/       componentes de UI
    src/hooks/            hooks (use-health, use-tasks, use-auth-providers)
    src/lib/api-url.ts    URL da API
    src/lib/api.ts        cliente tipado (com a sessão) + funções por rota
    src/lib/auth-client.ts  cliente do Better Auth (useSession, signIn, signOut...)
    src/test-utils/       mocks de teste (auth-mock: sessão fake; fetch-mock)
    jest/setup.ts         troca @/lib/auth-client pelo mock em todos os testes
packages/
  shared/
    src/schemas/*.ts      schemas zod + tipos inferidos (contrato entre API e app)
    src/client.ts         createApiClient() = hc<AppType>(url).api (api.health -> <url>/api/health)
.github/
  workflows/ci.yml        PRs e pushes em production/staging: check, build, expo-doctor
  workflows/deploy.yml    deploy por ambiente (production/staging): check, build, migrations, wrangler deploy, smoke test
  workflows/preview.yml   preview por PR (Worker <nome>-pr-<n> + branch preview/pr-<n> do Neon), apagado quando o PR fecha
  scripts/                usados pelo deploy e pelo preview (alvo, nome do Worker, banco/Neon, secrets do Worker, smoke test, teardown, comentário no PR)
foreman.json              template do Elfo: comandos, deploy e secrets do app (o deploy os põe no Worker)
```

## Convenções

- **TypeScript strict** em tudo; não use `any` (prefira `unknown` + validação).
- **Biome** manda no estilo: 2 espaços, aspas duplas, 100 colunas, imports organizados. Rode `pnpm format` antes de commitar.
- Nomes de arquivo em `kebab-case` (`health-card.tsx`, `use-health.ts`). Componentes em `PascalCase`.
- **Contrato da API mora em `packages/shared`**: todo request/response tem um schema zod lá. A API valida a entrada com ele e o app valida a resposta com ele.
- **Rotas da API são encadeadas** em `apps/api/src/app.ts` (`.route("/x", xRoutes)`, que vira `/api/x` pelo `basePath`): é isso que faz o `AppType` carregar os tipos para o cliente RPC. Rotas registradas fora da cadeia não aparecem no cliente. Não crie rota fora de `/api`: o resto da origem é o app web (`/tasks` é a tela, `/api/tasks` é a API). `/api/auth/*` é do Better Auth; uma rota nossa ali (como `/api/auth/providers`) precisa vir **antes** do catch-all dele na cadeia.
- **Nada de globais do Worker nos arquivos de rota/app da API** (`apps/api/src`): `packages/shared` e o app importam os tipos da API (só tipos) fora do ambiente do Worker. Declare bindings em `src/env.ts` com tipos explícitos.
- **App**: estilize com `className` (NativeWind). Telas só em `src/app/`; o resto (componentes, hooks, libs) fica fora de `src/app/`. Use o alias `@/` para importar de `src/`.
- **URL da API**: `EXPO_PUBLIC_API_URL`. Sem ela, em dev o app usa o host do Metro na porta 8787 (funciona em simulador, emulador e Expo Go na mesma rede). Variáveis `EXPO_PUBLIC_*` vão para o bundle e são públicas.
- **Dependências do app**: instale com `pnpm --filter @repo/app exec expo install <pacote>` (escolhe versões compatíveis com o SDK). Libs com código nativo fora do Expo Go exigem development build.
- **Expo muda a cada SDK**: antes de usar uma API do Expo/React Native, confira a doc da versão instalada (`https://docs.expo.dev/versions/v58.0.0/`) em vez de confiar na memória.
- Testing Library v14: `render`, `fireEvent`, `userEvent` e `renderRouter` são **async**; sempre use `await`.
- **Rotas autenticadas na API**: use `requireUser` (`.use(requireUser)` na sub-app) e filtre **toda** query por `c.var.user.id`; recurso de outro usuário responde 404, igual a um que não existe (veja `routes/tasks.ts`). Teste a autorização entre usuários com `createTestApi()`.
- **Banco**: tabelas em `apps/api/src/db/schema.ts`. As do Better Auth (`user`, `session`, `account`, `verification`, `rateLimit`) precisam manter os nomes das propriedades. O driver Neon HTTP (`neon-http`) não tem transações interativas (`db.transaction`); use `db.batch` se precisar.
- **Transações e Better Auth**: conferido na fonte do `@better-auth/drizzle-adapter` (1.7): só chama `db.transaction` se `transaction: true` (padrão `false`; os outros usos são só do provider MySQL). Por isso mantemos `neon-http` (um `fetch` por query, sem conexão para abrir/fechar a cada request no Worker) e deixamos `transaction: false` **explícito** em `auth.ts`. Custo: operações compostas (ex.: criar usuário + conta no OAuth) rodam em sequência, sem atomicidade. O teste `no database transactions` (`config.test.ts`) quebra se alguém ligar a opção ou usar `db.transaction`, o que o PGlite dos outros testes esconderia. Se um dia precisar de transação de verdade, troque para `drizzle-orm/neon-serverless` (Pool via WebSocket, criado e fechado por request) e ligue `transaction: true`.
- **Falhar fechado fora do dev**: `ENVIRONMENT=development` (só em `.dev.vars`; `pnpm dev:api` já define) liga os defaults locais: origens `localhost:8081`/`exp://`, CORS `*` e rate limit desligado. Sem ele (produção) só a própria origem da API e o scheme do app são confiáveis, o rate limit fica ligado e faltar `BETTER_AUTH_SECRET` ou `DATABASE_URL` responde 500 com a mensagem do que falta (`ConfigError` em `src/config.ts`; `/api/health` segue funcionando). Nunca ponha `ENVIRONMENT` no `wrangler.jsonc`. `CORS_ORIGINS` em produção é uma lista explícita (`*` é ignorado; não setado = sem acesso cross-origin), pois a API usa credenciais; o app web publicado roda na mesma origem da API, o que dispensa CORS.
- **URL pública da API** (`authBaseURL` em `auth.ts`): `BETTER_AUTH_URL` se definido, senão a origem do request, em qualquer ambiente. É seguro no Workers porque a Cloudflare só entrega ao Worker os hostnames ligados a ele (workers.dev, domínios próprios, routes); é o que faz o primeiro deploy funcionar no workers.dev e num domínio próprio sem configurar nada. Em outra hospedagem, defina `BETTER_AUTH_URL`.
- **Rate limit**: Better Auth com `storage: "database"` (tabela `rate_limit`, migration `0001`), ligado fora do dev (o padrão dele só liga com `NODE_ENV=production`, que o Worker não define). O IP vem de `cf-connecting-ip`. Senha: mínimo de `PASSWORD_MIN_LENGTH` (shared) também na API.
- **Sessão no app**: `authClient.useSession()` (de `@/lib/auth-client`). Chamadas à API passam pelo `api` de `@/lib/api`, que já manda a sessão (cookie no web, header `Cookie` no nativo). Telas protegidas ficam dentro de `(tabs)` (ou outro grupo sob `Stack.Protected guard={signedIn}` em `_layout.tsx`).
- **Origens confiáveis** (`trustedOrigins` em `auth.ts`): Better Auth só aceita requests de login (e redirects) vindas delas, e só as http(s) de `TRUSTED_ORIGINS` podem mandar cookie via CORS. Sempre: a própria origem da API (do request e do `baseURL`). Fora do dev: + `foremanapp://` (scheme do `app.json`) + `TRUSTED_ORIGINS` (extras). Em dev: + `TRUSTED_ORIGINS` ou, sem ela, `http://localhost:8081`, `foremanapp://` e `exp://` (Expo Go). **Nunca confie em `exp://` fora do dev**: depois de um login social o Better Auth manda a sessão para esse deep link, e `exp://<qualquer host>` não é do app. Abrindo o app web por IP da rede, adicione essa URL.
- Testes do app: `jest/setup.ts` troca `@/lib/auth-client` por `src/test-utils/auth-mock.ts` em todos os testes; controle a sessão com `setSession(fakeSession())` / `setSession(null)` e confira chamadas em `authClient.signIn.email` etc.
- Jest do app (`jest` em `apps/app/package.json`): `testTimeout` de 30s global, porque o primeiro teste de cada arquivo paga a transformação fria do React Native/Expo Router. Não ajuste timeout teste a teste. O cache de transformação fica em `apps/app/node_modules/.cache/jest` e o CI o restaura com `actions/cache`.

## Como adicionar uma feature de ponta a ponta

Exemplo: listar `todos`.

1. **Schema em shared**: crie `packages/shared/src/schemas/todo.ts` com os schemas zod (`todoSchema`, `createTodoSchema`, ...) e os tipos (`z.infer`). Exporte em `packages/shared/src/index.ts`. Teste em `todo.test.ts` (Vitest).
2. **Rota na API**: crie `apps/api/src/routes/todos.ts` com `new Hono<AppEnv>()` e os handlers. Valide entrada com o schema de shared (`@hono/zod-validator` ou `schema.parse`) e responda com `c.json(...)`. Encadeie em `apps/api/src/app.ts`: `.route("/todos", todoRoutes)`.
   Se o recurso é do usuário: tabela em `apps/api/src/db/schema.ts` com `userId`, `pnpm db:generate`, e `.use(requireUser)` na sub-app.
3. **Teste da API**: `apps/api/src/routes/todos.test.ts` com `createTestApi()` de `src/test/helpers.ts` (app real + PGlite em memória; `signUp()` devolve o cookie) ou `app.request(...)` para rotas sem banco. Inclua o caso "outro usuário não vê/altera".
4. **Tela no app**: chame a API com o cliente tipado (`api.todos.$get()` de `@/lib/api`) dentro de um hook em `src/hooks/`, valide a resposta com o schema de shared e crie a tela em `src/app/` (ex.: `src/app/(tabs)/todos.tsx` + `Tabs.Screen` em `(tabs)/_layout.tsx`).
5. **Testes do app**: teste a tela com Testing Library (mock de `fetch` com `src/test-utils/fetch-mock.ts`, como em `src/__tests__/tasks.test.tsx`) e, se mudou a navegação, `renderRouter` (`navigation.test.tsx`; lembre de `setSession(fakeSession())` para telas protegidas).
6. Rode `pnpm check` (e `pnpm build` se mexeu em config do Expo ou do Worker).

## Regras

- **Nunca commite secrets.** Locais ficam em `apps/api/.dev.vars` e `apps/app/.env.local` (ambos ignorados pelo git). Publicados, são secrets do repositório no GitHub: declare o secret novo em `foreman.json` (`secrets[]`) e passe-o pelo nome no passo "Worker secrets" do `deploy.yml` e do `preview.yml`; o deploy o põe no Worker. Nunca coloque secrets em `EXPO_PUBLIC_*` nem em `wrangler.jsonc`.
- **Migrations sempre geradas e commitadas** (`pnpm db:generate`). Não edite migrations já aplicadas.
- **Nunca importe `src/db/pglite.ts` (nem nada de Node) a partir de `src/index.ts`/`src/app.ts`**: entraria no bundle do Worker.
- **Mantenha `pnpm check` verde.** Não desligue regras do Biome, testes ou o strict do TypeScript para fazer passar.
- Não edite `ios/` e `android/` à mão (são gerados pelo Expo, e estão no `.gitignore`); configure via `app.json` e config plugins.
- Commite o `pnpm-lock.yaml` junto com mudanças de dependência (o CI usa `--frozen-lockfile`).

## Deploy

- Branches: **`production`** publica produção; **`staging`** (opcional) publica staging. Com `staging`, abra os PRs para `staging`; promover é um PR para `production`. Não existe `main`.
- `.github/workflows/deploy.yml`, a cada push nessas branches (ou `workflow_dispatch`, que o Elfo usa no primeiro deploy): `pnpm check`, `pnpm build`, migrations (`pnpm db:migrate` na conexão direta), `wrangler deploy --name <repo>[-staging]` com os secrets, smoke test em `/` e `/api/health/db`. GitHub environments `production`/`staging` com a URL publicada.
- Banco: produção usa os secrets `DATABASE_URL` (direta) e `DATABASE_URL_POOLED` (o Worker); staging usa a branch `staging` do Neon, criada pelo workflow a partir da branch padrão.
- **Preview por PR** (`.github/workflows/preview.yml`, PRs para `production`/`staging` do próprio repositório): a cada push, `pnpm build`, a branch `preview/pr-<n>` do Neon (criada no 1º preview como cópia de `staging`, ou da branch padrão sem staging; depois mantém os dados), migrations nela, `wrangler deploy --name <nome>-pr-<n>` (só workers.dev) com os mesmos secrets do app e smoke test. A URL vai num comentário do PR (atualizado no lugar), no environment `preview-pr-<n>` (que o Elfo lê para mostrar no card) e no resumo. Para testar o app iOS/Android contra o preview: `EXPO_PUBLIC_API_URL=<URL do preview>`. Ao fechar o PR, o job de teardown apaga esse Worker e essa branch (só esses nomes; nunca produção/staging/branch padrão ou protegida). Custo: um Worker + uma branch do Neon por PR aberto (limites de branches do plano do Neon valem). Sem os secrets da Cloudflare ou do Neon o preview é pulado, sem falhar, e o comentário do PR pede para conectar no Elfo (Board → Settings → Deploy). As migrations de um PR rodam só na branch dele, então um preview pode testar uma migration antes de staging/produção.
- **Migrations rodam antes da nova versão entrar no ar** e a versão anterior continua servindo até lá: toda migration precisa ser compatível com o código anterior (adicione antes, remova ou renomeie num PR seguinte).
- Secrets do Worker = os de `foreman.json` `secrets[]` que existirem no repositório + `DATABASE_URL`. Secret novo: declare em `foreman.json` e passe pelo nome no passo "Worker secrets" do `deploy.yml` e do `preview.yml` (nunca todos de uma vez: o GitHub segura o run em repositório público; nome só com letras, dígitos e `_`, sem começar com `GITHUB_`; nunca `CLOUDFLARE_*`, `NEON_*` ou `DATABASE_URL*`, que o Elfo grava sozinho).
