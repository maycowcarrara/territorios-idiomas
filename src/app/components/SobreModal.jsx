import React from 'react';
import { ModalFrame } from '../../uiPrimitives';
import { buttonClass } from '../../uiClasses';
import appInfo from '../../version.json';

export const SobreModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const links = [
    { href: '/privacy-policy.html', label: 'Política de Privacidade', emoji: '🔒' },
    { href: '/terms-of-use.html', label: 'Termos de Uso', emoji: '📄' },
    { href: '/account-deletion.html', label: 'Exclusão de Conta', emoji: '👤' },
    { href: '/data-deletion-request.html', label: 'Exclusão de Dados', emoji: '🗑️' }
  ];

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Sobre o app"
      subtitle="Informações, versão atual e documentos importantes."
      size="md"
      accentClass="bg-blue-600"
      footer={(
        <button onClick={onClose} className={buttonClass('primary', 'w-full')}>
          Fechar
        </button>
      )}
    >
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center">
        <p className="text-sm font-bold text-blue-900">Territórios Digitais</p>
        <p className="mt-1 text-xs font-semibold text-blue-700">Versão {appInfo.version}</p>
        <p className="mt-1 text-[11px] text-blue-600/80">{appInfo.buildDate}</p>
      </div>

      <div className="mt-5">
        <h4 className="mb-2 text-sm font-bold text-gray-800">Documentos e privacidade</h4>
        <div className="space-y-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="flex items-center gap-3">
                <span className="text-base">{link.emoji}</span>
                <span>{link.label}</span>
              </span>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-gray-400">Desenvolvido com carinho ❤️</p>
    </ModalFrame>
  );
};
