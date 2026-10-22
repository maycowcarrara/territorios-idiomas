import { auth } from "./firebase";
import { designacoesRequest } from "./designacoesApi";

export async function adminDesignacoesRequest(path, body = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Entre novamente como administrador.");
  return designacoesRequest(path, body, token);
}
