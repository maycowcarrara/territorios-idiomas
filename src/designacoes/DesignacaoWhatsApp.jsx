import React, { useCallback, useEffect, useRef, useState } from "react";
import { designacoesHabilitadas } from "../designacoesApi";
import { adminDesignacoesRequest } from "../designacoesAdminApi";
import { buildWhatsAppShareUrl } from "../shareLinks";
import { normalizarTelefone, contatoCorrespondeBusca } from "../../shared/designacoes";

const button =
  "min-h-11 rounded-lg border px-3 py-2 font-bold disabled:opacity-50";

export function DesignacaoWhatsApp({ grupo, compact = false }) {
  const [aberto, setAberto] = useState(compact);
  const [contatos, setContatos] = useState([]);
  const [busca, setBusca] = useState("");
  const [contatoId, setContatoId] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [reiniciar, setReiniciar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [share, setShare] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [dias, setDias] = useState(30);
  const requestId = useRef(crypto.randomUUID());

  async function acao(fn) {
    setBusy(true);
    setErro("");
    setAviso("");
    try {
      await fn();
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  }

  const carregarContatos = useCallback(async () => {
    try {
      const lista = await adminDesignacoesRequest("/admin/contatos/listar");
      setContatos(Array.isArray(lista) ? lista : []);
    } catch {
      // Ignora erro de listagem inicial
    }
  }, []);

  useEffect(() => {
    if (compact && !grupo.designacaoTipo) {
      void carregarContatos();
    }
  }, [compact, grupo.designacaoTipo, carregarContatos]);

  if (!designacoesHabilitadas) return null;
  const ativa = grupo.designacaoTipo === "link";
  const statusGrupo = grupo.status || "ativo";
  if (grupo.sintetico || (!ativa && statusGrupo !== "ativo")) return null;

  const renderAcoesAtiva = () => (
    <div className="space-y-2">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs">
        <span className="block text-[10px] font-black uppercase text-emerald-700">
          Com responsável (WhatsApp)
        </span>
        <span className="block truncate text-sm font-black text-emerald-950">
          {grupo.designadoNome}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
          onClick={() =>
            void acao(async () => {
              const res = await adminDesignacoesRequest(
                `/admin/designacoes/${grupo.designacaoId}/compartilhar`,
              );
              setShare(res);
              if (res?.telefoneE164 && res?.partes?.[0]) {
                const url = buildWhatsAppShareUrl(res.partes[0], res.telefoneE164);
                window.open(url, "_blank");
              }
            })
          }
        >
          💬 Compartilhar
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          onClick={() => setConfirmacao("renovar")}
        >
          🔄 Renovar link
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          onClick={() => setConfirmacao("prorrogar")}
        >
          ⏱️ Prorrogar
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
          onClick={() => setConfirmacao("devolver")}
        >
          ↩️ Devolver
        </button>
      </div>

      <button
        type="button"
        className="w-full pt-0.5 text-center text-[10px] font-semibold text-slate-400 transition hover:text-red-600"
        onClick={() => setConfirmacao("revogar")}
      >
        Bloquear acesso ao link atual
      </button>

      {confirmacao && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
          <p className="font-semibold leading-tight text-slate-700">
            {confirmacao === "revogar"
              ? "O acesso será bloqueado imediatamente. O território continuará atribuído até ser devolvido."
              : confirmacao === "renovar"
                ? "O acesso e a mensagem anteriores deixarão de funcionar. Um novo acesso será gerado. Envie a nova mensagem ao responsável."
                : confirmacao === "devolver"
                  ? "O território ficará disponível imediatamente."
                  : "Acrescentar dias ao prazo desta designação:"}
          </p>
          {confirmacao === "prorrogar" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Dias:</label>
              <input
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold outline-none"
                type="number"
                min="1"
                max="365"
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
              />
            </div>
          )}
          <div className="flex gap-1.5 pt-1">
            <button
              type="button"
              className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
              onClick={() =>
                void acao(async () => {
                  const acaoAtual = confirmacao;
                  const res = await adminDesignacoesRequest(
                    `/admin/designacoes/${grupo.designacaoId}/${acaoAtual}`,
                    { dias },
                  );
                  setConfirmacao(null);
                  if (acaoAtual === "renovar") {
                    const novoShare = await adminDesignacoesRequest(
                      `/admin/designacoes/${grupo.designacaoId}/compartilhar`,
                    );
                    setShare(novoShare);
                    setAviso("Novo link gerado. Envie a mensagem atualizada no WhatsApp.");
                    if (novoShare?.telefoneE164 && novoShare?.partes?.[0]) {
                      window.open(buildWhatsAppShareUrl(novoShare.partes[0], novoShare.telefoneE164), "_blank");
                    }
                  } else {
                    setShare(null);
                    if (acaoAtual === "prorrogar" && res?.expiraEm) {
                      setAviso(`Prazo prorrogado até ${new Date(res.expiraEm).toLocaleDateString("pt-BR")}.`);
                    } else if (acaoAtual === "revogar") {
                      setAviso("Link bloqueado.");
                    } else if (acaoAtual === "devolver") {
                      setAviso("Território devolvido.");
                    }
                  }
                })
              }
            >
              Confirmar
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-slate-200 bg-slate-100 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
              onClick={() => setConfirmacao(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderFormNovaDesignacao = () => {
    const contatosAtivos = contatos.filter((c) => c.ativo !== false);
    const encontrados = contatosAtivos.filter(c => contatoCorrespondeBusca(c,busca));
    const hasContatos = contatosAtivos.length > 0;
    const isNovoContato = !hasContatos || contatoId === "__novo__";
    const contatoSelecionado =
      !isNovoContato && contatoId
        ? contatosAtivos.find((c) => c.id === contatoId)
        : null;

    let novoValido = false;
    try { novoValido = nome.trim().length >= 2 && Boolean(normalizarTelefone(telefone)); } catch { /* incomplete input */ }

    const podeEnviar = isNovoContato ? novoValido : Boolean(contatoSelecionado);

    let labelBotao = "Confirmar e Enviar no WhatsApp";
    if (busy) {
      labelBotao = "Salvando...";
    } else if (contatoSelecionado) {
      labelBotao = `💬 Enviar para ${contatoSelecionado.nome}`;
    } else if (isNovoContato) {
      if (!nome.trim() && !telefone.trim()) {
        labelBotao = "Preencha nome e celular";
      } else if (!nome.trim()) {
        labelBotao = "Informe o nome";
      } else if (!novoValido) {
        labelBotao = "Celular incompleto";
      } else {
        labelBotao = "Confirmar e Enviar no WhatsApp";
      }
    } else {
      labelBotao = "Selecione um publicador";
    }

    return (
      <div className="space-y-2">
        {hasContatos && <label className="block text-xs">Buscar contato por nome ou WhatsApp
          <input type="search" className="w-full rounded border p-2" value={busca} onChange={e => setBusca(e.target.value)} />
        </label>}
        {hasContatos ? (
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold outline-none focus:border-emerald-500 disabled:bg-slate-100"
            value={contatoId}
            onChange={(e) => setContatoId(e.target.value)}
          >
            <option value="">Escolher contato WhatsApp...</option>
            {contatosAtivos.filter(c => encontrados.includes(c) || c.id === contatoId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.telefoneE164}) {c.carga ? `· ${c.carga} terr.` : ""}
              </option>
            ))}
            <option value="__novo__">+ Novo contato sem conta...</option>
          </select>
        ) : (
          <div className="text-[11px] font-bold text-slate-500">
            Cadastrar publicador para WhatsApp:
          </div>
        )}

        {isNovoContato && (
          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
            <input
              type="text"
              className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
              placeholder="Nome do publicador"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <label className="block text-xs">WhatsApp completo (DDI, DDD e número)
              <input type="tel" autoComplete="tel" className="w-full rounded-lg border p-2" placeholder="+55 (47) 99999-1234" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </label>
            <p className="text-xs">Cole o número completo com DDI e DDD. Aceitamos celular brasileiro com ou sem o 9.</p>
          </div>
        )}

        {grupo.enderecos_visitados?.length > 0 && (
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={reiniciar}
              onChange={(e) => setReiniciar(e.target.checked)}
            />
            Reiniciar cobertura do zero (limpar feitos)
          </label>
        )}

        <button
          type="button"
          className={`w-full rounded-lg px-3 py-2 text-xs font-extrabold transition shadow-sm ${
            !podeEnviar || busy
              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.99]"
          }`}
          disabled={!podeEnviar || busy}
          onClick={() =>
            void acao(async () => {
              const res = await adminDesignacoesRequest("/admin/designacoes", {
                requestId: requestId.current,
                grupoId: grupo.id,
                contatoId: isNovoContato ? undefined : contatoId,
                contato: isNovoContato
                  ? { nome: nome.trim(), telefone: normalizarTelefone(telefone) }
                  : undefined,
                reiniciar,
                converterEmail: Boolean(grupo.designadoPara),
              });
              setShare(res);
              requestId.current = crypto.randomUUID();
              if (res?.telefoneE164 && res?.partes?.[0]) {
                const url = buildWhatsAppShareUrl(res.partes[0], res.telefoneE164);
                window.open(url, "_blank");
              }
            })
          }
        >
          {labelBotao}
        </button>
      </div>
    );
  };

  const renderSharePronto = () => (
    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
      <div className="text-center text-xs font-black text-emerald-900">
        ✓ Designação salva com sucesso!
      </div>
      {share.partes?.map((parte, i) => (
        <a
          key={i}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
          href={buildWhatsAppShareUrl(parte, share.telefoneE164)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>💬</span> Abrir WhatsApp {share.partes.length > 1 ? `(${i + 1}/${share.partes.length})` : ""}
        </a>
      ))}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
          onClick={() =>
            void acao(() => navigator.clipboard.writeText(share.mensagem))
          }
        >
          Copiar mensagem
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
          onClick={() =>
            void acao(() => navigator.clipboard.writeText(share.link))
          }
        >
          Copiar link
        </button>
      </div>
    </div>
  );

  // Modo compacto (integrado dentro da caixa "Designação")
  if (compact) {
    return (
      <div className="space-y-2 text-xs">
        {erro && <p role="alert" className="text-red-700 font-semibold">{erro}</p>}
        {aviso && <p role="status" className="font-semibold text-emerald-800">{aviso}</p>}
        {share ? renderSharePronto() : ativa ? renderAcoesAtiva() : renderFormNovaDesignacao()}
      </div>
    );
  }

  // Modo padrão (fora do popup ou legado)
  return (
    <section className="mt-3 space-y-3 rounded-xl border border-green-200 bg-white p-3 text-sm">
      {ativa && (
        <div className="rounded-lg border border-green-100 bg-green-50 px-2.5 py-1.5 text-xs">
          <span className="font-black uppercase text-green-700">
            Com responsável (WhatsApp):{" "}
          </span>
          <span className="font-extrabold text-green-900">
            {grupo.designadoNome}
          </span>
        </div>
      )}
      <button
        className={`${button} w-full bg-green-700 text-white`}
        disabled={busy}
        onClick={() => {
          setAberto(!aberto);
          if (!aberto && !ativa) {
            void carregarContatos();
          }
        }}
      >
        {ativa ? "Gerenciar designação WhatsApp" : "Designar por WhatsApp"}
      </button>
      {erro && (
        <p role="alert" className="text-red-800">
          {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="font-semibold text-green-800">
          {aviso}
        </p>
      )}
      {aberto && (
        <fieldset disabled={busy} className="space-y-3">
          {share ? renderSharePronto() : ativa ? renderAcoesAtiva() : renderFormNovaDesignacao()}
        </fieldset>
      )}
    </section>
  );
}

export function ConfiguracaoDesignacoes() {
  const [dias, setDias] = useState(90);
  const [suporte, setSuporte] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [busy, setBusy] = useState(false);
  const [designacoes, setDesignacoes] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [editar, setEditar] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [correcao, setCorrecao] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [operacao, setOperacao] = useState(null);
  const [reaberto, setReaberto] = useState(null);
  const correcaoRequestId = useRef(crypto.randomUUID());
  const carregar = useCallback(async () => {
    if (!designacoesHabilitadas) return;
    try {
      const config = await adminDesignacoesRequest("/admin/configuracao");
      setDias(config.prazoDevolucaoAutomaticaDias);
      setSuporte(config.whatsappSuportePublico || "");
      setOperacao(await adminDesignacoesRequest("/admin/operacao"));
      setDesignacoes(
        await adminDesignacoesRequest("/admin/designacoes/listar"),
      );
      setContatos(await adminDesignacoesRequest("/admin/contatos/listar"));
    } catch (e) {
      setMensagem(e.message);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  async function executar(fn) {
    setBusy(true);
    setMensagem("");
    try {
      await fn();
      await carregar();
      setMensagem("Salvo.");
    } catch (e) {
      setMensagem(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!designacoesHabilitadas) return null;
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-bold">Designação por WhatsApp sem login</h2>
      <label className="block">
        Devolver automaticamente após quantos dias?
        <input
          type="number"
          className="ml-3 rounded border p-3"
          min="1"
          max="3650"
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
        />
      </label>
      <p>
        Ao vencer esse prazo, o acesso será encerrado, o território será
        devolvido automaticamente e os administradores serão avisados. As
        marcações serão preservadas; isso não confirma cobertura.
      </p>
      <p>
        Alterar o padrão vale somente para novas designações. Para uma
        designação atual, use Prorrogar prazo.
      </p>
      <label className="block">
        WhatsApp do responsável para divulgar no comprovante (opcional)
        <input
          type="tel"
          className="block w-full rounded border p-3"
          value={suporte}
          onChange={(e) => setSuporte(e.target.value)}
          placeholder="+55 e celular com DDD"
        />
      </label>
      <button
        className={button}
        disabled={busy}
        onClick={() =>
          void executar(() =>
            adminDesignacoesRequest("/admin/configuracao", {
              salvar: true,
              prazoDevolucaoAutomaticaDias: dias,
              whatsappSuportePublico: suporte,
            }),
          )
        }
      >
        Salvar prazo para novas designações
      </button>
      <button
        className={button}
        disabled={busy}
        onClick={() =>
          void executar(() => adminDesignacoesRequest("/admin/reconciliar"))
        }
      >
        Processar vencimentos pendentes
      </button>
      <p role="status">{busy ? "Salvando…" : mensagem}</p>
      <button
        className={button}
        disabled={busy}
        onClick={() =>
          void executar(async () =>
            setPrevia(await adminDesignacoesRequest("/admin/prazo/previa")),
          )
        }
      >
        Revisar aplicação do padrão às designações atuais
      </button>
      {previa && (
        <div className="space-y-3 rounded border border-amber-300 p-3">
          <p>
            Aplicar {previa.dias} dias, contados desde cada designação, a{" "}
            {previa.designacoes.length} territórios. Datas anteriores a hoje
            encerram o acesso imediatamente; a rotina fará a devolução sem
            cobertura.
          </p>
          <ul>
            {previa.designacoes.map((d) => (
              <li key={d.id}>
                {d.codigo}:{" "}
                {new Date(d.expiraEmAnterior).toLocaleDateString("pt-BR")} →{" "}
                {new Date(d.expiraEm).toLocaleDateString("pt-BR")}
              </li>
            ))}
          </ul>
          <button
            className={button}
            disabled={busy || !previa.designacoes.length}
            onClick={() =>
              void executar(async () => {
                const result = await adminDesignacoesRequest(
                  "/admin/prazo/aplicar",
                  { ...previa, confirmar: true },
                );
                const falhas = result.resultados.filter((r) => !r.ok);
                if (falhas.length)
                  throw new Error(
                    `${falhas.length} prazos não foram alterados. Atualize a prévia e revise novamente.`,
                  );
                setPrevia(null);
              })
            }
          >
            Confirmar aplicação aos territórios listados
          </button>
          <button className={button} onClick={() => setPrevia(null)}>
            Cancelar
          </button>
        </div>
      )}
      {operacao && (
        <p>
          Última rotina:{" "}
          {operacao.atualizadoEm
            ? new Date(operacao.atualizadoEm).toLocaleString("pt-BR")
            : "ainda não executada"}
          .{" "}
          {operacao.falhas.length
            ? `${operacao.falhas.length} falhas pendentes. Use Processar vencimentos pendentes e revise os territórios vencidos.`
            : "Nenhuma falha registrada."}
        </p>
      )}
      <h3 className="text-lg font-bold">Acompanhamento</h3>
      <ul className="space-y-3">
        {designacoes.map((d) => (
          <li key={d.id} className="rounded border p-3">
            <p>
              {d.codigo} · {d.responsavelNome} ·{" "}
              {d.status === "ativa"
                ? "Designado"
                : d.motivo === "prazo_expirado"
                  ? "Devolvido automaticamente"
                  : d.status === "concluida"
                    ? "Concluído"
                    : d.motivo === "manual_parcial"
                      ? "Devolvido parcialmente"
                      : d.status}
            </p>
            <p>
              {d.feitos}/{d.total} feitos · prazo{" "}
              {new Date(d.expiraEm).toLocaleDateString("pt-BR")}
              {d.status === "ativa" && +new Date(d.expiraEm) <= Date.now()
                ? " · Vencido, aguardando processamento"
                : ""}
            </p>
            {d.comprovante && (
              <button
                className={button}
                onClick={() => {
                  setCorrecao(d.id);
                  setMotivo("");
                  correcaoRequestId.current = crypto.randomUUID();
                }}
              >
                Registrar correção histórica
              </button>
            )}
          </li>
        ))}
      </ul>
      {correcao && (
        <div className="space-y-3">
          <label className="block">
            Motivo da correção
            <textarea
              className="block w-full rounded border p-3"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void executar(async () => {
                await adminDesignacoesRequest(
                  `/admin/designacoes/${correcao}/corrigir`,
                  { motivo },
                );
                setCorrecao(null);
              })
            }
          >
            Salvar ajuste auditado
          </button>
          <button
            className={button}
            disabled={busy || motivo.trim().length < 5}
            onClick={() =>
              void executar(async () => {
                setReaberto(
                  await adminDesignacoesRequest(
                    `/admin/designacoes/${correcao}/reabrir`,
                    { motivo, requestId: correcaoRequestId.current },
                  ),
                );
                setCorrecao(null);
              })
            }
          >
            Corrigir e reabrir com novo link
          </button>
          <button className={button} onClick={() => setCorrecao(null)}>
            Cancelar
          </button>
        </div>
      )}
      {reaberto && (
        <div className="space-y-3 rounded border p-3">
          <p>Reaberto com novo acesso. O link anterior continua encerrado.</p>
          <button
            className={button}
            onClick={() =>
              void executar(() =>
                navigator.clipboard.writeText(reaberto.mensagem),
              )
            }
          >
            Copiar nova mensagem
          </button>
        </div>
      )}
      <h3 className="text-lg font-bold">Contatos</h3>
      <ul>
        {contatos.map((c) => (
          <li key={c.id} className="my-2 flex flex-wrap items-center gap-3">
            {c.nome} · {c.telefoneE164} · {c.carga} territórios
            <button className={button} onClick={() => setEditar(c)}>
              Editar contato
            </button>
          </li>
        ))}
      </ul>
      {editar && (
        <div className="space-y-3">
          <label className="block">
            Nome
            <input
              className="block rounded border p-3"
              value={editar.nome}
              onChange={(e) => setEditar({ ...editar, nome: e.target.value })}
            />
          </label>
          <label className="block">
            Celular com + e DDI
            <input
              type="tel"
              className="block rounded border p-3"
              value={editar.telefoneE164}
              onChange={(e) =>
                setEditar({ ...editar, telefoneE164: e.target.value })
              }
            />
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={editar.ativo}
              onChange={(e) =>
                setEditar({ ...editar, ativo: e.target.checked })
              }
            />
            Contato ativo para novas designações
          </label>
          {!editar.ativo && (
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={editar.revogarAcessos || false}
                onChange={(e) =>
                  setEditar({ ...editar, revogarAcessos: e.target.checked })
                }
              />
              Também bloquear os links ativos deste contato (os territórios
              continuam atribuídos até devolução)
            </label>
          )}
          <p>
            Alterar o celular mantém a pessoa e seu histórico. Para proteger
            links já compartilhados, use Renovar link em cada território.
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() =>
              void executar(async () => {
                await adminDesignacoesRequest("/admin/contatos", editar);
                setEditar(null);
              })
            }
          >
            Salvar contato
          </button>
          <button className={button} onClick={() => setEditar(null)}>
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}
