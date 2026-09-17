import React from 'react';
import { ModalFrame } from '../../uiPrimitives';
import { buttonClass } from '../../uiClasses';
import appInfo from '../../version.json';

export const SobreModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const links = [
    {
      href: '/privacy-policy.html',
      label: 'Política de Privacidade',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 2a1 1 0 00-.707.293l-6 6a1 1 0 00-.293.707V14a3 3 0 003 3h8a3 3 0 003-3V9a1 1 0 00-.293-.707l-6-6A1 1 0 0010 2zm0 6a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      href: '/terms-of-use.html',
      label: 'Termos de Uso',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      href: '/account-deletion.html',
      label: 'Exclusão de Conta',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      href: '/data-deletion-request.html',
      label: 'Exclusão de Dados',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      title="Sobre o app"
      subtitle="Informações, versão atual e documentos importantes."
      size="md"
      accentClass="bg-slate-900"
      footer={(
        <button onClick={onClose} className={buttonClass('secondary', 'w-full')}>
          Fechar
        </button>
      )}
    >
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-center">
        <p className="text-base font-bold text-slate-900">Territórios Digitais</p>
        <p className="mt-1 text-xs font-semibold text-blue-600">Versão {appInfo.version}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{appInfo.buildDate}</p>
      </div>

      <div className="mt-5">
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Documentos e privacidade</h4>
        <div className="space-y-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">{link.icon}</span>
                <span>{link.label}</span>
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] font-medium text-slate-400">Territórios Digitais</p>
    </ModalFrame>
  );
};
