import IconeNavegacao from "./IconeNavegacao";
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { designacoesRequest } from "../designacoesApi";
import { diaLocal, validarDataCobertura } from "../../shared/designacoes";

import useIdiomaPublico from "./useIdiomaPublico";
import ModalConfirmacaoPublica from "./ModalConfirmacaoPublica";
import { getNavegacaoEndereco } from "./territorioPublicoUtils";
import "./territorioPublico.css";

const MapaTerritorioPublico = lazy(() => import("./MapaTerritorioPublico"));
const resultados = {
  concluida: "coverageConfirmed",
  manual_parcial: "returnedPartial",
  manual_sem_cobertura: "returnedNone",
  prazo_expirado: "returnedExpired",
};

export default function TerritorioPublico({ credencial, revisar, consulta, modoConsulta = false, cabecalho, cartaoId, onPerdaAutorizacao }) {
  const params = useParams();
  const token = credencial || params.token;
  const revisao = revisar || params.revisao;
  const idioma = useIdiomaPublico();
  const { t } = idioma;
  const [operacionais, setDados] = useState(null);
  const emConsulta = modoConsulta || Boolean(consulta);
  const dados = emConsulta ? consulta : operacionais;
  const [autorizado, setAutorizado] = useState(false);
  const podeOperar = Boolean(!emConsulta && token && autorizado && dados && !dados.comprovante);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [operacao, setOperacao] = useState(null);
  const [confirmacao, setConfirmacao] = useState(false);
  const [declaracao, setDeclaracao] = useState(false);
  const [data, setData] = useState(diaLocal(Date.now()));
  const [outroDia, setOutroDia] = useState(false);
  const [aviso, setAviso] = useState("");
  const ocupado = useRef(false);
  const reqSeq = useRef(0);
  const revalidacaoPendente = useRef(false);
  const revisaoAplicada = useRef(false);
  const titulo = useRef(null);
  const confirmarRef = useRef(null);
  const focoAntesSalvar = useRef(null);
  const devolverRef = useRef(null);
  const carregar = useCallback(
    async ({ manterAviso = false } = {}) => {
      if (emConsulta || !token) return false;
      if (ocupado.current) { revalidacaoPendente.current = true; return false; }
      setAutorizado(false);
      const seq = ++reqSeq.current;
      try {
        const result = await designacoesRequest(
          "/public/territorio",
          cartaoId ? { cartaoId } : {},
          token,
        );
        if (ocupado.current || seq !== reqSeq.current) return false;
        setDados(result);
        setAutorizado(true);
        if (!manterAviso) setErro("");
        return true;
      } catch (e) {
        if (ocupado.current || seq !== reqSeq.current) return false;
        setErro(e);
        setConfirmacao(false);
        if ([401, 403, 410, 409].includes(e.code)) onPerdaAutorizacao?.(e);
        return false;
      }
    },
    [token, emConsulta, cartaoId, onPerdaAutorizacao],
  );
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.append(meta);
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow";
    document.head.append(robots);
    void carregar();
    let timer = null;
    const revalidar = () => {
      if (document.visibilityState === "visible") {
        if (ocupado.current) { revalidacaoPendente.current = true; return; }
        if (!emConsulta) setAutorizado(false);
        clearTimeout(timer);
        timer = setTimeout(() => void carregar(), 80);
      }
    };
    window.addEventListener("focus", revalidar);
    document.addEventListener("visibilitychange", revalidar);
    return () => {
      // Request generation, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      reqSeq.current++;
      clearTimeout(timer);
      meta.remove();
      robots.remove();
      window.removeEventListener("focus", revalidar);
      document.removeEventListener("visibilitychange", revalidar);
    };
  }, [carregar, emConsulta]);
  useEffect(() => {
    const anterior = document.documentElement.lang;
    const tituloAnterior = document.title;
    document.documentElement.lang = idioma.locale;
    document.title = t("pageTitle");
    return () => {
      document.documentElement.lang = anterior;
      document.title = tituloAnterior;
    };
  }, [idioma, t]);
  useEffect(() => {
    if (confirmacao) confirmarRef.current?.focus();
  }, [confirmacao]);
  useEffect(() => {
    if (!salvando && focoAntesSalvar.current) {
      const alvo = dados?.comprovante
        ? titulo.current
        : confirmacao
          ? confirmarRef.current
          : focoAntesSalvar.current?.isConnected
            ? focoAntesSalvar.current
            : devolverRef.current;
      if (alvo?.isConnected && !alvo.disabled)
        alvo.focus({ preventScroll: true });
      focoAntesSalvar.current = null;
    }
  }, [salvando, dados, confirmacao]);
  const carregado = podeOperar;
  useEffect(() => {
    if (revisao && carregado && !revisaoAplicada.current) {
      revisaoAplicada.current = true;
      if (revisao === "fechar") {
        setConfirmacao(true);
        setDeclaracao(false);
      } else {
        titulo.current?.focus();
      }
    }
  }, [revisao, carregado]);
  async function salvar(acao, body) {
    if (!podeOperar || ocupado.current) return;
    if (acao === "concluir" && outroDia) {
      try {
        validarDataCobertura(
          body.dataCobertura,
          dados.inicioCobertura,
          new Date(),
        );
      } catch (e) {
        setErro(e);
        return;
      }
    }
    focoAntesSalvar.current = document.activeElement;
    ocupado.current = true;
    reqSeq.current++;
    setOperacao({ acao, enderecoId: body.enderecoId });
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const result = await designacoesRequest(
        `/public/${acao}`,
        {
          ...body,
          ...(cartaoId ? { cartaoId } : {}),
          composicaoVersao: dados.composicaoVersao,
          progressoVersao: dados.progressoVersao,
        },
        token,
      );
      setDados(result);
      if (result.comprovante) setConfirmacao(false);
      const todosMarcados =
        !result.comprovante &&
        acao === "endereco" &&
        result.enderecos?.length > 0 &&
        result.feitos?.length === result.enderecos.length;
      if (todosMarcados) {
        setConfirmacao(true);
        setDeclaracao(false);
        setAviso("allDoneNotice");
      } else {
        setAviso(result.comprovante ? "returnedNotice" : "saved");
      }
    } catch (e) {
      const mensagemServidor = e;
      setErro(mensagemServidor);
      if ([401, 403, 410].includes(e.code)) {
        setAutorizado(false); setConfirmacao(false);
        onPerdaAutorizacao?.(e);
      } else if (e.code !== 409) {
        setAutorizado(false); setConfirmacao(false);
      }
      if (e.code === 409) {
        setConfirmacao(false);
        setDeclaracao(false);
        ocupado.current = false;
        const recarregou = await carregar({ manterAviso: true });
        if (recarregou) {
          setErro(
            "As marcações foram atualizadas. Revise a lista antes de devolver.",
          );
        }
      }
    } finally {
      ocupado.current = false;
      setSalvando(false);
      setOperacao(null);
      if (revalidacaoPendente.current) {
        revalidacaoPendente.current = false;
        void carregar({ manterAviso: true });
      }
    }
  }
  const total = dados?.enderecos?.length || 0;
  const feitos = dados?.feitos?.length || 0;
  const resumo = idioma.resumo(feitos, total);
  const fecharConfirmacao = () => {
    if (ocupado.current) return;
    setConfirmacao(false);
    setDeclaracao(false);
    requestAnimationFrame(() =>
      devolverRef.current?.focus({ preventScroll: true }),
    );
  };

  if (!emConsulta && dados?.comprovante) {
    const c = dados.comprovante;
    return (
      <div lang={idioma.locale} className="territorio-publico tp-receipt-page">
        <main className="tp-receipt">
          <span className="tp-receipt-check" aria-hidden="true">
            ✓
          </span>
          <p className="tp-eyebrow">{t("receiptLabel")}</p>
          <h1 ref={titulo} tabIndex={-1}>
            {c.codigo} — {t("receipt")}
          </h1>
          <p className="tp-receipt-result">
            {t(resultados[c.resultado] || "returned")}
          </p>
          <div className="tp-receipt-counts">
            <div>
              <strong>{c.feitos}</strong>
              <span>{t("doneLower")}</span>
            </div>
            <div>
              <strong>{c.pendentes}</strong>
              <span>{t("pendingLower")}</span>
            </div>
          </div>
          <p className="tp-muted">
            {t("recordedAt")} {idioma.formatarData(c.registradoEm, true)}
          </p>
          {c.dataCobertura && (
            <p>
              {t("coverageDate")} {idioma.formatarDia(c.dataCobertura)}
            </p>
          )}
          <div className="tp-receipt-support">
            <p>{t("returnedMistake")}</p>
            {c.whatsappSuportePublico && (
              <a
                className="tp-button tp-button-secondary"
                href={`https://wa.me/${c.whatsappSuportePublico.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("contact")} <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </main>
      </div>
    );
  }
  return (
    <div lang={idioma.locale} className={`territorio-publico${!podeOperar ? " tp-consulta" : ""}`}>
      <main className="tp-page">
        <header className="tp-header">
          <div className="tp-header-top">
            <span className="tp-eyebrow">{t("yourTerritory")}</span>
            {podeOperar && <div className="tp-header-feedback">
              {!salvando && !aviso && (
                <span className="tp-private-note">{t("followHere")}</span>
              )}
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`tp-save-status${salvando || aviso ? " tp-save-status-visible" : ""}`}
              >
                {(salvando || aviso) && (
                  <>
                    <span
                      aria-hidden="true"
                      className={salvando ? "tp-spinner" : undefined}
                    >
                      {salvando ? null : "✓"}
                    </span>
                    <span aria-hidden="true">
                      {salvando ? t("saving") : t("saved")}
                    </span>
                    <span className="sr-only">
                      {salvando ? t("savingWait") : t(aviso)}
                    </span>
                  </>
                )}
              </span>
            </div>}
          </div>
          <h1 ref={titulo} tabIndex={-1}>
            {dados?.nome || t("opening")}
          </h1>
          {cabecalho}
          {dados && (
            <>
              <div className="tp-header-meta">
                <span className="tp-territory-code">{dados.codigo}</span>
                {podeOperar && <span>
                  {t("returnBy")}{" "}
                  <strong>{idioma.formatarData(dados.expiraEm)}</strong>
                </span>}
              </div>
              {podeOperar && <>
              <div className="tp-progress-summary">
                <p>
                  <strong>{feitos}</strong> {t("of")} {total}{" "}
                  {t("addressesDone")}
                </p>
                <span>{t("pendingCount", { count: total - feitos })}</span>
              </div>
              <div
                className="tp-progress-track"
                role="progressbar"
                aria-label={t("addressesDone")}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={feitos}
              >
                <div
                  style={{ width: `${total ? (feitos / total) * 100 : 0}%` }}
                />
              </div>
              </>}
            </>
          )}
        </header>

        {erro && !confirmacao && (
          <div role="alert" className="tp-alert">
            <p>{idioma.erro(erro)}</p>
            <button
              className="tp-button tp-button-secondary"
              disabled={salvando}
              aria-busy={salvando}
              onClick={() => void carregar()}
            >
              {t("retry")}
            </button>
          </div>
        )}

        {dados && (
          <>
            <section
              className="tp-map-card"
              aria-labelledby="mapa-territorio-titulo"
            >
              <div className="tp-section-heading">
                <div>
                  <h2 id="mapa-territorio-titulo">{t("mapTitle")}</h2>
                  <p>{t("mapHint")}</p>
                </div>
                <span className="tp-map-symbol" aria-hidden="true">
                  ⌖
                </span>
              </div>
              <Suspense
                fallback={
                  <div className="tp-map-loading" role="status">
                    {t("mapLoading")}
                  </div>
                }
              >
                <MapaTerritorioPublico
                  enderecos={dados.enderecos}
                  podeMarcar={podeOperar}
                  feitos={podeOperar ? dados.feitos : undefined}
                  salvando={salvando}
                  operacao={operacao}
                  idioma={idioma}
                  onMarcar={(enderecoId, pregado) =>
                    void salvar("endereco", { enderecoId, pregado })
                  }
                />
              </Suspense>
              {podeOperar && <div className="tp-map-legend">
                <span>
                  <i className="tp-legend-pending" />
                  {t("pending")}
                </span>
                <span>
                  <i className="tp-legend-done" />✓ {t("done")}
                </span>
              </div>}
            </section>

            {podeOperar && dados.herdados.length > 0 && (
              <p className="tp-inherited">
                <span aria-hidden="true">↪</span>
                <span>{t("inherited", { count: dados.herdados.length })}</span>
              </p>
            )}

            <section
              aria-labelledby="lista-enderecos-titulo"
              className="tp-address-section"
            >
              <div className="tp-list-heading">
                <div>
                  <h2 id="lista-enderecos-titulo">
                    {t("addressList")} <span>{total}</span>
                  </h2>
                </div>
              </div>
              <fieldset disabled={salvando} aria-busy={salvando}>
                {podeOperar && <legend className="sr-only">{t("markAddresses")}</legend>}
                <ul className="tp-address-list">
                  {dados.enderecos.map((e) => {
                    const feito = podeOperar && dados.feitos.includes(e.id);
                    const marcando = salvando && operacao?.enderecoId === e.id;
                    return (
                      <li
                        key={e.id}
                        className={`tp-address-card${feito ? " tp-address-card-done" : ""}`}
                      >
                        <div className="tp-address-card-top">
                          <span className="tp-address-code">{e.codigo}</span>
                          {podeOperar && <span
                            className={`tp-state${feito ? " tp-state-done" : ""}`}
                          >
                            {feito ? `✓ ${t("done")}` : t("pending")}
                          </span>}
                        </div>
                        <p className="tp-address-text">{e.endereco}</p>
                        {e.observacao && <div className="tp-address-observation"><strong>{t("observations")}</strong><p>{e.observacao}</p></div>}
                        {podeOperar && dados.herdados.includes(e.id) && (
                          <p className="tp-inherited-note">
                            {t("inheritedDone")}
                          </p>
                        )}
                        <div className="tp-address-actions">
                          {podeOperar && <label
                            className={`tp-mark-action${feito ? " tp-mark-action-done" : ""}${marcando ? " tp-mark-action-saving" : ""}`}
                            aria-busy={marcando}
                          >
                            <input
                              type="checkbox"
                              aria-label={`${e.codigo}: ${e.endereco} — ${t("done")}`}
                              checked={feito}
                              onChange={(event) =>
                                void salvar("endereco", {
                                  enderecoId: e.id,
                                  pregado: event.target.checked,
                                })
                              }
                            />
                            {marcando && (
                              <span
                                className="tp-spinner tp-mark-spinner"
                                aria-hidden="true"
                              />
                            )}
                            <span>{marcando ? t("saving") : t("done")}</span>
                          </label>}
                          <a
                            className="tp-button tp-button-secondary"
                            href={getNavegacaoEndereco(e)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconeNavegacao /> {t("navigate")}
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </section>
            {podeOperar && <p className="tp-bottom-hint">{t("bottomHint")}</p>}
          </>
        )}
      </main>
      {podeOperar && (
        <footer className="tp-bottom-bar">
          <div className="tp-bottom-bar-inner">
            <div className="tp-bottom-progress">
              <strong>
                {feitos} {t("of")} {total}
              </strong>
              <span>{t("addressesDone")}</span>
            </div>
            <button
              ref={devolverRef}
              type="button"
              className="tp-button tp-button-primary"
              disabled={salvando}
              aria-busy={salvando}
              onClick={() => {
                setConfirmacao(true);
                setDeclaracao(false);
              }}
            >
              {salvando ? (
                <>
                  <span className="tp-spinner" aria-hidden="true" />
                  {operacao?.acao === "devolver" ||
                  operacao?.acao === "concluir"
                    ? t("returning")
                    : t("saving")}
                </>
              ) : (
                <>
                  {feitos === total ? t("finishReturn") : t("return")}
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </div>
        </footer>
      )}

      {podeOperar && confirmacao && (
        <ModalConfirmacaoPublica
          ocupado={salvando}
          idioma={idioma}
          onClose={fecharConfirmacao}
          tituloRef={confirmarRef}
          descricaoId="resumo-devolucao"
          titulo={declaracao ? t("confirmCoverageTitle") : t("reviewReturn")}
        >
          <div className="tp-confirm-counts">
            <span>
              <strong>{feitos}</strong> {t("doneLower")}
            </span>
            <span>
              <strong>{total - feitos}</strong> {t("pendingLower")}
            </span>
          </div>
          <p id="resumo-devolucao">
            {declaracao
              ? t("declaration", { total, done: feitos })
              : resumo.texto}
          </p>
          {(declaracao || feitos === total) && (
            <div className="tp-coverage-date">
              <p>
                {t("coverageDate")} <strong>{idioma.formatarDia(data)}</strong>
              </p>
              <button
                type="button"
                className="tp-text-button"
                disabled={salvando}
                aria-busy={salvando}
                onClick={() => setOutroDia(!outroDia)}
              >
                {t("anotherDay")}
              </button>
              {outroDia && (
                <label>
                  {t("finishedWhen")}
                  <input
                    type="date"
                    lang={idioma.locale}
                    aria-describedby="formato-data-cobertura"
                    value={data}
                    min={diaLocal(dados.inicioCobertura)}
                    max={diaLocal(Date.now())}
                    disabled={salvando}
                    aria-busy={salvando}
                    onChange={(e) => setData(e.target.value)}
                  />
                  <span id="formato-data-cobertura" className="tp-muted">
                    {t("dateFormat")}
                  </span>
                </label>
              )}
            </div>
          )}
          {erro && (
            <div role="alert" className="tp-alert">
              <p>{idioma.erro(erro)}</p>
            </div>
          )}
          <p role="status" aria-live="polite" className="tp-dialog-saving">
            {salvando ? t("savingWait") : ""}
          </p>
          <div className="tp-dialog-actions">
            <button
              type="button"
              className="tp-button tp-button-primary"
              disabled={salvando}
              aria-busy={salvando}
              onClick={() => {
                if (declaracao || feitos === total)
                  void salvar("concluir", {
                    modoConclusao: declaracao ? "declaracao" : "marcacoes",
                    confirmarCobertura: true,
                    ...(outroDia ? { dataCobertura: data } : {}),
                  });
                else void salvar("devolver", {});
              }}
            >
              {salvando && <span className="tp-spinner" aria-hidden="true" />}
              {salvando
                ? t("returning")
                : declaracao
                  ? t("confirmReturn")
                  : resumo.acao}
            </button>
            {feitos < total && !declaracao && (
              <button
                type="button"
                className="tp-button tp-button-secondary"
                disabled={salvando}
                aria-busy={salvando}
                onClick={() => setDeclaracao(true)}
              >
                {t("coveredUnmarked")}
              </button>
            )}
            <button
              type="button"
              className="tp-text-button"
              disabled={salvando}
              aria-busy={salvando}
              onClick={fecharConfirmacao}
            >
              {t("cancelReview")}
            </button>
          </div>
        </ModalConfirmacaoPublica>
      )}
    </div>
  );
}
