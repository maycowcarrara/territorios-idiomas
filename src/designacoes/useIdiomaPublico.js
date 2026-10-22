import { useEffect, useMemo, useState } from "react";
import { criarIdiomaPublico, detectarIdiomaPublico } from "./idiomaPublico";
const idiomaDoNavegador = () =>
  detectarIdiomaPublico(navigator.languages, navigator.language);
export default function useIdiomaPublico() {
  const [idioma, setIdioma] = useState(idiomaDoNavegador);
  useEffect(() => {
    const atualizar = () => setIdioma(idiomaDoNavegador());
    window.addEventListener("languagechange", atualizar);
    return () => window.removeEventListener("languagechange", atualizar);
  }, []);
  return useMemo(() => criarIdiomaPublico(idioma), [idioma]);
}
