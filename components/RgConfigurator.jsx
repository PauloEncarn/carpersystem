"use client";

import { useMemo, useState } from "react";
import {
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Factory,
  FileCog,
  FileText,
  Layers3,
  Plus,
  Settings2,
  Trash2
} from "lucide-react";

const menus = [
  { id: "rg", label: "RG", icon: FileText },
  { id: "processo", label: "Processo", icon: ClipboardList },
  { id: "componente", label: "Componente", icon: Layers3 }
];

const processTypes = [
  { id: "higienizacao", label: "Higienizacao", prefix: "HIG" },
  { id: "produto_liberacao", label: "Liberacao do Produto", prefix: "LIBP" },
  { id: "produto_avaliacao", label: "Avaliacao do Produto", prefix: "AVP" },
  { id: "processo", label: "RG - Processo", prefix: "RGP" },
  { id: "fotografico", label: "Registro Fotografico", prefix: "REGF" }
];

const fieldTypes = [
  { id: "c_nc", label: "C / NC" },
  { id: "numero", label: "Numero" },
  { id: "percentual", label: "%" },
  { id: "temperatura", label: "deg C" },
  { id: "texto", label: "Texto" },
  { id: "hora", label: "Hora" },
  { id: "foto", label: "Foto" },
  { id: "assinatura", label: "Assinatura" }
];

const frequencies = ["Por registro", "Por setup", "Por horario liberado", "Hora em hora", "Turno"];

const initialRgs = [
  {
    id: "rg-005",
    code: "RG.QUA.005",
    title: "Controle de Liberacao de Produto",
    revision: "02",
    linkedLines: ["PUR"],
    processes: [
      {
        id: "proc-1",
        type: "higienizacao",
        name: "RG - Higienizacao",
        frequency: "Por setup",
        fields: [
          { id: "field-1", name: "Equipamento / area", type: "c_nc", required: true, nc: true },
          { id: "field-2", name: "Horario do desvio", type: "hora", required: false, nc: true },
          { id: "field-3", name: "Acao corretiva", type: "texto", required: false, nc: true }
        ]
      },
      {
        id: "proc-2",
        type: "produto_avaliacao",
        name: "Avaliacao do Produto",
        frequency: "Hora em hora",
        fields: [
          { id: "field-4", name: "Umidade produto final", type: "percentual", required: true, nc: false },
          { id: "field-5", name: "Sal", type: "percentual", required: true, nc: false },
          { id: "field-6", name: "Temperatura de envase", type: "temperatura", required: true, nc: false }
        ]
      }
    ]
  }
];

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function FieldLabel({ children }) {
  return <span className="mb-1 block text-xs font-bold uppercase text-gray-500">{children}</span>;
}

function ConfigInput(props) {
  return <input {...props} className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" />;
}

function ConfigSelect(props) {
  return <select {...props} className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold" />;
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-950">{value}</p>
    </div>
  );
}

function fieldTypeLabel(type) {
  return fieldTypes.find((item) => item.id === type)?.label ?? type;
}

