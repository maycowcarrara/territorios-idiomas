import React from 'react';
import { APP_TITLE, APP_SHORT_NAME, APP_SUBTITLE, APP_ICON_192 } from '../constants/appConstants';

export function AuthStatusScreen({ message = 'Entrando...' }) {
  return (
    <div className="flex items-center justify-center h-[100dvh] bg-gray-100 px-6">
      <div className="w-full max-w-sm bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 animate-fade-in">
        <div className="p-8 text-center">
          <img
            src={APP_ICON_192}
            alt={`Logo ${APP_SHORT_NAME}`}
            className="mx-auto mb-4 h-20 w-20 rounded-2xl shadow-sm"
          />
          <h2 className="text-3xl font-bold text-blue-600 mb-2">{APP_SHORT_NAME}</h2>
          <p className="text-gray-500 mb-8">{APP_SUBTITLE || APP_TITLE}</p>
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <span className="text-blue-600 font-semibold text-sm animate-pulse">{message}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
