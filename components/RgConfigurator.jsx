"use client";

import { useMemo, useState } from "react";
import { CheckSquare, ClipboardList, Copy, Factory, FileCog, Plus, Settings2, Trash2 } from "lucide-react";

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

const initialProcesses = [
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

function FieldTypeBadge({ type }) {
  const fieldType = fieldTypes.find((item) => item.id === type);
  return <span className="audit-badge bg-gray-100 text-gray-700">{fieldType?.label ?? type}</span>;
}

export function RgConfigurator({ lines }) {
  const [rgConfig, setRgConfig] = useState({
    code: "RG.QUA.005",
    title: "Controle de Liberacao de Produto",
    revision: "02",
    linkedLines: ["PUR"]
  });
  const [processes, setProcesses] = useState(initialProcesses);
  const [selectedProcessId, setSelectedProcessId] = useState(initialProcesses[0].id);

  const selectedProcess = processes.find((process) => process.id === selectedProcessId) ?? processes[0];
  const linkedLineNames = useMemo(() => {
    return lines.filter((line) => rgConfig.linkedLines.includes(line.id)).map((line) => line.nome);
  }, [lines, rgConfig.linkedLines]);

  function updateRg(field, value) {
    setRgConfig((current) => ({ ...current, [field]: value }));
  }

  function toggleLine(lineId) {
    setRgConfig((current) => {
      const exists = current.linkedLines.includes(lineId);
      return {
        ...current,
        linkedLines: exists ? current.linkedLines.filter((id) => id !== lineId) : [...current.linkedLines, lineId]
      };
    });
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

    setProcesses((current) => [...current, newProcess]);
    setSelectedProcessId(newProcess.id);
  }

  function removeProcess(processId) {
    setProcesses((current) => {
      const next = current.filter((process) => process.id !== processId);
      setSelectedProcessId(next[0]?.id ?? "");
      return next;
    });
  }

  function updateProcess(processId, field, value) {
    setProcesses((current) =>
      current.map((process) => {
        if (process.id !== processId) return process;
        const typeInfo = field === "type" ? processTypes.find((type) => type.id === value) : null;
        return {
          ...process,
          [field]: value,
          name: field === "type" && typeInfo ? typeInfo.label : process.name
        };
      })
    );
  }

  function addField(processId) {
    setProcesses((current) =>
      current.map((process) =>
        process.id === processId
          ? {
              ...process,
              fields: [
                ...process.fields,
                { id: makeId("field"), name: "Novo componente", type: "c_nc", required: true, nc: true }
              ]
            }
          : process
      )
    );
  }

  function updateField(processId, fieldId, key, value) {
    setProcesses((current) =>
      current.map((process) =>
        process.id === processId
          ? {
              ...process,
              fields: process.fields.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field))
            }
          : process
      )
    );
  }

  function removeField(processId, fieldId) {
    setProcesses((current) =>
      current.map((process) =>
        process.id === processId
          ? { ...process, fields: process.fields.filter((field) => field.id !== fieldId) }
          : process
      )
    );
  }

  return (
    <section className="audit-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <FileCog size={30} className="text-cicopal-blue" />
          <div>
            <h2 className="text-2xl font-bold text-cicopal-blue">Configurador de RG</h2>
            <p className="text-sm font-semibold text-gray-600">Monte documentos, processos e componentes sem mexer em codigo.</p>
          </div>
        </div>
        <span className="rounded-md bg-gray-900 px-3 py-2 text-sm font-bold text-white">
          {rgConfig.code || "Novo RG"} - rev {rgConfig.revision || "00"}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-950">
              <Settings2 size={22} className="text-cicopal-blue" />
              Documento
            </div>
            <div className="space-y-3">
              <label className="block">
                <FieldLabel>Codigo do RG</FieldLabel>
                <ConfigInput value={rgConfig.code} onChange={(event) => updateRg("code", event.target.value)} />
              </label>
              <label className="block">
                <FieldLabel>Titulo</FieldLabel>
                <ConfigInput value={rgConfig.title} onChange={(event) => updateRg("title", event.target.value)} />
              </label>
              <label className="block">
                <FieldLabel>Revisao</FieldLabel>
                <ConfigInput value={rgConfig.revision} onChange={(event) => updateRg("revision", event.target.value)} />
              </label>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-950">
              <Factory size={22} className="text-cicopal-blue" />
              Vincular linhas
            </div>
            <div className="grid gap-2">
              {lines.map((line) => {
                const active = rgConfig.linkedLines.includes(line.id);
                return (
                  <button
                    key={line.id}
                    type="button"
                    className={`flex min-h-12 items-center justify-between rounded-md border px-3 font-bold ${
                      active ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 bg-white text-gray-700"
                    }`}
                    onClick={() => toggleLine(line.id)}
                  >
                    <span>{line.nome}</span>
                    {active ? <CheckSquare size={20} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-lg font-bold text-gray-950">
                <ClipboardList size={22} className="text-cicopal-blue" />
                Processos
              </div>
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
              {processes.map((process) => (
                <button
                  key={process.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left ${
                    selectedProcess?.id === process.id
                      ? "border-cicopal-blue bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                  onClick={() => setSelectedProcessId(process.id)}
                >
                  <span className="block text-base font-bold text-gray-950">{process.name}</span>
                  <span className="block text-xs font-semibold text-gray-500">
                    {process.frequency} - {process.fields.length} componente(s)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          {selectedProcess ? (
            <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-950">Editor do processo</h3>
                  <p className="text-sm font-semibold text-gray-500">Defina o tipo, frequencia e os componentes de preenchimento.</p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 font-bold text-cicopal-red"
                  onClick={() => removeProcess(selectedProcess.id)}
                  disabled={processes.length === 1}
                >
                  <Trash2 size={18} />
                  Remover processo
                </button>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <label className="block">
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
                <label className="block">
                  <FieldLabel>Nome visivel</FieldLabel>
                  <ConfigInput
                    value={selectedProcess.name}
                    onChange={(event) => updateProcess(selectedProcess.id, "name", event.target.value)}
                  />
                </label>
                <label className="block">
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

              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="audit-table min-w-[980px] text-left">
                  <thead>
                    <tr>
                      <th className="px-3 py-3">Componente</th>
                      <th className="w-44 px-3 py-3">Tipo</th>
                      <th className="w-36 px-3 py-3 text-center">Obrigatorio</th>
                      <th className="w-36 px-3 py-3 text-center">Gera NC</th>
                      <th className="w-24 px-3 py-3 text-center">Acao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProcess.fields.map((field) => (
                      <tr key={field.id} className="bg-white">
                        <td className="px-3 py-3">
                          <ConfigInput
                            value={field.name}
                            onChange={(event) => updateField(selectedProcess.id, field.id, "name", event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <ConfigSelect
                            value={field.type}
                            onChange={(event) => updateField(selectedProcess.id, field.id, "type", event.target.value)}
                          >
                            {fieldTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.label}
                              </option>
                            ))}
                          </ConfigSelect>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            className="size-6"
                            checked={field.required}
                            onChange={(event) => updateField(selectedProcess.id, field.id, "required", event.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            className="size-6"
                            checked={field.nc}
                            onChange={(event) => updateField(selectedProcess.id, field.id, "nc", event.target.checked)}
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            className="inline-flex size-11 items-center justify-center rounded-md border border-red-200 bg-red-50 text-cicopal-red"
                            onClick={() => removeField(selectedProcess.id, field.id)}
                            aria-label="Remover componente"
                          >
                            <Trash2 size={19} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!selectedProcess.fields.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center font-bold text-gray-500">
                          Nenhum componente neste processo.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white"
                  onClick={() => addField(selectedProcess.id)}
                >
                  <Plus size={20} />
                  Adicionar componente
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-950">
              <Copy size={22} className="text-cicopal-blue" />
              Previa da estrutura
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Documento</p>
                <p className="text-lg font-bold text-gray-950">{rgConfig.code}</p>
                <p className="text-sm font-semibold text-gray-600">{rgConfig.title}</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Linhas vinculadas</p>
                <p className="text-lg font-bold text-gray-950">{linkedLineNames.length || 0}</p>
                <p className="text-sm font-semibold text-gray-600">{linkedLineNames.join(", ") || "Nenhuma linha"}</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Processos</p>
                <p className="text-lg font-bold text-gray-950">{processes.length}</p>
                <p className="text-sm font-semibold text-gray-600">
                  {processes.reduce((total, process) => total + process.fields.length, 0)} componente(s)
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {processes.map((process, processIndex) => {
                const typeInfo = processTypes.find((type) => type.id === process.type);
                return (
                  <article key={process.id} className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-gray-500">
                          {String(processIndex + 1).padStart(2, "0")} - {typeInfo?.prefix}
                        </p>
                        <h4 className="text-lg font-bold text-gray-950">{process.name}</h4>
                        <p className="text-sm font-semibold text-gray-500">{process.frequency}</p>
                      </div>
                      <span className="audit-badge bg-blue-50 text-cicopal-blue">{typeInfo?.label}</span>
                    </div>
                    <div className="space-y-2">
                      {process.fields.map((field) => (
                        <div key={field.id} className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-gray-50 px-3">
                          <span className="font-semibold text-gray-800">{field.name}</span>
                          <div className="flex items-center gap-2">
                            {field.nc ? <span className="audit-badge bg-red-100 text-cicopal-red">NC</span> : null}
                            <FieldTypeBadge type={field.type} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
