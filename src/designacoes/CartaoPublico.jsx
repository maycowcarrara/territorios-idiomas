import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { designacoesRequest } from "../designacoesApi";
import TerritorioPublico from "./TerritorioPublico";
import useIdiomaPublico from "./useIdiomaPublico";
import "./territorioPublico.css";

export default function CartaoPublico() {
  const params = useParams();
  return <AcessoCartao key={`${params.cartaoId}:${params.codigo || ""}:${params.revisao || ""}`} {...params} />;
}

export function AcessoCartao({ cartaoId, codigo: inicial, revisao }) {
  const idioma = useIdiomaPublico();
  const { t } = idioma;
  const [codigo, setCodigo] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [erroConsulta, setErroConsulta] = useState(null);
  const [token, setToken] = useState(null);
  const [expiraEm, setExpiraEm] = useState(null);
  const [erro, setErro] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formulario, setFormulario] = useState(false);
  const codeInput = useRef(null);
  const habilitarRef = useRef(null);
  const devolverFoco = useRef(false);
  const exchange = useRef(null);
  const consultaSeq = useRef(0);
  const acessoSeq = useRef(0);
  const lock = useRef(false);
  const storageKey = `cartao:${location.origin}:${cartaoId}`;
  const reviewing = useRef(revisao === "fechar");

  const carregarConsulta = useCallback(async () => {
    const seq = ++consultaSeq.current;
    try {
      const result = await designacoesRequest("/public/consulta-cartao", { cartaoId });
      if (seq !== consultaSeq.current) return;
      setConsulta(result); setErroConsulta(null);
    } catch (e) {
      if (seq !== consultaSeq.current) return;
      setErroConsulta(e);
      // A failed refresh must not leave an unavailable territory on screen.
      setConsulta(null);
    }
  }, [cartaoId]);

  const perderAutorizacao = useCallback((e) => {
    acessoSeq.current++; lock.current = false;
    setToken(null); setBusy(false); setFormulario(false); setCodigo(""); setErro(e);
    reviewing.current = false;
    try { sessionStorage.removeItem(storageKey); } catch { /* unavailable */ }
    void carregarConsulta();
  }, [storageKey, carregarConsulta]);

  const ativar = useCallback(async (sessao, seq) => {
    if (seq !== acessoSeq.current) return;
    // Only the authenticated snapshot can become the source of operations.
    await designacoesRequest("/public/territorio", { cartaoId }, sessao.token);
    if (seq !== acessoSeq.current) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(sessao)); } catch { /* memory only */ }
    setToken(sessao.token); setExpiraEm(sessao.expiraEm); setFormulario(false); setCodigo("");
  }, [cartaoId, storageKey]);

  useEffect(() => {
    if (inicial) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#/c/${cartaoId}`);
  }, [cartaoId, inicial]);

  useEffect(() => {
    void carregarConsulta();
    const revalidar = () => {
      if (document.visibilityState === "visible") void carregarConsulta();
    };
    window.addEventListener("focus", revalidar);
    document.addEventListener("visibilitychange", revalidar);
    return () => {
      // Request generation, not a DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      consultaSeq.current++;
      window.removeEventListener("focus", revalidar);
      document.removeEventListener("visibilitychange", revalidar);
    };
  }, [carregarConsulta]);

  useEffect(() => {
    const seq = ++acessoSeq.current;
    if (inicial) {
      setBusy(true); lock.current = true;
      // React StrictMode must not issue the one-time exchange twice.
      if (!exchange.current || exchange.current.codigo !== inicial) exchange.current = {
        codigo: inicial,
        promise: designacoesRequest("/public/acessar-cartao", { cartaoId, codigo: inicial }),
      };
      void (async () => {
        try { await ativar(await exchange.current.promise, seq); }
        catch (e) { if (seq === acessoSeq.current) { setErro(e); setFormulario(true); } }
        finally { if (seq === acessoSeq.current) { setBusy(false); lock.current = false; } }
      })();
    }
    // A plain QR always starts in consultation, regardless of stored sessions.
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      acessoSeq.current++;
    };
  }, [cartaoId, inicial, ativar]);

  useEffect(() => {
    if (!token || !expiraEm) return;
    const timer = setTimeout(() => perderAutorizacao({ code: 403, message: "Código inválido ou encerrado." }), Math.max(0, +new Date(expiraEm) - Date.now()));
    return () => clearTimeout(timer);
  }, [token, expiraEm, perderAutorizacao]);

  useEffect(() => {
    if (formulario && !busy) codeInput.current?.focus();
    else if (!formulario && devolverFoco.current) {
      devolverFoco.current = false;
      habilitarRef.current?.focus();
    }
  }, [formulario, busy]);

  async function habilitar() {
    if (lock.current) return;
    const seq = ++acessoSeq.current;
    lock.current = true; setBusy(true); setErro(null);
    try {
      let session;
      try { session = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* unavailable */ }
      if (session?.token) {
        try { await ativar(session, seq); return; }
        catch (e) {
          if (![401, 403, 409, 410].includes(e.code)) throw e;
          try { sessionStorage.removeItem(storageKey); } catch { /* unavailable */ }
        }
      }
      if (seq === acessoSeq.current) setFormulario(true);
    } catch (e) { if (seq === acessoSeq.current) { setErro(e); setFormulario(true); } }
    finally { if (seq === acessoSeq.current) { lock.current = false; setBusy(false); } }
  }
  async function acessar(e) {
    e.preventDefault(); if (lock.current) return;
    const seq = ++acessoSeq.current;
    lock.current = true; setBusy(true); setErro(null);
    try {
      const result = await designacoesRequest("/public/acessar-cartao", { cartaoId, codigo });
      if (seq === acessoSeq.current) await ativar(result, seq);
    } catch (error) { if (seq === acessoSeq.current) setErro(error); }
    finally { if (seq === acessoSeq.current) { lock.current = false; setBusy(false); } }
  }
  function cancelar() {
    acessoSeq.current++; lock.current = false;
    devolverFoco.current = true;
    setFormulario(false); setBusy(false); setErro(null); setCodigo("");
    reviewing.current = false;
  }
  const cabecalho = <div className="tp-enable">
    {!formulario && <button ref={habilitarRef} type="button" className="tp-unlock-button" aria-label={t("enableMarks")} title={t("enableMarks")} aria-expanded={formulario} onClick={() => void habilitar()} disabled={busy}>
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg>
    </button>}
    {busy && <p role="status">{t("opening")}</p>}
    {erro && <p role="alert">{idioma.erro(erro)}</p>}
    {erroConsulta && <div role="alert"><p>{idioma.erro(erroConsulta)}</p><button type="button" onClick={() => void carregarConsulta()}>{t("retry")}</button></div>}
    {formulario && <form onSubmit={acessar}>
      <label htmlFor="access-code">{t("fourDigitCode")}</label>
      <input ref={codeInput} id="access-code" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" minLength={4} maxLength={4} required value={codigo} onChange={e => setCodigo(e.target.value)} disabled={busy} />
      <button className="tp-button tp-button-secondary" type="submit" disabled={busy || !/^\d{4}$/.test(codigo)}>{t("enable")}</button>
      <button className="tp-button tp-button-secondary" type="button" onClick={cancelar}>{t("cancelEnable")}</button>
      {consulta && !consulta.habilitacaoDisponivel && <p>{t("askAssignment")}</p>}
    </form>}
  </div>;
  if (token) return <TerritorioPublico key={token} credencial={token} cartaoId={cartaoId} revisar={reviewing.current ? "fechar" : undefined} onPerdaAutorizacao={perderAutorizacao} />;
  return <TerritorioPublico key="consulta" modoConsulta consulta={consulta} cabecalho={cabecalho} />;
}
