const baseUrl = String(import.meta.env.VITE_DESIGNACOES_API_URL || "").replace(
  /\/$/,
  "",
);
export const designacoesHabilitadas = Boolean(baseUrl);

export async function designacoesRequest(path, body = {}, token) {
  if (!baseUrl)
    throw new Error(
      "O acesso por WhatsApp ainda não foi configurado neste ambiente.",
    );
  if (!navigator.onLine)
    throw new Error("Sem internet. Conecte-se e tente salvar novamente.");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error("O serviço está temporariamente indisponível. Tente novamente em instantes.");
    error.code = response.ok ? 502 : response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(
      result.error || "Não foi possível salvar. Tente novamente.",
    );
    error.code = response.status;
    throw error;
  }
  return result;
}
