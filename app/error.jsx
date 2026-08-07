"use client";

export default function Error({ error, reset }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cicopal-surface px-4">
      <section className="w-full max-w-xl rounded-md border border-red-200 bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase text-cicopal-red">Erro no tablet</p>
        <h1 className="mt-2 text-2xl font-black text-gray-950">Nao foi possivel carregar a tela.</h1>
        <p className="mt-2 text-sm font-semibold text-gray-600">
          Atualize a pagina. Se repetir, envie uma foto desta mensagem para identificarmos o ponto exato.
        </p>
        <div className="mt-4 border-l-4 border-cicopal-blue bg-blue-50 p-3"><p className="text-xs font-bold uppercase text-cicopal-blue">CICOPAL · Sistema RG Qualidade</p><p className="mt-1 text-sm font-semibold text-gray-700">Nenhuma informação técnica será exibida nesta tela operacional.</p></div>
        {error?.message ? <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-bold uppercase text-gray-500">Código técnico para suporte</p><p className="mt-1 break-words font-mono text-xs text-gray-700">{error.message}</p>{error.digest ? <p className="mt-1 font-mono text-[11px] text-gray-500">{error.digest}</p> : null}</div> : null}
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
