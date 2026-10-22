import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

export default function LoginDemonstracao() {
  const navigate = useNavigate();
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const local =
    import.meta.env.VITE_LOCAL_EMULATORS === "true" &&
    auth.app.options.projectId.startsWith("demo-") &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (!local)
    return <p>Demonstração disponível somente nos emuladores locais.</p>;
  return (
    <main className="mx-auto max-w-lg space-y-5 p-6">
      <h1 className="text-2xl font-bold">
        Administrador da demonstração local
      </h1>
      <p>
        Conta fictícia, conectada apenas aos emuladores. Prepare os dados com o
        comando designacoes:prepare.
      </p>
      <button
        className="min-h-12 rounded-xl bg-blue-800 px-4 py-3 font-bold text-white disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErro("");
          try {
            await signInWithEmailAndPassword(
              auth,
              "admin-designacoes@example.test",
              "DemonstracaoLocal123!",
            );
            navigate("/admin", { replace: true });
          } catch {
            setErro(
              "Não foi possível entrar. Confira se os emuladores estão abertos e a demonstração foi preparada.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Entrando…" : "Entrar como administrador fictício"}
      </button>
      {erro && <p role="alert">{erro}</p>}
    </main>
  );
}
