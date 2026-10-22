import { ValidacaoDesignacaoError } from "../../../shared/designacoes.js";
import { verifyFirebaseIdToken } from "../../notifications-relay/src/index.js";
import { createStore } from "./store.js";
import { createService, ServiceError } from "./service.js";
import { hashToken } from "./crypto.js";

async function adminEmail(token, env) {
  try {
    if (env.LOCAL_EMULATORS === "true") {
      if (
        !env.FIREBASE_PROJECT_ID?.startsWith("demo-") ||
        !/^127\.0\.0\.1:\d+$/.test(env.FIREBASE_AUTH_EMULATOR_HOST || "")
      )
        throw new Error();
      const response = await fetch(
        `http://${env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.users?.[0]?.email) throw new Error();
      return data.users[0].email.toLowerCase();
    }
    const user = await verifyFirebaseIdToken(token, env);
    if (!user.email || !user.emailVerified) throw new Error();
    return user.email.toLowerCase();
  } catch {
    throw new ServiceError(
      "Entre novamente com uma conta administrativa.",
      401,
    );
  }
}

export function createHandler({ storeFactory = createStore, clock } = {}) {
  return {
    async fetch(request, env) {
      const origin = request.headers.get("Origin");
      const allowed = (env.ALLOWED_ORIGINS || "").split(",").includes(origin);
      const headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
        Vary: "Origin",
        ...(allowed
          ? {
              "Access-Control-Allow-Origin": origin,
              "Access-Control-Allow-Headers": "Authorization, Content-Type",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
            }
          : {}),
      };
      const reply = (data, code = 200) =>
        new Response(JSON.stringify(data), { status: code, headers });
      try {
        if (origin && !allowed)
          throw new ServiceError("Origem não permitida.", 403);
        if (request.method === "OPTIONS")
          return new Response(null, { status: 204, headers });
        if (request.method !== "POST")
          return reply({ error: "Use o acesso recebido do responsável." }, 405);
        if (env.ENABLED !== "true")
          throw new ServiceError("Serviço ainda não ativado.", 503);
        const token = request.headers
          .get("Authorization")
          ?.match(/^Bearer (.+)$/)?.[1];
        const path = new URL(request.url).pathname;
        const cardEntry = ["/public/cartao", "/public/acessar-cartao"].includes(path);
        if ((!token && !cardEntry) || token?.length > 8192)
          throw new ServiceError("Acesso inválido.", 401);
        // Fail closed if production abuse protection was not provisioned.
        if (
          env.LOCAL_EMULATORS !== "true" &&
          (!env.REQUEST_LIMITER || !env.WRITE_LIMITER)
        )
          throw new ServiceError("Proteção do serviço não configurada.", 503);
        if (
          env.REQUEST_LIMITER &&
          !(
            await env.REQUEST_LIMITER.limit({
              key: request.headers.get("CF-Connecting-IP") || "unknown",
            })
          ).success
        )
          throw new ServiceError("Muitas tentativas. Aguarde um minuto.", 429);
        const isReadRoute =
          path === "/public/territorio" ||
          path === "/admin/contatos/listar" ||
          path === "/admin/designacoes/listar" ||
          path === "/admin/operacao" ||
          path === "/admin/prazo/previa";
        if (
          !cardEntry && !isReadRoute &&
          env.WRITE_LIMITER &&
          !(await env.WRITE_LIMITER.limit({ key: await hashToken(token) }))
            .success
        )
          throw new ServiceError(
            "Aguarde um momento antes de salvar novamente.",
            429,
          );
        const maxBody = path.startsWith("/admin/") ? 1048576 : 32768;
        let text = "";
        const reader = request.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let size = 0;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > maxBody) {
              await reader.cancel();
              throw new ServiceError("Solicitação muito grande.", 413);
            }
            text += decoder.decode(value, { stream: true });
          }
          text += decoder.decode();
        }
        let body;
        try {
          body = JSON.parse(text || "{}");
        } catch {
          throw new ServiceError("Solicitação inválida.");
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new ServiceError("Solicitação inválida.");
        if (path === "/public/acessar-cartao") {
          if (env.LOCAL_EMULATORS !== "true" && (!env.PIN_IP_LIMITER || !env.PIN_CARD_IP_LIMITER || !env.PIN_CARD_LIMITER))
            throw new ServiceError("Proteção dos códigos não configurada.", 503);
          // Approximate per-location bindings, never claim a strict global ceiling.
          // Keys exclude submitted PIN so changing guesses cannot reset the counter.
          const ip = request.headers.get("CF-Connecting-IP") || "unknown";
          for (const [binding, key] of [[env.PIN_IP_LIMITER, `pin:${ip}`], [env.PIN_CARD_LIMITER, await hashToken(`card:${String(body.cartaoId || "").slice(0,128)}`)], [env.PIN_CARD_IP_LIMITER, await hashToken(`${ip}:${String(body.cartaoId || "").slice(0,128)}`)]]) {
            if (binding && !(await binding.limit({ key })).success) throw new ServiceError("Muitas tentativas. Aguarde um minuto.", 429);
          }
        }
        const agora = clock ? clock() : new Date();
        const store = storeFactory(env);
        const service = createService(store, env, clock);
        if (cardEntry) return reply(await service.cardAction(path.slice(8), body));
        const publicMatch = path.match(
          /^\/public\/(territorio|endereco|marcacoes|devolver|concluir)$/,
        );
        if (publicMatch)
          return reply(await service.publicAction(publicMatch[1], token, body));
        if (!path.startsWith("/admin/"))
          throw new ServiceError("Ação não encontrada.", 404);
        const autor = await adminEmail(token, env);
        if (
          path === "/admin/contatos/listar" ||
          path === "/admin/designacoes/listar"
        ) {
          await service.adminAction("autorizar", null, {}, autor);
          if (path.includes("contatos")) {
            const [contatos, designacoesAtivas] = await Promise.all([
              store.list("contatos_publicadores"),
              store.list("designacoes_links", [
                ["operacionalAtiva", "EQUAL", true],
              ]),
            ]);
            return reply(
              contatos
                .map((c) => {
                  const ativas = designacoesAtivas.filter(
                    (d) => d.contatoId === c.id && d.operacionalAtiva,
                  );
                  return {
                    ...c,
                    carga: ativas.length,
                    maisAntiga: ativas.length
                      ? ativas
                          .map((d) => d.criadoEm)
                          .sort((a, b) => +new Date(a) - +new Date(b))[0]
                      : null,
                  };
                })
                .sort((a, b) =>
                  String(a.nome || "").localeCompare(
                    String(b.nome || ""),
                    "pt-BR",
                  ),
                ),
            );
          }
          const designacoes = await store.list("designacoes_links");
          return reply(
            designacoes
              .slice()
              .sort((a, b) => {
                const aAtiva = a.operacionalAtiva ? 1 : 0;
                const bAtiva = b.operacionalAtiva ? 1 : 0;
                if (aAtiva !== bAtiva) return bAtiva - aAtiva;
                return +new Date(b.criadoEm || 0) - +new Date(a.criadoEm || 0);
              })
              .map((d) => ({
                id: d.id,
                grupoId: d.grupoId,
                codigo: d.codigo,
                nome: d.nome,
                responsavelNome: d.responsavelNome,
                criadoEm: d.criadoEm,
                expiraEm: d.expiraEm,
                status: d.status,
                motivo: d.motivo,
                comprovante: d.comprovante,
                feitos: d.feitos.length,
                total: d.enderecos.length,
              })),
          );
        }
        if (path === "/admin/reconciliar") {
          await service.adminAction("autorizar", null, {}, autor);
          return reply(await service.expirar());
        }
        if (path === "/admin/contatos") {
          const contato = await service.adminAction(
            "contato",
            null,
            body,
            autor,
          );
          if (!contato.ativo && body.revogarAcessos === true) {
            const ativas = (
              await store.list("designacoes_links", [
                ["operacionalAtiva", "EQUAL", true],
              ])
            ).filter(
              (d) =>
                d.contatoId === contato.id &&
                d.operacionalAtiva &&
                new Date(d.expiraEm) > agora,
            );
            for (const d of ativas)
              await service.adminAction("revogar", d.id, {}, autor);
          }
          return reply(contato);
        }
        if (path === "/admin/configuracao")
          return reply(
            await service.adminAction(
              body.salvar ? "configurar" : "configuracao",
              null,
              body,
              autor,
            ),
          );
        if (path === "/admin/operacao")
          return reply(await service.adminAction("operacao", null, {}, autor));
        if (path === "/admin/prazo/previa") {
          const config = await service.adminAction(
            "configuracao",
            null,
            {},
            autor,
          );
          const ativas = (
            await store.list("designacoes_links", [
              ["operacionalAtiva", "EQUAL", true],
            ])
          ).filter((d) => d.operacionalAtiva && new Date(d.expiraEm) > agora);
          return reply({
            politicaVersao: config.versao,
            dias: config.prazoDevolucaoAutomaticaDias,
            designacoes: ativas.map((d) => ({
              id: d.id,
              codigo: d.codigo,
              expiraEmAnterior: d.expiraEm,
              expiraEm: new Date(
                +new Date(d.criadoEm) +
                  config.prazoDevolucaoAutomaticaDias * 86400000,
              ),
            })),
          });
        }
        if (path === "/admin/prazo/aplicar") {
          if (
            !Array.isArray(body.designacoes) ||
            body.designacoes.length > 10000 ||
            body.confirmar !== true
          )
            throw new ServiceError("Revise e confirme a prévia.");
          const resultados = [];
          for (const item of body.designacoes) {
            try {
              await service.adminAction(
                "aplicar_prazo",
                item.id,
                {
                  confirmar: true,
                  politicaVersao: body.politicaVersao,
                  expiraEmAnterior: item.expiraEmAnterior,
                },
                autor,
              );
              resultados.push({ id: item.id, ok: true });
            } catch (error) {
              resultados.push({
                id: item.id,
                ok: false,
                erro:
                  error instanceof ServiceError
                    ? error.message
                    : "Não foi possível alterar este prazo.",
              });
            }
          }
          return reply({ resultados });
        }
        if (path === "/admin/cartao") return reply(await service.adminAction("cartao", null, body, autor));
        if (path === "/admin/designacoes")
          return reply(await service.adminAction("criar", null, body, autor));
        const match = path.match(
          /^\/admin\/designacoes\/([\w-]+)\/(compartilhar|renovar|prorrogar|revogar|devolver|corrigir|reabrir)$/,
        );
        if (!match) throw new ServiceError("Ação não encontrada.", 404);
        return reply(
          await service.adminAction(match[2], match[1], body, autor),
        );
      } catch (error) {
        return reply(
          {
            error:
              error instanceof ServiceError ||
              error instanceof ValidacaoDesignacaoError ||
              error.message?.startsWith("Informe") ||
              error.message?.startsWith("Escolha")
                ? error.message
                : "Não foi possível salvar. Tente novamente ou avise o responsável.",
          },
          error.code || 500,
        );
      }
    },
    async scheduled(_event, env, ctx) {
      if (env.ENABLED !== "true") return;
      ctx.waitUntil(createService(storeFactory(env), env, clock).expirar());
    },
  };
}
export default createHandler();
