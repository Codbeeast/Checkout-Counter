'use client'

import React from 'react'

export default function NotFoundPage() {
  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center text-slate-100">
      <h1 className="text-9xl font-extrabold tracking-widest text-cyan-400 select-none drop-shadow-[0_0_35px_rgba(34,211,238,0.4)]">
        404
      </h1>
      <p className="mt-4 text-xl sm:text-2xl font-medium text-slate-300">
        Page Not Found
      </p>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <a
        href="https://onnxpay.com"
        className="mt-8 px-6 py-3 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-sm hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] inline-block"
      >
        Go Home
      </a>
    </main>
  )
}




