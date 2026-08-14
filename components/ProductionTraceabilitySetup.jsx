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
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
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
        userId: operatorId,
      });
      await reload();
      setLot((current) => ({ ...current, supplierLot: "" }));
      setMessage("Novo lote vigente registrado sem apagar o histórico.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  function inputsForBatch() {
    return (recipe?.receita_insumos ?? []).map((recipeInput) => {
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
        origin: inherited ? "automacao" : "masseira",
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
          Rastreabilidade antes dos controles horários
        </p>
        <h2 className="text-xl font-black">Insumos, bateladas e máquinas</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {[
            ["lots", "Automação"],
            ["batches", "Masseira · Bateladas"],
            ["packers", "Empacotadoras"],
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
            <div className="mb-4 border-l-4 border-cicopal-blue bg-blue-50 p-4">
              <b className="block text-cicopal-blue">Farinha + Açúcar são obrigatórios em conjunto</b>
              <p className="mt-1 text-sm font-semibold text-gray-600">Os dois lotes precisam estar vigentes. O formulário registra a entrada ou troca de cada um sem substituir o outro.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["FARINHA", "ACUCAR"].map((code) => {
                const supply = supplies.find((item) => item.codigo === code);
                const current = activeLots.find(
                  (item) => item.insumo_id === supply?.id,
                );
                return (
                  <article
                    key={code}
                    className={`border-l-4 p-4 ${current ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}
                  >
                    <b className="text-lg">{supply?.nome ?? code}</b>
                    {current ? (
                      <>
                        <p className="font-black">
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
                      <p className="font-bold text-red-700">
                        Nenhum lote vigente
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <select
                value={lot.supplyId}
                onChange={(e) =>
                  setLot((v) => ({ ...v, supplyId: e.target.value }))
                }
                className="min-h-14 border px-3 font-bold"
              >
                <option value="">Qual lote será registrado ou trocado agora?</option>
                {supplies
                  .filter((item) => ["FARINHA", "ACUCAR"].includes(item.codigo))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
              </select>
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
              disabled={saving}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 bg-cicopal-blue font-black text-white"
            >
              <Save />
              Registrar troca de lote
            </button>
          </div>
        ) : null}
        {tab === "batches" ? (
          <div>
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
                      <b>{supply.nome}</b>
                      <small className="font-black uppercase text-gray-500">
                        {inherited
                          ? "Herdado da Automação"
                          : "Adicionado na Masseira"}
                      </small>
                    </div>
                    {inherited ? (
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
              disabled={saving || activeLots.length < 2}
              className="mt-4 flex min-h-16 w-full items-center justify-center gap-2 bg-green-600 text-lg font-black text-white disabled:bg-gray-300"
            >
              <PackagePlus />
              Adicionar e finalizar batelada
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
            <p className="mb-3 font-semibold text-gray-600">
              Dados fictícios iniciais. Configure quais máquinas estão ativas, a
              gramatura e quantos pacotes cabem por caixa.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {packers.map((item, index) => (
                <article
                  key={item.machine}
                  className={`border-l-4 p-4 ${item.active ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50"}`}
                >
                  <label className="flex min-h-12 items-center justify-between">
                    <b className="text-lg">Máquina {item.machine}</b>
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
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
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
                      className="min-h-14 border px-2"
                    />
                    <input
                      type="number"
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
                      className="min-h-14 border px-2"
                    />
                  </div>
                </article>
              ))}
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
        {message ? (
          <p className="mt-4 border-l-4 border-cicopal-blue bg-blue-50 p-3 font-bold">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
