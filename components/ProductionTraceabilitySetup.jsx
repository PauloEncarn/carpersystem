"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, PackagePlus, Plus, Save } from "lucide-react";
import {
  createBatch,
  finishBatch,
  loadProductionTraceability,
  replaceAutomationLot,
  savePackerConfiguration,
  startBatchConsumption,
} from "@/lib/productionTraceabilityPersistence";

export function ProductionTraceabilitySetup({
  cycle,
  operatorId,
  onChange,
  mode = "all",
}) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(
    mode === "pack" ? "packers" : mode === "batch" ? "batch" : "lots",
  );
  const [automationStep, setAutomationStep] = useState(0);
  const [editingLot, setEditingLot] = useState(false);
  const [lotClosure, setLotClosure] = useState({
    outcome: "finalizado",
    problem: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePacker, setActivePacker] = useState(0);
  const [packerChangeReason, setPackerChangeReason] = useState("");
  const [packerEditing, setPackerEditing] = useState(false);
  const [packerEditConfirm, setPackerEditConfirm] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchReview, setBatchReview] = useState(false);
  const [batchSelected, setBatchSelected] = useState({});
  const [mixerStep, setMixerStep] = useState(0);
  const [batchStep, setBatchStep] = useState(0);
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
      active: false,
      grammage: "",
      packagesPerBox: "",
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
  useEffect(() => {
    const lastBatch = data?.batches?.[0];
    if (!lastBatch?.batelada_insumos?.length) return;
    setBatchInputs((current) => {
      const next = { ...current };
      lastBatch.batelada_insumos.forEach((item) => {
        if (next[item.insumo_id]?.used !== undefined) return;
        next[item.insumo_id] = {
          ...next[item.insumo_id],
          used: item.quantidade_utilizada ?? item.quantidade_prevista ?? "",
        };
      });
      return next;
    });
  }, [data?.batches]);
  useEffect(() => {
    if (!data?.packers?.length) return;
    setPackers(
      Array.from({ length: 4 }, (_, index) => {
        const saved = data.packers.find((item) => item.maquina === index + 1);
        return {
          machine: index + 1,
          active: Boolean(saved?.ativa),
          grammage: "",
          packagesPerBox: "",
        };
      }),
    );
  }, [data?.packers]);
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
      setMixerStep(0);
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
    if (!input.lot || !input.expiry)
      return setMessage(`Informe lote e validade de ${supply.nome}.`);
    setSaving(true);
    try {
      await replaceAutomationLot({
        cycleId: cycle.id,
        supplyId: supply.id,
        supplierLot: input.lot,
        supplier: input.supplier || "Interno",
        expiry: input.expiry,
        userId: operatorId,
      });
      await reload();
      setMixerStep(0);
      setMessage(`${supply.nome}: lote disponível para as próximas bateladas.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  function inputsForBatch() {
    return (recipe?.receita_insumos ?? [])
      .filter((recipeInput) => batchSelected[recipeInput.insumos.id] !== false)
      .map((recipeInput) => {
        const supply = recipeInput.insumos;
        const inherited = activeLots.find(
          (item) => item.insumo_id === supply.id,
        );
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
          origin: ["FARINHA", "ACUCAR"].includes(supply.codigo)
            ? "automacao"
            : "masseira",
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
      await reload();
      setBatchOpen(false);
      setBatchReview(false);
      setMessage(
        `Batelada ${batch.numero} em preparação. Finalize o preparo quando a massa estiver pronta.`,
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
      await savePackerConfiguration(
        cycle.id,
        packers,
        operatorId,
        packerChangeReason,
      );
      await reload();
      setPackerChangeReason("");
      setPackerEditing(false);
      setPackerEditConfirm(false);
      setMessage("Configuração das quatro empacotadoras atualizada.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  if (!data) return <div className="min-h-40 animate-pulse bg-gray-100" />;
  const batchTotal = inputsForBatch().reduce(
    (total, item) => total + (Number(item.used) || 0),
    0,
  );
  const activeBatch = data.batches.find(
    (batch) => batch.status === "em_preparacao",
  );
  const consumingBatch = data.batches.find(
    (batch) => batch.status === "em_consumo",
  );
  const readyBatches = data.batches.filter(
    (batch) => batch.status === "pronta",
  );
  async function completePreparation(batchId) {
    setSaving(true);
    try {
      await finishBatch(batchId, operatorId);
      await reload();
      setMessage(
        "Preparo finalizado. A batelada está pronta para entrar em consumo.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  async function consumeBatch(batchId) {
    setSaving(true);
    try {
      await startBatchConsumption(batchId, cycle.id, operatorId);
      await reload();
      setMessage(
        "Batelada em consumo. Os próximos apontamentos serão vinculados a ela.",
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  const recipeInputs = recipe?.receita_insumos ?? [];
  const statusLabel = {
    em_preparacao: "Em preparação",
    pronta: "Pronta",
    em_consumo: "Em consumo",
    consumida: "Consumida",
  };
  const batchTone = {
    em_preparacao: "bg-amber-50 text-amber-900",
    pronta: "bg-green-100 text-green-900",
    em_consumo: "bg-blue-100 text-blue-900",
    consumida: "bg-red-100 text-red-900",
  };
  function editSupply(supply) {
    const current = activeLots.find((item) => item.insumo_id === supply.id);
    setLot({
      supplyId: supply.id,
      supplierLot: current?.lote_fornecedor ?? "",
      supplier: current?.fornecedor ?? "Interno",
      expiry: current?.validade ?? "",
    });
    setLotClosure({ outcome: "finalizado", problem: "" });
    setEditingLot(true);
  }
  if (mode === "prep")
    return (
      <section className="border border-slate-200 bg-white">
        <header className="border-b border-slate-200 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-cicopal-blue">
            Preparação
          </p>
          <h2 className="mt-1 text-2xl font-bold">Insumos e bateladas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Os lotes vigentes são reaproveitados até que o operador registre uma
            alteração.
          </p>
        </header>

        <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">
                  Automação e masseira
                </p>
                <h3 className="text-xl font-bold">Insumos vigentes</h3>
              </div>
              <span className="text-sm text-slate-500">
                {activeLots.length}/{recipeInputs.length} cadastrados
              </span>
            </div>
            <div className="divide-y divide-slate-200 border border-slate-200">
              {recipeInputs.map((item) => {
                const supply = item.insumos;
                const current = activeLots.find(
                  (lotItem) => lotItem.insumo_id === supply.id,
                );
                const amount =
                  batchInputs[supply.id]?.used ?? item.quantidade ?? "";
                return (
                  <article
                    key={supply.id}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(140px,1fr)_minmax(170px,1fr)_130px_auto] sm:items-center"
                  >
                    <div>
                      <small className="font-bold uppercase text-slate-400">
                        {["FARINHA", "ACUCAR"].includes(supply.codigo)
                          ? "Automação"
                          : "Masseira"}
                      </small>
                      <b className="block text-base text-slate-900">
                        {supply.nome}
                      </b>
                    </div>
                    <div className="text-sm">
                      {current ? (
                        <>
                          <b className="block">
                            Lote {current.lote_fornecedor}
                          </b>
                          <span className="text-slate-500">
                            Validade{" "}
                            {new Date(
                              `${current.validade}T12:00`,
                            ).toLocaleDateString("pt-BR")}
                          </span>
                        </>
                      ) : (
                        <b className="text-amber-700">Lote não informado</b>
                      )}
                    </div>
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                        Quantidade
                      </span>
                      <div className="flex border border-slate-300 bg-white">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) =>
                            setBatchInputs((all) => ({
                              ...all,
                              [supply.id]: {
                                ...all[supply.id],
                                used: event.target.value,
                              },
                            }))
                          }
                          className="min-h-11 min-w-0 flex-1 px-2 font-bold outline-none"
                        />
                        <span className="grid place-items-center border-l px-2 text-sm font-bold text-slate-500">
                          {item.unidade}
                        </span>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => editSupply(supply)}
                      className={`min-h-11 border px-4 font-bold ${current ? "border-slate-300 bg-white text-cicopal-blue" : "border-cicopal-blue bg-cicopal-blue text-white"}`}
                    >
                      {current ? "Alterar" : "Cadastrar"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <div className="border border-slate-200">
              <div className="border-b border-slate-200 p-4">
                <p className="text-xs font-bold uppercase text-cicopal-blue">
                  Controle de bateladas
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold">
                    {consumingBatch
                      ? `Batelada ${consumingBatch.numero} em consumo`
                      : "Próxima batelada"}
                  </h3>
                  <b className="text-sm text-slate-500">
                    {batchTotal.toLocaleString("pt-BR")} kg
                  </b>
                </div>
              </div>

              {!batchOpen ? (
                <div className="p-4">
                  <p className="text-sm text-slate-600">
                    Ao iniciar, o sistema reutiliza os lotes e as quantidades
                    exibidos ao lado.
                  </p>
                  <button
                    type="button"
                    disabled={
                      saving ||
                      inputsForBatch().some((item) => !item.lot || !item.expiry)
                    }
                    onClick={() => {
                      setBatchOpen(true);
                      setBatchReview(false);
                    }}
                    className="mt-4 min-h-14 w-full bg-cicopal-blue px-4 font-bold text-white disabled:bg-slate-300"
                  >
                    Iniciar nova batelada
                  </button>
                </div>
              ) : !batchReview ? (
                <div className="p-4">
                  <h4 className="text-lg font-bold">Houve alteração?</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Confirme se esta batelada utilizará os mesmos lotes e
                    quantidades.
                  </p>
                  <button
                    type="button"
                    onClick={addBatch}
                    disabled={saving}
                    className="mt-4 min-h-14 w-full bg-green-600 px-4 font-bold text-white"
                  >
                    Não, usar os mesmos dados
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchReview(true)}
                    className="mt-2 min-h-12 w-full border border-slate-300 bg-white px-4 font-bold text-cicopal-blue"
                  >
                    Sim, revisar dados
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchOpen(false)}
                    className="mt-2 min-h-11 w-full text-sm font-bold text-slate-500"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="p-4">
                  <h4 className="font-bold">Revise antes de iniciar</h4>
                  <div className="mt-3 divide-y border border-slate-200">
                    {recipeInputs.map((item) => {
                      const supply = item.insumos;
                      const current = activeLots.find(
                        (lotItem) => lotItem.insumo_id === supply.id,
                      );
                      return (
                        <div key={supply.id} className="p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span>
                              <b className="block">{supply.nome}</b>
                              <span className="text-slate-500">
                                {current
                                  ? `Lote ${current.lote_fornecedor}`
                                  : "Sem lote"}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => editSupply(supply)}
                              className="font-bold text-cicopal-blue"
                            >
                              Alterar lote
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={addBatch}
                    disabled={saving}
                    className="mt-3 min-h-14 w-full bg-green-600 px-4 font-bold text-white"
                  >
                    Confirmar e iniciar batelada
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchReview(false)}
                    className="mt-2 min-h-11 w-full font-bold text-slate-500"
                  >
                    Voltar
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-end justify-between">
                <h3 className="text-lg font-bold">Histórico da produção</h3>
                <span className="text-sm text-slate-500">
                  {data.batches.length} registro(s)
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Batelada</th>
                      <th className="p-3">Início</th>
                      <th className="p-3">Término</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.batches.map((batch) => (
                      <tr
                        key={batch.id}
                        className={batchTone[batch.status] ?? "bg-white"}
                      >
                        <td className="p-3 font-bold">#{batch.numero}</td>
                        <td className="p-3">
                          {new Date(batch.iniciada_em).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">
                          {batch.finalizada_em
                            ? new Date(batch.finalizada_em).toLocaleString(
                                "pt-BR",
                              )
                            : "—"}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex border border-current/20 bg-white/60 px-2 py-1 text-xs font-bold uppercase">
                            {statusLabel[batch.status] ?? batch.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {batch.status === "em_preparacao" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => completePreparation(batch.id)}
                              className="font-bold text-cicopal-blue"
                            >
                              Finalizar
                            </button>
                          ) : batch.status === "pronta" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => consumeBatch(batch.id)}
                              className="font-bold text-green-700"
                            >
                              Iniciar consumo
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                    {!data.batches.length ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-5 text-center text-slate-500"
                        >
                          Nenhuma batelada registrada.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {message ? (
          <p className="border-t border-slate-200 bg-blue-50 p-3 text-sm font-bold text-cicopal-blue">
            {message}
          </p>
        ) : null}

        {editingLot ? (
          <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/60 p-0 sm:grid sm:place-items-center sm:p-4">
            <div className="min-h-dvh bg-white p-5 sm:min-h-0 sm:w-full sm:max-w-xl">
              <p className="text-xs font-bold uppercase text-cicopal-blue">
                Alterar insumo
              </p>
              <h3 className="mt-1 text-2xl font-bold">Dados do lote</h3>
              <div className="mt-5 grid gap-3">
                <input
                  value={lot.supplierLot}
                  onChange={(event) =>
                    setLot((value) => ({
                      ...value,
                      supplierLot: event.target.value,
                    }))
                  }
                  className="min-h-14 border border-slate-300 px-3"
                  placeholder="Lote do fornecedor"
                />
                <input
                  value={lot.supplier}
                  onChange={(event) =>
                    setLot((value) => ({
                      ...value,
                      supplier: event.target.value,
                    }))
                  }
                  className="min-h-14 border border-slate-300 px-3"
                  placeholder="Fornecedor"
                />
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                    Validade
                  </span>
                  <input
                    type="date"
                    value={lot.expiry}
                    onChange={(event) =>
                      setLot((value) => ({
                        ...value,
                        expiry: event.target.value,
                      }))
                    }
                    className="min-h-14 w-full border border-slate-300 px-3"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={saveLot}
                disabled={saving}
                className="mt-4 min-h-14 w-full bg-cicopal-blue px-4 font-bold text-white"
              >
                Salvar lote vigente
              </button>
              <button
                type="button"
                onClick={() => setEditingLot(false)}
                className="mt-2 min-h-12 w-full font-bold text-slate-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  if (mode === "pack") {
    const configured = data.packers.length > 0;
    const runningCount = packers.filter((item) => item.active).length;
    const machinePosition = {
      1: "col-start-2 row-start-1",
      2: "col-start-2 row-start-2",
      3: "col-start-3 row-start-1",
      4: "col-start-1 row-start-2",
    };
    return (
      <section className="border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-cicopal-blue">
              Empacotamento
            </p>
            <h2 className="text-xl font-bold">Empacotadoras</h2>
          </div>
          <b className="text-sm text-slate-600">
            {runningCount} de 4 rodando
          </b>
        </div>

        <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 grid-rows-2 gap-3">
          {packers.map((machine) => (
            <button
              key={machine.machine}
              type="button"
              disabled={configured && !packerEditing}
              onClick={() =>
                setPackers((all) =>
                  all.map((item) =>
                    item.machine === machine.machine
                      ? { ...item, active: !item.active }
                      : item,
                  ),
                )
              }
              className={`${machinePosition[machine.machine]} min-h-24 border-2 p-3 text-left disabled:cursor-default ${machine.active ? "border-green-500 bg-green-50 text-green-900" : "border-slate-300 bg-slate-100 text-slate-500"}`}
            >
              <span className="text-xs font-bold uppercase">Máquina</span>
              <b className="block text-2xl">{machine.machine}</b>
              <span className="mt-2 block text-sm font-bold uppercase">
                {machine.active ? "Rodando" : "Parada"}
              </span>
            </button>
          ))}
        </div>

        {configured && !packerEditing && !packerEditConfirm ? (
          <button
            type="button"
            onClick={() => setPackerEditConfirm(true)}
            className="mx-auto mt-5 block min-h-12 w-full max-w-xl border border-slate-300 bg-white px-4 font-bold text-slate-600"
          >
            Alterar configuração das máquinas
          </button>
        ) : null}

        {configured && packerEditConfirm && !packerEditing ? (
          <div className="mx-auto mt-5 max-w-xl border border-amber-300 bg-amber-50 p-4">
            <b className="text-amber-900">Confirmar edição?</b>
            <p className="mt-1 text-sm text-amber-800">
              Use esta opção somente quando uma máquina iniciar ou parar durante a produção.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPackerEditConfirm(false)}
                className="min-h-12 border border-slate-300 bg-white font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPackerEditConfirm(false);
                  setPackerEditing(true);
                }}
                className="min-h-12 bg-amber-600 font-bold text-white"
              >
                Continuar edição
              </button>
            </div>
          </div>
        ) : null}

        {configured && packerEditing ? (
          <label className="mx-auto mt-5 block max-w-xl">
            <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
              Motivo da alteração
            </span>
            <textarea
              value={packerChangeReason}
              onChange={(event) => setPackerChangeReason(event.target.value)}
              className="min-h-20 w-full border border-slate-300 p-3"
              placeholder="Informe por que a configuração das máquinas mudou"
            />
          </label>
        ) : null}
        {!configured || packerEditing ? (
          <button
            type="button"
            onClick={savePackers}
            disabled={saving || (configured && !packerChangeReason.trim())}
            className="mx-auto mt-3 block min-h-14 w-full max-w-xl bg-cicopal-blue px-4 font-bold text-white disabled:bg-slate-300"
          >
            {configured
              ? "Confirmar alteração"
              : "Confirmar máquinas em operação"}
          </button>
        ) : null}
        {message ? (
          <p className="mx-auto mt-3 max-w-xl bg-blue-50 p-3 text-sm font-bold text-cicopal-blue">
            {message}
          </p>
        ) : null}
      </section>
    );
  }
  return (
    <section className="border border-gray-300 bg-white">
      <header className="border-b p-4">
        <p className="text-xs font-black uppercase text-cicopal-blue">
          {mode === "batch"
            ? "Produção · operação sob demanda"
            : "Configurações da produção"}
        </p>
        <h2 className="text-xl font-black">
          {mode === "batch"
            ? "Controle de bateladas"
            : mode === "prep"
              ? "Preparação"
              : "Informações por processo"}
        </h2>
        <p className="mt-1 text-sm font-semibold text-gray-500">
          {mode === "prep"
            ? "Automação, masseira e bateladas conectadas à mesma produção."
            : "Cada informação permanece vinculada à mesma produção."}
        </p>
        {mode !== "batch" ? (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {[
              ["lots", "Automação"],
              ["mixer", "Masseira"],
              ["batch", "Bateladas"],
              ["packers", "Empacotamento"],
            ]
              .filter(
                ([id]) =>
                  mode === "all" ||
                  (mode === "prep" &&
                    ["lots", "mixer", "batch"].includes(id)) ||
                  (mode === "pack" && id === "packers"),
              )
              .map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`min-h-12 whitespace-nowrap border-b-4 px-4 font-black ${tab === id ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-transparent bg-gray-50 text-gray-600"}`}
                >
                  {label}
                </button>
              ))}
          </div>
        ) : null}
      </header>
      <div className="p-4">
        {tab === "lots" ? (
          <div>
            <div className="mb-5">
              <p className="text-xs font-black uppercase text-cicopal-blue">
                Etapa 1 de 3 · Automação
              </p>
              <h3 className="mt-1 text-2xl font-black">
                {automationStep === 0
                  ? "Informe o lote da farinha"
                  : "Informe o lote do açúcar"}
              </h3>
              <p className="mt-1 font-semibold text-gray-500">
                O lote ficará vigente até que uma troca seja registrada.
              </p>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {["Farinha", "Açúcar"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setAutomationStep(index);
                    setEditingLot(false);
                  }}
                  className={`min-h-14 font-black ${automationStep === index ? "bg-cicopal-blue text-white" : "bg-gray-100 text-gray-500"}`}
                >
                  {index + 1}. {label}
                </button>
              ))}
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
                    <small className="font-black uppercase text-gray-500">
                      Lote vigente
                    </small>
                    <b className="mt-1 block text-2xl">
                      {supply?.nome ?? code}
                    </b>
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
                    <button
                      type="button"
                      onClick={() => {
                        setLot((value) => ({
                          ...value,
                          supplyId: supply?.id ?? "",
                        }));
                        setEditingLot(true);
                      }}
                      className={`mt-4 min-h-14 w-full font-black ${current ? "border-2 border-cicopal-blue bg-white text-cicopal-blue" : "bg-cicopal-blue text-white"}`}
                    >
                      {current ? "Alterar este lote" : "Registrar lote"}
                    </button>
                  </article>
                );
              })}
            </div>
            {editingLot ? (
              <div className="fixed inset-0 z-[100] overflow-y-auto bg-white p-4 sm:p-8">
                <div className="mx-auto max-w-2xl">
                  <p className="mb-3 text-xs font-black uppercase text-gray-500">
                    Como o lote anterior foi encerrado?
                  </p>
                  <div className="mb-4 grid gap-2 sm:grid-cols-3">
                    {[
                      ["finalizado", "Lote finalizado"],
                      ["problema", "Problema encontrado"],
                      ["outro", "Outro motivo"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setLotClosure({ outcome: id, problem: "" })
                        }
                        className={`min-h-14 p-2 font-black ${lotClosure.outcome === id ? "bg-cicopal-blue text-white" : "bg-gray-100 text-gray-600"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {lotClosure.outcome !== "finalizado" ? (
                    <textarea
                      value={lotClosure.problem}
                      onChange={(event) =>
                        setLotClosure((current) => ({
                          ...current,
                          problem: event.target.value,
                        }))
                      }
                      className="mb-4 min-h-24 w-full border-2 border-amber-300 p-3"
                      placeholder={
                        lotClosure.outcome === "problema"
                          ? "Qual problema foi encontrado?"
                          : "Qual foi o motivo?"
                      }
                    />
                  ) : null}
                  <p className="mb-3 text-xs font-black uppercase text-cicopal-blue">
                    Dados do novo lote
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    disabled={
                      saving ||
                      (lotClosure.outcome !== "finalizado" &&
                        !lotClosure.problem.trim())
                    }
                    className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 bg-cicopal-blue font-black text-white"
                  >
                    <Save />
                    Confirmar novo lote
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingLot(false)}
                    className="mt-2 min-h-12 w-full font-bold text-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {tab === "mixer" ? (
          <div>
            <div className="mb-5">
              <p className="text-xs font-black uppercase text-cicopal-blue">
                Etapa 2 de 3 · Masseira
              </p>
              <h3 className="mt-1 text-2xl font-black">
                Insumos específicos da receita
              </h3>
              <p className="mt-1 font-semibold text-gray-500">
                Farinha e açúcar são herdados da Automação. Informe os demais
                lotes usados nesta preparação.
              </p>
            </div>
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {activeLots
                .filter(
                  (lotItem) =>
                    !["FARINHA", "ACUCAR"].includes(lotItem.insumos?.codigo),
                )
                .map((lotItem) => (
                  <article key={lotItem.id} className="bg-green-50 p-3">
                    <small className="font-black uppercase text-green-700">
                      Disponível
                    </small>
                    <b className="block">{lotItem.insumos?.nome}</b>
                    <span className="text-sm font-semibold">
                      Lote {lotItem.lote_fornecedor} · {lotItem.validade}
                    </span>
                  </article>
                ))}
            </div>
            <div className="space-y-3">
              {(recipe?.receita_insumos ?? [])
                .filter(
                  (item) =>
                    !activeLots.some(
                      (lotItem) => lotItem.insumo_id === item.insumos.id,
                    ),
                )
                .slice(mixerStep, mixerStep + 1)
                .map((item) => {
                  const supply = item.insumos;
                  return (
                    <article key={supply.id} className="bg-gray-50 p-4">
                      <b className="text-lg">{supply.nome}</b>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                          className="min-h-16 border px-3 text-lg font-bold"
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
                          className="min-h-16 border px-3 text-lg font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveMixerSupply(supply)}
                        className="mt-3 min-h-14 w-full bg-cicopal-blue font-black text-white"
                      >
                        Cadastrar lote para bateladas
                      </button>
                    </article>
                  );
                })}
            </div>
            <p className="mt-3 text-center text-sm font-black text-gray-500">
              Um insumo por vez · os cadastrados saem automaticamente da fila
            </p>
            {(recipe?.receita_insumos ?? []).every((item) =>
              activeLots.some(
                (lotItem) => lotItem.insumo_id === item.insumos.id,
              ),
            ) ? (
              <button
                type="button"
                onClick={() => setTab("batch")}
                className="mt-4 min-h-14 w-full bg-cicopal-blue px-4 font-black text-white"
              >
                Continuar para controle de bateladas
              </button>
            ) : null}
          </div>
        ) : null}
        {batchOpen ? (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <div>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-cicopal-blue">
                    Fluxo da produção · sem frequência horária
                  </p>
                  <h3 className="mt-1 text-2xl font-black">Nova batelada</h3>
                  <p className="mt-1 font-semibold text-gray-500">
                    Escolha os insumos e informe quanto será utilizado neste
                    preparo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBatchOpen(false)}
                  className="grid size-12 shrink-0 place-items-center bg-gray-100 font-black"
                >
                  ×
                </button>
              </div>
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
                {(recipe?.receita_insumos ?? []).map((item, itemIndex) => {
                  if (itemIndex !== batchStep) return null;
                  const supply = item.insumos;
                  const inherited = activeLots.find(
                    (lotItem) => lotItem.insumo_id === supply.id,
                  );
                  return (
                    <article key={supply.id} className="border p-3">
                      <div className="flex justify-between">
                        <label className="flex min-h-10 items-center gap-3">
                          <input
                            type="checkbox"
                            className="size-6"
                            checked={batchSelected[supply.id] !== false}
                            onChange={(event) =>
                              setBatchSelected((current) => ({
                                ...current,
                                [supply.id]: event.target.checked,
                              }))
                            }
                          />
                          <b>{supply.nome}</b>
                        </label>
                        <small className="font-black uppercase text-gray-500">
                          {inherited
                            ? "Herdado da Automação"
                            : "Adicionado na Masseira"}
                        </small>
                      </div>
                      {batchSelected[supply.id] === false ? (
                        <p className="mt-2 font-bold text-gray-400">
                          Não será utilizado nesta batelada
                        </p>
                      ) : inherited ? (
                        <p className="mt-2 font-bold">
                          Lote {inherited.lote_fornecedor} ·{" "}
                          {inherited.validade}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBatchOpen(false);
                            setTab("mixer");
                          }}
                          className="mt-2 min-h-14 w-full bg-amber-50 px-3 text-left font-black text-amber-900"
                        >
                          Lote ainda não cadastrado · abrir Masseira
                        </button>
                      )}
                      {batchSelected[supply.id] !== false && inherited ? (
                        <label className="mt-2 flex items-center border">
                          <span className="px-2 text-xs font-black">
                            UTILIZADO
                          </span>
                          <input
                            type="number"
                            value={
                              batchInputs[supply.id]?.used ??
                              item.quantidade ??
                              ""
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
                      ) : null}
                    </article>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                <button
                  type="button"
                  disabled={batchStep === 0}
                  onClick={() =>
                    setBatchStep((value) => Math.max(0, value - 1))
                  }
                  className="min-h-16 border border-gray-300 px-5 font-black disabled:opacity-30"
                >
                  Voltar
                </button>
                <button
                  onClick={() =>
                    batchStep < (recipe?.receita_insumos?.length ?? 1) - 1
                      ? setBatchStep((value) => value + 1)
                      : addBatch()
                  }
                  disabled={
                    saving ||
                    activeLots.length < 2 ||
                    inputsForBatch().length === 0
                  }
                  className="flex min-h-16 w-full items-center justify-center gap-2 bg-green-600 text-lg font-black text-white disabled:bg-gray-300"
                >
                  <PackagePlus />
                  {batchStep < (recipe?.receita_insumos?.length ?? 1) - 1
                    ? "Continuar"
                    : "Iniciar nova batelada"}
                </button>
              </div>
              <div
                className={`mt-3 flex items-center justify-between p-4 ${Math.abs(batchTotal - 900) <= 5 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
              >
                <span>
                  <small className="block font-black uppercase">
                    Peso da nova batelada
                  </small>
                  <b className="text-2xl">
                    {batchTotal.toLocaleString("pt-BR")} kg
                  </b>
                </span>
                <span className="text-right text-sm font-black">
                  Referência: 900 kg
                  <br />
                  Diferença: {(batchTotal - 900).toLocaleString("pt-BR")} kg
                </span>
              </div>
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
                          ? new Date(batch.finalizada_em).toLocaleString(
                              "pt-BR",
                            )
                          : "preparo em andamento"}
                      </small>
                      <small className="mt-1 block font-black uppercase text-cicopal-blue">
                        {batch.status.replaceAll("_", " ")}
                      </small>
                    </span>
                    {batch.status === "em_preparacao" ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => completePreparation(batch.id)}
                        className="min-h-12 bg-cicopal-blue px-3 font-black text-white"
                      >
                        Finalizar preparo
                      </button>
                    ) : batch.status === "pronta" ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => consumeBatch(batch.id)}
                        className="min-h-12 bg-green-600 px-3 font-black text-white"
                      >
                        Iniciar consumo
                      </button>
                    ) : (
                      <Check className="text-green-700" />
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {tab === "packers" ? (
          <div>
            <div className="mb-4 border-l-4 border-cicopal-blue bg-blue-50 p-4">
              <p className="text-xs font-black uppercase text-cicopal-blue">
                Empacotamento
              </p>
              <h3 className="text-xl font-black">
                Configuração das empacotadoras
              </h3>
              <p className="mt-1 text-sm font-semibold text-gray-600">
                As quatro máquinas pertencem a este processo. Configure somente
                as que estão rodando.
              </p>
            </div>
            <p className="mb-3 font-semibold text-gray-600">
              Dados fictícios iniciais. Configure quais máquinas estão ativas, a
              gramatura e quantos pacotes cabem por caixa.
            </p>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {packers.map((item, index) => (
                <button
                  key={item.machine}
                  type="button"
                  onClick={() => setActivePacker(index)}
                  className={`min-h-14 font-black ${activePacker === index ? "bg-cicopal-blue text-white" : item.active ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-500"}`}
                >
                  M{item.machine}
                </button>
              ))}
            </div>
            <div>
              {packers.map((item, index) =>
                index === activePacker ? (
                  <article
                    key={item.machine}
                    className={`border-l-4 p-5 ${item.active ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50"}`}
                  >
                    <label className="flex min-h-12 items-center justify-between">
                      <span>
                        <small className="block font-black uppercase text-gray-500">
                          Empacotamento
                        </small>
                        <b className="text-2xl">Empacotadora {item.machine}</b>
                      </span>
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
                      <label>
                        <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                          Gramatura (g)
                        </span>
                        <input
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
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-black uppercase text-gray-500">
                          Pacotes por caixa
                        </span>
                        <input
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
                        />
                      </label>
                    </div>
                  </article>
                ) : null,
              )}
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
        {(mode === "batch" || (mode === "prep" && tab === "batch")) &&
        !batchOpen ? (
          <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-light text-slate-500">
              Controle por necessidade
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black">
                  {consumingBatch
                    ? `Batelada ${consumingBatch.numero} em consumo`
                    : "Nenhuma batelada em consumo"}
                </h3>
                <p className="mt-1 font-light text-slate-500">
                  {activeBatch
                    ? `Batelada ${activeBatch.numero} em preparação`
                    : readyBatches.length
                      ? `${readyBatches.length} batelada(s) pronta(s) aguardando`
                      : "Inicie um novo preparo quando necessário."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchOpen(true)}
                className="min-h-14 bg-cicopal-blue px-6 text-base font-bold text-white"
              >
                INICIAR NOVA BATELADA
              </button>
            </div>
            {consumingBatch ? (
              <p className="mt-4 border-t border-slate-200 pt-3 text-sm font-bold text-green-700">
                Em consumo desde{" "}
                {new Date(
                  consumingBatch.consumo_iniciado_em ??
                    consumingBatch.iniciada_em,
                ).toLocaleString("pt-BR")}
              </p>
            ) : null}
          </section>
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
