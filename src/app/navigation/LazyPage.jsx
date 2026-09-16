import React, { Suspense } from 'react';

export function LazyPage({ children }) {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-gray-100">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <span className="text-blue-600 font-semibold text-sm animate-pulse">Abrindo tela...</span>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