export function RgConfigurator({ lines }) {
  const [activeMenu, setActiveMenu] = useState("rg");
  const [rgs, setRgs] = useState(initialRgs);
  const [selectedRgId, setSelectedRgId] = useState(initialRgs[0].id);
  const [selectedProcessId, setSelectedProcessId] = useState(initialRgs[0].processes[0].id);

  const selectedRg = rgs.find((rg) => rg.id === selectedRgId) ?? rgs[0];
  const selectedProcess =
    selectedRg?.processes.find((process) => process.id === selectedProcessId) ?? selectedRg?.processes[0];

  const linkedLineNames = useMemo(() => {
    if (!selectedRg) return [];
    return lines.filter((line) => selectedRg.linkedLines.includes(line.id)).map((line) => line.nome);
  }, [lines, selectedRg]);

  function updateSelectedRg(field, value) {
    setRgs((current) => current.map((rg) => (rg.id === selectedRg.id ? { ...rg, [field]: value } : rg)));
  }

  function addRg() {
    const newRg = {
      id: makeId("rg"),
      code: "RG.QUA.000",
      title: "Novo RG",
      revision: "00",
      linkedLines: [],
      processes: []
    };

    setRgs((current) => [...current, newRg]);
    setSelectedRgId(newRg.id);
    setSelectedProcessId("");
    setActiveMenu("rg");
  }

  function removeRg(rgId) {
    setRgs((current) => {
      const next = current.filter((rg) => rg.id !== rgId);
      const fallback = next[0];
      setSelectedRgId(fallback?.id ?? "");
      setSelectedProcessId(fallback?.processes[0]?.id ?? "");
      return next;
    });
  }

  function toggleLine(lineId) {
    setRgs((current) =>
      current.map((rg) => {
        if (rg.id !== selectedRg.id) return rg;
        const active = rg.linkedLines.includes(lineId);
        return {
          ...rg,
          linkedLines: active ? rg.linkedLines.filter((id) => id !== lineId) : [...rg.linkedLines, lineId]
        };
      })
    );
  }

  function addProcess() {
    const type = processTypes[0];
    const newProcess = {
      id: makeId("proc"),
      type: type.id,
      name: type.label,
      frequency: "Por registro",
      fields: []
    };

    setRgs((current) =>
      current.map((rg) => (rg.id === selectedRg.id ? { ...rg, processes: [...rg.processes, newProcess] } : rg))
    );
    setSelectedProcessId(newProcess.id);
    setActiveMenu("processo");
  }

  function updateProcess(processId, field, value) {
    setRgs((current) =>
      current.map((rg) =>
        rg.id === selectedRg.id
          ? {
              ...rg,
              processes: rg.processes.map((process) => {
                if (process.id !== processId) return process;
                const typeInfo = field === "type" ? processTypes.find((type) => type.id === value) : null;
                return {
                  ...process,
                  [field]: value,
                  name: field === "type" && typeInfo ? typeInfo.label : process.name
                };
              })
            }
          : rg
      )
    );
  }

  function removeProcess(processId) {
    setRgs((current) =>
      current.map((rg) => {
        if (rg.id !== selectedRg.id) return rg;
        const nextProcesses = rg.processes.filter((process) => process.id !== processId);
        setSelectedProcessId(nextProcesses[0]?.id ?? "");
        return { ...rg, processes: nextProcesses };
      })
    );
  }

  function addField() {
    if (!selectedProcess) return;
    const newField = { id: makeId("field"), name: "Novo componente", type: "c_nc", required: true, nc: true };

    setRgs((current) =>
      current.map((rg) =>
        rg.id === selectedRg.id
          ? {
              ...rg,
              processes: rg.processes.map((process) =>
                process.id === selectedProcess.id ? { ...process, fields: [...process.fields, newField] } : process
              )
            }
          : rg
      )
    );
    setActiveMenu("componente");
  }

  function updateField(fieldId, key, value) {
    setRgs((current) =>
      current.map((rg) =>
        rg.id === selectedRg.id
          ? {
              ...rg,
              processes: rg.processes.map((process) =>
                process.id === selectedProcess.id
                  ? {
                      ...process,
                      fields: process.fields.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field))
                    }
                  : process
              )
            }
          : rg
      )
    );
  }

  function removeField(fieldId) {
    setRgs((current) =>
      current.map((rg) =>
        rg.id === selectedRg.id
          ? {
              ...rg,
              processes: rg.processes.map((process) =>
                process.id === selectedProcess.id
                  ? { ...process, fields: process.fields.filter((field) => field.id !== fieldId) }
                  : process
              )
            }
          : rg
      )
    );
  }

  if (!selectedRg) {
    return (
      <section className="audit-card p-4">
        <button type="button" className="rounded-md bg-cicopal-blue px-4 py-3 font-bold text-white" onClick={addRg}>
          Criar primeiro RG
        </button>
      </section>
    );
  }

  return (
    <section className="audit-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <FileCog size={30} className="text-cicopal-blue" />
          <div>
            <h2 className="text-2xl font-bold text-cicopal-blue">Configurador de RG</h2>
            <p className="text-sm font-semibold text-gray-600">Configure por etapas: RG, processo e componente.</p>
          </div>
        </div>
        <span className="rounded-md bg-gray-900 px-3 py-2 text-sm font-bold text-white">
          {selectedRg.code} - rev {selectedRg.revision}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-md bg-gray-100 p-1">
        {menus.map((menu) => {
          const Icon = menu.icon;
          const active = activeMenu === menu.id;
          return (
            <button
              key={menu.id}
              type="button"
              className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-md px-3 text-base font-bold ${
                active ? "bg-cicopal-blue text-white" : "bg-white text-cicopal-blue"
              }`}
              onClick={() => setActiveMenu(menu.id)}
            >
              <Icon size={20} />
              {menu.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MiniStat label="RG selecionado" value={selectedRg.code} />
        <MiniStat label="Processos" value={selectedRg.processes.length} />
        <MiniStat
          label="Componentes"
          value={selectedRg.processes.reduce((total, process) => total + process.fields.length, 0)}
        />
      </div>

      {activeMenu === "rg" ? (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-950">RGs</h3>
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-cicopal-blue px-3 text-sm font-bold text-white"
                onClick={addRg}
              >
                <Plus size={18} />
                Novo
              </button>
            </div>
            <div className="space-y-2">
              {rgs.map((rg) => (
                <button
                  key={rg.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left ${
                    rg.id === selectedRg.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                  onClick={() => {
                    setSelectedRgId(rg.id);
                    setSelectedProcessId(rg.processes[0]?.id ?? "");
                  }}
                >
                  <span className="block text-base font-bold text-gray-950">{rg.code}</span>
                  <span className="block text-xs font-semibold text-gray-500">{rg.title}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-950">Dados do RG</h3>
                <p className="text-sm font-semibold text-gray-500">Crie o documento e vincule as linhas onde ele aparece.</p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 font-bold text-cicopal-red disabled:opacity-40"
                onClick={() => removeRg(selectedRg.id)}
                disabled={rgs.length === 1}
              >
                <Trash2 size={18} />
                Remover RG
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <FieldLabel>Codigo</FieldLabel>
                <ConfigInput value={selectedRg.code} onChange={(event) => updateSelectedRg("code", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Titulo</FieldLabel>
                <ConfigInput value={selectedRg.title} onChange={(event) => updateSelectedRg("title", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Revisao</FieldLabel>
                <ConfigInput value={selectedRg.revision} onChange={(event) => updateSelectedRg("revision", event.target.value)} />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-lg font-bold text-gray-950">
                <Factory size={22} className="text-cicopal-blue" />
                Linhas vinculadas
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {lines.map((line) => {
                  const active = selectedRg.linkedLines.includes(line.id);
                  return (
                    <button
                      key={line.id}
                      type="button"
                      className={`flex min-h-12 items-center justify-between rounded-md border px-3 font-bold ${
                        active ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 bg-white text-gray-700"
                      }`}
                      onClick={() => toggleLine(line.id)}
                    >
                      {line.nome}
                      {active ? <CheckSquare size={20} /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-500">
                Vinculado em: {linkedLineNames.join(", ") || "nenhuma linha"}
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white"
                onClick={() => setActiveMenu("processo")}
              >
                Ir para processos
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeMenu === "processo" ? (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-gray-950">Processos do RG</h3>
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-cicopal-blue px-3 text-sm font-bold text-white"
                onClick={addProcess}
              >
                <Plus size={18} />
                Novo
              </button>
            </div>
            <div className="space-y-2">
              {selectedRg.processes.map((process) => (
                <button
                  key={process.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left ${
                    process.id === selectedProcess?.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                  onClick={() => setSelectedProcessId(process.id)}
                >
                  <span className="block text-base font-bold text-gray-950">{process.name}</span>
                  <span className="block text-xs font-semibold text-gray-500">
                    {process.frequency} - {process.fields.length} componente(s)
                  </span>
                </button>
              ))}
              {!selectedRg.processes.length ? (
                <div className="rounded-md border border-dashed border-gray-300 p-4 text-center font-bold text-gray-500">
                  Nenhum processo criado.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            {selectedProcess ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-950">Editor do processo</h3>
                    <p className="text-sm font-semibold text-gray-500">Escolha o tipo base e a regra de frequencia.</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 font-bold text-cicopal-red"
                    onClick={() => removeProcess(selectedProcess.id)}
                  >
                    <Trash2 size={18} />
                    Remover processo
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label>
                    <FieldLabel>Tipo base</FieldLabel>
                    <ConfigSelect
                      value={selectedProcess.type}
                      onChange={(event) => updateProcess(selectedProcess.id, "type", event.target.value)}
                    >
                      {processTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </ConfigSelect>
                  </label>
                  <label>
                    <FieldLabel>Nome visivel</FieldLabel>
                    <ConfigInput
                      value={selectedProcess.name}
                      onChange={(event) => updateProcess(selectedProcess.id, "name", event.target.value)}
                    />
                  </label>
                  <label>
                    <FieldLabel>Frequencia</FieldLabel>
                    <ConfigSelect
                      value={selectedProcess.frequency}
                      onChange={(event) => updateProcess(selectedProcess.id, "frequency", event.target.value)}
                    >
                      {frequencies.map((frequency) => (
                        <option key={frequency} value={frequency}>
                          {frequency}
                        </option>
                      ))}
                    </ConfigSelect>
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <MiniStat label="RG" value={selectedRg.code} />
                  <MiniStat label="Processo" value={selectedProcess.name} />
                  <MiniStat label="Componentes" value={selectedProcess.fields.length} />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white"
                    onClick={addField}
                  >
                    <Plus size={20} />
                    Novo componente
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 font-bold text-gray-700"
                    onClick={() => setActiveMenu("componente")}
                  >
                    Ver componentes
                    <ChevronRight size={20} />
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 p-8 text-center">
                <p className="text-xl font-bold text-gray-700">Crie ou selecione um processo.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {activeMenu === "componente" ? (
        <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-gray-950">Componentes</h3>
              <p className="text-sm font-semibold text-gray-500">
                {selectedProcess ? `${selectedRg.code} / ${selectedProcess.name}` : "Selecione um processo para editar componentes."}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white disabled:bg-gray-300"
              onClick={addField}
              disabled={!selectedProcess}
            >
              <Plus size={20} />
              Novo componente
            </button>
          </div>

          {selectedProcess ? (
            <div className="grid gap-3">
              {selectedProcess.fields.map((field, index) => (
                <article key={field.id} className="rounded-md border border-gray-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-md bg-gray-900 px-3 py-2 text-sm font-bold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      className="inline-flex size-11 items-center justify-center rounded-md border border-red-200 bg-red-50 text-cicopal-red"
                      onClick={() => removeField(field.id)}
                      aria-label="Remover componente"
                    >
                      <Trash2 size={19} />
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1.5fr_180px_150px_150px]">
                    <label>
                      <FieldLabel>Nome do componente</FieldLabel>
                      <ConfigInput value={field.name} onChange={(event) => updateField(field.id, "name", event.target.value)} />
                    </label>
                    <label>
                      <FieldLabel>Tipo</FieldLabel>
                      <ConfigSelect value={field.type} onChange={(event) => updateField(field.id, "type", event.target.value)}>
                        {fieldTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </ConfigSelect>
                    </label>
                    <label className="flex min-h-12 items-end gap-2 pb-2 font-bold text-gray-700">
                      <input
                        type="checkbox"
                        className="size-6"
                        checked={field.required}
                        onChange={(event) => updateField(field.id, "required", event.target.checked)}
                      />
                      Obrigatorio
                    </label>
                    <label className="flex min-h-12 items-end gap-2 pb-2 font-bold text-gray-700">
                      <input
                        type="checkbox"
                        className="size-6"
                        checked={field.nc}
                        onChange={(event) => updateField(field.id, "nc", event.target.checked)}
                      />
                      Gera NC
                    </label>
                  </div>
                </article>
              ))}
              {!selectedProcess.fields.length ? (
                <div className="rounded-md border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-xl font-bold text-gray-700">Nenhum componente criado para este processo.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-300 p-8 text-center">
              <p className="text-xl font-bold text-gray-700">Crie ou selecione um processo antes dos componentes.</p>
            </div>
          )}
        </section>
      ) : null}

      <section className="mt-4 rounded-md border border-gray-200 bg-white p-3 shadow-soft">
        <div className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-950">
          <Settings2 size={22} className="text-cicopal-blue" />
          Resumo da configuracao
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {selectedRg.processes.map((process, processIndex) => {
            const typeInfo = processTypes.find((type) => type.id === process.type);
            return (
              <article key={process.id} className="rounded-md border border-gray-200 bg-white p-3">
                <p className="text-xs font-bold uppercase text-gray-500">
                  {String(processIndex + 1).padStart(2, "0")} - {typeInfo?.prefix}
                </p>
                <h4 className="text-lg font-bold text-gray-950">{process.name}</h4>
                <p className="text-sm font-semibold text-gray-500">{process.frequency}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {process.fields.map((field) => (
                    <span key={field.id} className="audit-badge bg-gray-100 text-gray-700">
                      {field.name} / {fieldTypeLabel(field.type)}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
