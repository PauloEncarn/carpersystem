"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, PackagePlus, Plus, Save } from "lucide-react";
import {
  createBatch,
  finishBatch,
  loadProductionTraceability,
  replaceAutomationLot,
  savePackerConfiguration,
} from "@/lib/productionTraceabilityPersistence";

export function ProductionTraceabilitySetup({ cycle, operatorId, onChange }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("lots");
  const [automationStep, setAutomationStep] = useState(0);
  const [editingLot, setEditingLot] = useState(false);
  const [lotClosure, setLotClosure] = useState({ outcome: "finalizado", problem: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePacker, setActivePacker] = useState(0);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSelected, setBatchSelected] = useState({});
  const [lot, setLot] = useState({
    supplyId: "",
    supplierLot: "",
    supplier: "Fornecedor teste",
    expiry: "2027-12-31",
  });
  const [batchInputs, setBatchInputs] = useState({});
  const [packers, setPackers] = useState(
    Array.from({ length: 4 }, (_, index) => ({
      machine: index + 1,
      active: index < 3,
      grammage: index === 0 ? "90" : index < 3 ? "600" : "",
      packagesPerBox: index === 0 ? "40" : "12",
    })),
  );
  async function reload() {
    const result = await loadProductionTraceability(cycle.id);
    setData(result);
    onChange?.(result);
    return result;
  }
  useEffect(() => {
    reload().catch((error) => setMessage(error.message));
  }, [cycle.id]);
  const activeLots = useMemo(
    () => (data?.lots ?? []).filter((item) => !item.encerrado_em),
    [data],
  );
  const recipe =
    data?.recipes?.find((item) => item.produto === cycle.product) ??
    data?.recipes?.[0];
  const supplies = data?.supplies ?? [];
  async function saveLot() {
    if (!lot.supplyId || !lot.supplierLot || !lot.supplier || !lot.expiry)
      return setMessage("Preencha insumo, lote, fornecedor e validade.");
    setSaving(true);
    try {
      await replaceAutomationLot({
        cycleId: cycle.id,
        ...lot,
        closureOutcome: lotClosure.outcome,
        closureProblem: lotClosure.problem,
        userId: operatorId,
      });
      await reload();
      setLot((current) => ({ ...current, supplierLot: "" }));
      setEditingLot(false);
      if (automationStep === 0) setAutomationStep(1);
      else setTab("mixer");
      setMessage("Novo lote vigente registrado sem apagar o histórico.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  async function saveMixerSupply(supply) {
    const input = batchInputs[supply.id] ?? {};
    if (!input.lot || !input.expiry) return setMessage(`Informe lote e validade de ${supply.nome}.`);
    setSaving(true);
    try {
      await replaceAutomationLot({ cycleId: cycle.id, supplyId: supply.id, supplierLot: input.lot, supplier: input.supplier || "Interno", expiry: input.expiry, userId: operatorId });
      await reload();
      setMessage(`${supply.nome}: lote disponível para as próximas bateladas.`);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }
  function inputsForBatch() {
    return (recipe?.receita_insumos ?? []).filter((recipeInput) => batchSelected[recipeInput.insumos.id] !== false).map((recipeInput) => {
      const supply = recipeInput.insumos;
      const inherited = activeLots.find((item) => item.insumo_id === supply.id);
      const manual = batchInputs[supply.id] ?? {};
      return {
        supplyId: supply.id,
        automationLotId: inherited?.id,
        lot: inherited?.lote_fornecedor ?? manual.lot,
        supplier: inherited?.fornecedor ?? manual.supplier ?? "Interno",
        expiry: inherited?.validade ?? manual.expiry,
        expected: recipeInput.quantidade,
        used: manual.used ?? recipeInput.quantidade,
        unit: recipeInput.unidade,
        origin: ["FARINHA", "ACUCAR"].includes(supply.codigo) ? "automacao" : "masseira",
      };
    });
  }
  async function addBatch() {
    const inputs = inputsForBatch();
    if (inputs.some((item) => !item.lot || !item.expiry))
      return setMessage("Informe lote e validade de todos os insumos.");
    setSaving(true);
    try {
      const batch = await createBatch({
        cycleId: cycle.id,
        recipeId: recipe?.id,
        inputs,
        userId: operatorId,
      });
      await finishBatch(batch.id, operatorId);
      await reload();
      setBatchOpen(false);
      setMessage(
        `Batelada ${batch.numero} iniciada e finalizada com horário registrado.`,
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  async function savePackers() {
    setSaving(true);
    try {
      await savePackerConfiguration(cycle.id, packers, operatorId);
      await reload();
      setMessage("Configuração das quatro empacotadoras atualizada.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  if (!data) return <div className="min-h-40 animate-pulse bg-gray-100" />;
  return (
    <section className="border border-gray-300 bg-white">
      <header className="border-b p-4">
        <p className="text-xs font-black uppercase text-cicopal-blue">
          Configurações da produção
        </p>
        <h2 className="text-xl font-black">Informações por processo</h2>
        <p className="mt-1 text-sm font-semibold text-gray-500">Entre no processo que deseja configurar. Cada informação permanece vinculada à mesma produção.</p>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {[
            ["lots", "Automação"],
            ["mixer", "Masseira"],
            ["packers", "Empacotamento"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`min-h-12 whitespace-nowrap border-b-4 px-4 font-black ${tab === id ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-transparent bg-gray-50 text-gray-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="p-4">
        {tab === "lots" ? (
          <div>
            <div className="mb-5"><p className="text-xs font-black uppercase text-cicopal-blue">Etapa 1 de 3 · Automação</p><h3 className="mt-1 text-2xl font-black">{automationStep === 0 ? "Informe o lote da farinha" : "Informe o lote do açúcar"}</h3><p className="mt-1 font-semibold text-gray-500">O lote ficará vigente até que uma troca seja registrada.</p></div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {["Farinha", "Açúcar"].map((label, index) => <button key={label} type="button" onClick={() => { setAutomationStep(index); setEditingLot(false); }} className={`min-h-14 font-black ${automationStep === index ? "bg-cicopal-blue text-white" : "bg-gray-100 text-gray-500"}`}>{index + 1}. {label}</button>)}
            </div>
            <div>
              {["FARINHA", "ACUCAR"].map((code, index) => {
                if (index !== automationStep) return null;
                const supply = supplies.find((item) => item.codigo === code);
                const current = activeLots.find(
                  (item) => item.insumo_id === supply?.id,
                );
                return (
                  <article
                    key={code}
                    className={`p-5 ${current ? "bg-green-50" : "bg-amber-50"}`}
                  >
                    <small className="font-black uppercase text-gray-500">Lote vigente</small><b className="mt-1 block text-2xl">{supply?.nome ?? code}</b>
                    {current ? (
                      <>
                        <p className="mt-2 text-xl font-black">
                          Lote {current.lote_fornecedor}
                        </p>
                        <small>
                          {current.fornecedor} · validade{" "}
                          {new Date(
                            `${current.validade}T12:00`,
                          ).toLocaleDateString("pt-BR")}
                        </small>
                      </>
                    ) : (
                        <p className="mt-2 font-bold text-amber-800">
                          Nenhum lote vigente
                        </p>
                    )}
                    <button type="button" onClick={() => { setLot((value) => ({ ...value, supplyId: supply?.id ?? "" })); setEditingLot(true); }} className={`mt-4 min-h-14 w-full font-black ${current ? "border-2 border-cicopal-blue bg-white text-cicopal-blue" : "bg-cicopal-blue text-white"}`}>{current ? "Alterar este lote" : "Registrar lote"}</button>
                  </article>
                );
              })}
            </div>
            {editingLot ? <div className="mt-4 border border-blue-200 bg-white p-4"><p className="mb-3 text-xs font-black uppercase text-gray-500">Como o lote anterior foi encerrado?</p><div className="mb-4 grid gap-2 sm:grid-cols-3">{[["finalizado","Lote finalizado"],["problema","Problema encontrado"],["outro","Outro motivo"]].map(([id,label])=><button key={id} type="button" onClick={()=>setLotClosure({ outcome:id, problem:"" })} className={`min-h-14 p-2 font-black ${lotClosure.outcome===id?"bg-cicopal-blue text-white":"bg-gray-100 text-gray-600"}`}>{label}</button>)}</div>{lotClosure.outcome!=="finalizado"?<textarea value={lotClosure.problem} onChange={(event)=>setLotClosure((current)=>({...current,problem:event.target.value}))} className="mb-4 min-h-24 w-full border-2 border-amber-300 p-3" placeholder={lotClosure.outcome==="problema"?"Qual problema foi encontrado?":"Qual foi o motivo?"}/>:null}<p className="mb-3 text-xs font-black uppercase text-cicopal-blue">Dados do novo lote</p><div className="grid gap-3 sm:grid-cols-2">
              <input
                value={lot.supplierLot}
                onChange={(e) =>
                  setLot((v) => ({ ...v, supplierLot: e.target.value }))
                }
                className="min-h-14 border px-3"
                placeholder="Lote do fornecedor"
              />
              <input
                value={lot.supplier}
                onChange={(e) =>
                  setLot((v) => ({ ...v, supplier: e.target.value }))
                }
                className="min-h-14 border px-3"
                placeholder="Fornecedor"
              />
              <input
                type="date"
                value={lot.expiry}
                onChange={(e) =>
                  setLot((v) => ({ ...v, expiry: e.target.value }))
                }
                className="min-h-14 border px-3"
              />
            </div>
            <button
              onClick={saveLot}
              disabled={saving || (lotClosure.outcome !== "finalizado" && !lotClosure.problem.trim())}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 bg-cicopal-blue font-black text-white"
            >
              <Save />
              Confirmar novo lote
            </button>
            <button type="button" onClick={() => setEditingLot(false)} className="mt-2 min-h-12 w-full font-bold text-gray-600">Cancelar</button></div> : null}
          </div>
        ) : null}
        {tab === "mixer" ? (
          <div>
            <div className="mb-5"><p className="text-xs font-black uppercase text-cicopal-blue">Etapa 2 de 3 · Masseira</p><h3 className="mt-1 text-2xl font-black">Insumos específicos da receita</h3><p className="mt-1 font-semibold text-gray-500">Farinha e açúcar são herdados da Automação. Informe os demais lotes usados nesta preparação.</p></div>
            <div className="mb-4 grid gap-2 sm:grid-cols-2">{activeLots.filter((lotItem)=>!["FARINHA","ACUCAR"].includes(lotItem.insumos?.codigo)).map((lotItem)=><article key={lotItem.id} className="bg-green-50 p-3"><small className="font-black uppercase text-green-700">Disponível</small><b className="block">{lotItem.insumos?.nome}</b><span className="text-sm font-semibold">Lote {lotItem.lote_fornecedor} · {lotItem.validade}</span></article>)}</div>
            <div className="space-y-3">{(recipe?.receita_insumos ?? []).filter((item) => !activeLots.some((lotItem) => lotItem.insumo_id === item.insumos.id)).map((item) => { const supply=item.insumos; return <article key={supply.id} className="bg-gray-50 p-4"><b className="text-lg">{supply.nome}</b><div className="mt-3 grid gap-2 sm:grid-cols-2"><input placeholder="Lote" value={batchInputs[supply.id]?.lot ?? ""} onChange={(e)=>setBatchInputs((all)=>({...all,[supply.id]:{...all[supply.id],lot:e.target.value}}))} className="min-h-16 border px-3 text-lg font-bold"/><input type="date" value={batchInputs[supply.id]?.expiry ?? "2027-12-31"} onChange={(e)=>setBatchInputs((all)=>({...all,[supply.id]:{...all[supply.id],expiry:e.target.value}}))} className="min-h-16 border px-3 text-lg font-bold"/></div><button type="button" disabled={saving} onClick={()=>saveMixerSupply(supply)} className="mt-3 min-h-14 w-full bg-cicopal-blue font-black text-white">Cadastrar lote para bateladas</button></article>;})}</div>
            <button type="button" onClick={() => setBatchOpen(true)} className="mt-4 min-h-16 w-full bg-cicopal-blue text-lg font-black text-white">Continuar para o fluxo da produção</button>
          </div>
        ) : null}
        {batchOpen ? (
          <div className="mt-5 border-t-4 border-cicopal-blue pt-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-cicopal-blue">Fluxo da produção · sem frequência horária</p><h3 className="mt-1 text-2xl font-black">Nova batelada</h3><p className="mt-1 font-semibold text-gray-500">Escolha os insumos e informe quanto será utilizado neste preparo.</p></div><button type="button" onClick={()=>setBatchOpen(false)} className="grid size-12 shrink-0 place-items-center bg-gray-100 font-black">×</button></div>
            <div className="mb-4 flex items-start justify-between gap-3 bg-blue-50 p-4">
              <div>
                <small className="font-black uppercase text-cicopal-blue">
                  Receita vigente · versão {recipe?.versao}
                </small>
                <h3 className="text-xl font-black">{cycle.product}</h3>
              </div>
              <span className="font-black">
                {data.batches.length} batelada(s)
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(recipe?.receita_insumos ?? []).map((item) => {
                const supply = item.insumos;
                const inherited = activeLots.find(
                  (lotItem) => lotItem.insumo_id === supply.id,
                );
                return (
                  <article key={supply.id} className="border p-3">
                    <div className="flex justify-between">
                      <label className="flex min-h-10 items-center gap-3"><input type="checkbox" className="size-6" checked={batchSelected[supply.id] !== false} onChange={(event)=>setBatchSelected((current)=>({...current,[supply.id]:event.target.checked}))}/><b>{supply.nome}</b></label>
                      <small className="font-black uppercase text-gray-500">
                        {inherited
                          ? "Herdado da Automação"
                          : "Adicionado na Masseira"}
                      </small>
                    </div>
                    {batchSelected[supply.id] === false ? <p className="mt-2 font-bold text-gray-400">Não será utilizado nesta batelada</p> : inherited ? (
                      <p className="mt-2 font-bold">
                        Lote {inherited.lote_fornecedor} · {inherited.validade}
                      </p>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          placeholder="Lote"
                          value={batchInputs[supply.id]?.lot ?? ""}
                          onChange={(e) =>
                            setBatchInputs((all) => ({
                              ...all,
                              [supply.id]: {
                                ...all[supply.id],
                                lot: e.target.value,
                              },
                            }))
                          }
                          className="min-h-12 border px-2"
                        />
                        <input
                          type="date"
                          value={batchInputs[supply.id]?.expiry ?? "2027-12-31"}
                          onChange={(e) =>
                            setBatchInputs((all) => ({
                              ...all,
                              [supply.id]: {
                                ...all[supply.id],
                                expiry: e.target.value,
                              },
                            }))
                          }
                          className="min-h-12 border px-2"
                        />
                      </div>
                    )}
                    <label className="mt-2 flex items-center border">
                      <span className="px-2 text-xs font-black">UTILIZADO</span>
                      <input
                        type="number"
                        value={
                          batchInputs[supply.id]?.used ?? item.quantidade ?? ""
                        }
                        onChange={(e) =>
                          setBatchInputs((all) => ({
                            ...all,
                            [supply.id]: {
                              ...all[supply.id],
                              used: e.target.value,
                            },
                          }))
                        }
                        className="min-h-12 min-w-0 flex-1 px-2 font-black"
                      />
                      <b className="px-2">{item.unidade}</b>
                    </label>
                  </article>
                );
              })}
            </div>
            <button
              onClick={addBatch}
              disabled={saving || activeLots.length < 2 || inputsForBatch().length === 0}
              className="mt-4 flex min-h-16 w-full items-center justify-center gap-2 bg-green-600 text-lg font-black text-white disabled:bg-gray-300"
            >
              <PackagePlus />
              Iniciar nova batelada
            </button>
            <div className="mt-4 space-y-2">
              {data.batches.map((batch) => (
                <article
                  key={batch.id}
                  className="flex items-center justify-between border-l-4 border-green-500 bg-green-50 p-3"
                >
                  <span>
                    <b className="block">Batelada {batch.numero}</b>
                    <small>
                      {new Date(batch.iniciada_em).toLocaleString("pt-BR")} →{" "}
                      {batch.finalizada_em
                        ? new Date(batch.finalizada_em).toLocaleString("pt-BR")
                        : "em preparação"}
                    </small>
                  </span>
                  <Check className="text-green-700" />
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {tab === "packers" ? (
          <div>
            <div className="mb-4 border-l-4 border-cicopal-blue bg-blue-50 p-4"><p className="text-xs font-black uppercase text-cicopal-blue">Empacotamento</p><h3 className="text-xl font-black">Configuração das empacotadoras</h3><p className="mt-1 text-sm font-semibold text-gray-600">As quatro máquinas pertencem a este processo. Configure somente as que estão rodando.</p></div>
            <p className="mb-3 font-semibold text-gray-600">
              Dados fictícios iniciais. Configure quais máquinas estão ativas, a
              gramatura e quantos pacotes cabem por caixa.
            </p>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {packers.map((item, index) => <button key={item.machine} type="button" onClick={() => setActivePacker(index)} className={`min-h-14 font-black ${activePacker === index ? "bg-cicopal-blue text-white" : item.active ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-500"}`}>M{item.machine}</button>)}
            </div>
            <div>
              {packers.map((item, index) => index === activePacker ? (
                <article
                  key={item.machine}
                  className={`border-l-4 p-5 ${item.active ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50"}`}
                >
                  <label className="flex min-h-12 items-center justify-between">
                    <span><small className="block font-black uppercase text-gray-500">Empacotamento</small><b className="text-2xl">Empacotadora {item.machine}</b></span>
                    <input
                      type="checkbox"
                      className="size-7"
                      checked={item.active}
                      onChange={(e) =>
                        setPackers((all) =>
                          all.map((row, i) =>
                            i === index
                              ? { ...row, active: e.target.checked }
                              : row,
                          ),
                        )
                      }
                    />
                  </label>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label><span className="mb-1 block text-xs font-black uppercase text-gray-500">Gramatura (g)</span><input
                      type="number"
                      inputMode="decimal"
                      placeholder="Gramatura"
                      value={item.grammage}
                      onChange={(e) =>
                        setPackers((all) =>
                          all.map((row, i) =>
                            i === index
                              ? { ...row, grammage: e.target.value }
                              : row,
                          ),
                        )
                      }
                      className="min-h-16 w-full border px-3 text-xl font-black"
                    /></label>
                    <label><span className="mb-1 block text-xs font-black uppercase text-gray-500">Pacotes por caixa</span><input
                      type="number"
                      inputMode="numeric"
                      placeholder="Pacotes/caixa"
                      value={item.packagesPerBox}
                      onChange={(e) =>
                        setPackers((all) =>
                          all.map((row, i) =>
                            i === index
                              ? { ...row, packagesPerBox: e.target.value }
                              : row,
                          ),
                        )
                      }
                      className="min-h-16 w-full border px-3 text-xl font-black"
                    /></label>
                  </div>
                </article>
              ) : null)}
            </div>
            <button
              onClick={savePackers}
              disabled={saving}
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 bg-cicopal-blue font-black text-white"
            >
              <Save />
              Salvar configuração vigente
            </button>
          </div>
        ) : null}
        {!batchOpen ? <section className="mt-5 bg-slate-950 p-5 text-white"><p className="text-xs font-black uppercase tracking-wider text-blue-200">Controle por necessidade</p><div className="mt-1 flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-2xl font-black">Controle de bateladas</h3><p className="mt-1 font-semibold text-slate-300">Sem horário fixo · inicie sempre que um novo preparo for realizado.</p></div><button type="button" onClick={()=>setBatchOpen(true)} className="min-h-16 bg-white px-6 text-lg font-black text-cicopal-blue">INICIAR NOVA BATELADA</button></div>{data.batches.length?<p className="mt-4 border-t border-white/20 pt-3 text-sm font-bold text-slate-300">Última: batelada {data.batches[0].numero} · {data.batches[0].finalizada_em?"finalizada":"em preparação"}</p>:null}</section> : null}
        {message ? (
          <p className="mt-4 border-l-4 border-cicopal-blue bg-blue-50 p-3 font-bold">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
