import React, { useEffect, useRef } from "react";

export default function ModalConfirmacaoPublica({
  children,
  idioma,
  ocupado,
  onClose,
  tituloRef,
  titulo,
  descricaoId,
}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    tituloRef.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, [tituloRef]);

  return (
    <dialog
      ref={dialog}
      lang={idioma.locale}
      className="territorio-publico-dialog"
      aria-labelledby="confirmar-devolucao"
      aria-describedby={descricaoId}
      onCancel={(event) => {
        event.preventDefault();
        if (!ocupado) onClose();
      }}
    >
      <div className="tp-dialog-header">
        <div>
          <span className="tp-eyebrow">{idioma.t("confirmationHint")}</span>
          <h2 id="confirmar-devolucao" ref={tituloRef} tabIndex={-1}>
            {titulo}
          </h2>
        </div>
        <button
          type="button"
          className="tp-icon-button"
          aria-label={idioma.t("closeConfirmation")}
          disabled={ocupado}
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="tp-dialog-content">{children}</div>
    </dialog>
  );
}
