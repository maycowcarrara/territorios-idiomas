import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { designacoesRequest } from "../designacoesApi";
import TerritorioPublico from "./TerritorioPublico";
import useIdiomaPublico from "./useIdiomaPublico";
import "./territorioPublico.css";

export default function CartaoPublico() {
  const { cartaoId, codigo: inicial, revisao } = useParams();
  const idioma = useIdiomaPublico();
  const { t } = idioma;
  const [codigo, setCodigo] = useState("");
  const [card, setCard] = useState(null);
  const [token, setToken] = useState(null);
  const [erro, setErro] = useState(null);
  const [busy, setBusy] = useState(true);
  const reviewing = useRef(revisao === "fechar");
  const lock = useRef(false);
  const codeInput = useRef(null);
  const exchange = useRef(null);
  const storageKey = `cartao:${location.origin}:${cartaoId}`;
  const current = useRef(cartaoId);
  current.current = cartaoId;

  useEffect(() => {
    document.documentElement.lang = idioma.locale;
    document.title = t("pageTitle");
  }, [idioma, t]);
  useEffect(() => { if (!busy && !token) codeInput.current?.focus(); }, [busy, token]);
  useEffect(() => {
    let cancelled = false;
    reviewing.current = revisao === "fechar";
    async function start() {
      setBusy(true); setErro(null); setToken(null); setCard(null);
      try {
        if (inicial) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#/c/${cartaoId}`);
        const info = await designacoesRequest("/public/cartao", { cartaoId });
        if (cancelled) return;
        setCard(info);
        if (inicial) {
          // One-time exchange; immediately scrub the fragment, including on failure.
          if (!exchange.current || exchange.current.codigo !== inicial) exchange.current = {
            codigo: inicial, promise: designacoesRequest("/public/acessar-cartao", { cartaoId, codigo: inicial }),
          };
          const result = await exchange.current.promise;
          if (cancelled) return;
          try { sessionStorage.setItem(storageKey, JSON.stringify(result)); } catch { /* memory-only fallback */ }
          setToken(result.token);
        } else {
          let session;
          try { session = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* unavailable */ }
          if (session?.token && new Date(session.expiraEm) > new Date()) {
            try {
              await designacoesRequest("/public/territorio", {}, session.token);
              if (!cancelled) setToken(session.token);
            } catch { try { sessionStorage.removeItem(storageKey); } catch { /* unavailable */ } }
          }
        }
      } catch (e) { if (!cancelled) setErro(e); }
      finally { if (!cancelled) setBusy(false); }
    }
    void start();
    return () => { cancelled = true; };
    // replaceState removes the credential without navigating/remounting the exchange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartaoId, inicial, revisao]);
  async function acessar(e) {
    e.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setErro(null);
    const requestedCard = cartaoId;
    try {
      const result = await designacoesRequest("/public/acessar-cartao", { cartaoId, codigo });
      if (current.current !== requestedCard) return;
      try { sessionStorage.setItem(storageKey, JSON.stringify(result)); } catch { /* memory-only fallback */ }
      setToken(result.token); setCodigo("");
    } catch (error) { if (current.current === requestedCard) setErro(error); }
    finally { lock.current = false; setBusy(false); }
  }
  if (token) return <TerritorioPublico key={cartaoId} credencial={token} revisar={reviewing.current ? "fechar" : undefined} />;
  return <main className="tp-page tp-card-access" lang={idioma.locale}>
    <h1>{card?.codigo || t("yourTerritory")}</h1>
    {busy && <p role="status">{t("opening")}</p>}
    {erro && <p role="alert">{idioma.erro(erro)}</p>}
    {card && !card.disponivel && <p>{t("askAssignment")}</p>}
    <form onSubmit={acessar}>
      <label htmlFor="access-code">{t("accessCode")}</label>
      <input ref={codeInput} id="access-code" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" minLength={4} maxLength={4} required value={codigo} onChange={e => setCodigo(e.target.value)} disabled={busy} />
      <button type="submit" disabled={busy || !/^\d{4}$/.test(codigo)}>{t("openCard")}</button>
    </form>
  </main>;
}
