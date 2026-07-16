"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cicopal-surface px-4">
      <section className="w-full max-w-xl rounded-md border border-red-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase text-cicopal-red">Erro no tablet</p>
        <h1 className="mt-2 text-2xl font-black text-gray-950">Nao foi possivel carregar a tela.</h1>
        <p className="mt-2 text-sm font-semibold text-gray-600">
          Atualize a pagina. Se repetir, envie uma foto desta mensagem para identificarmos o ponto exato.
        </p>
        <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-gray-950 p-3 text-xs font-semibold text-white">
          {error?.message ?? "Erro sem detalhe informado pelo navegador."}
        </pre>
        <button
          type="button"
          className="mt-4 min-h-12 rounded-md bg-cicopal-blue px-4 font-bold text-white"
          onClick={() => reset()}
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}

