"use client";

import { useMemo, useState } from "react";
import {
  CheckSquare,
  ClipboardList,
  Factory,
  FileText,
  GripVertical,
  Layers3,
  LayoutTemplate,
  Plus,
  Settings2,
  Trash2
} from "lucide-react";
import { checklistGroups } from "@/lib/checklist";

const steps = [
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

const layoutOptions = [
  { id: "full", label: "Linha inteira", preview: "1/1" },
  { id: "half", label: "Metade", preview: "1/2" },
  { id: "third", label: "Terco", preview: "1/3" },
  { id: "quarter", label: "Quarto", preview: "1/4" }
];

const frequencies = ["Por registro", "Por setup", "Por horario liberado", "Hora em hora", "Turno"];

const liberacaoProdutoComponents = [
  "Sabor e odor",
  "Textura",
  "Aspecto visual",
  "Peso do pacote",
  "Selagem",
  "Datador",
  "Impressao",
  "Microfuro maq. 1",
  "Temp. oleo",
  "Tempo residencia"
];

const avaliacaoProdutoComponents = [
  { name: "Umidade produto final", type: "percentual" },
  { name: "Sal", type: "percentual" },
  { name: "Temperatura de envase", type: "temperatura" }
];

const processoComponents = ["Datador", "Selagem", "Microfuro", "Caixa", "Etiqueta", "Peso", "Ar (mm)"];

function makeField(id, name, type = "c_nc", section = "Geral", overrides = {}) {
  return {
    id,
    name,
    type,
    section,
    layout: type === "texto" || type === "foto" ? "half" : "third",
    required: true,
    nc: type === "c_nc",
    ...overrides
  };
}

function makeFields(prefix, items, section, type = "c_nc") {
  return items.map((item, index) => {
    if (typeof item === "string") return makeField(`${prefix}-${index + 1}`, item, type, section);
    return makeField(`${prefix}-${index + 1}`, item.name, item.type ?? type, item.section ?? section, item);
  });
}

const signatureFields = [
  makeField("sign-1", "Assinatura operador", "assinatura", "Assinaturas", { nc: false, layout: "third" }),
  makeField("sign-2", "Assinatura qualidade", "assinatura", "Assinaturas", { nc: false, layout: "third" }),
  makeField("sign-3", "Assinatura supervisor", "assinatura", "Assinaturas", { nc: false, layout: "third" })
];

const productContextFields = [
  makeField("prod-context-1", "Marca", "texto", "Cabecalho", { nc: false, layout: "third" }),
  makeField("prod-context-2", "Sabor", "texto", "Cabecalho", { nc: false, layout: "third" }),
  makeField("prod-context-3", "Gramatura", "texto", "Cabecalho", { nc: false, layout: "third" }),
  makeField("prod-context-4", "Operador logado", "texto", "Cabecalho", { nc: false, layout: "third" }),
  makeField("prod-context-5", "Turno operador", "texto", "Cabecalho", { nc: false, layout: "third" }),
  makeField("prod-context-6", "Data/Hora do registro", "hora", "Cabecalho", { nc: false, layout: "third" })
];

function defaultFieldsForProcess(type) {
  if (type === "higienizacao") {
    return [
      makeField("hig-context-1", "Operador logado", "texto", "Cabecalho", { nc: false }),
      makeField("hig-context-2", "Turno operador", "texto", "Cabecalho", { nc: false }),
      makeField("hig-context-3", "Tipo de setup", "texto", "Cabecalho", { nc: false }),
      makeField("hig-context-4", "Troca de sabor/produto de", "texto", "Cabecalho", { nc: false, required: false }),
      makeField("hig-context-5", "Para", "texto", "Cabecalho", { nc: false, required: false }),
      makeField("hig-context-6", "Matriz de troca", "texto", "Cabecalho", { nc: false, layout: "full" }),
      ...checklistGroups.flatMap((group) => makeFields(`hig-${group.id}`, group.items, group.title, "c_nc")),
      makeField("hig-nc-1", "Horario do desvio", "hora", "Detalhamento da NC", { required: false, nc: true }),
      makeField("hig-nc-2", "Quantidade / impacto", "numero", "Detalhamento da NC", { required: false, nc: true }),
      makeField("hig-nc-3", "Causa", "texto", "Detalhamento da NC", { required: false, nc: true }),
      makeField("hig-nc-4", "Acao corretiva", "texto", "Detalhamento da NC", { required: false, nc: true }),
      makeField("hig-nc-5", "Disposicao imediata", "texto", "Detalhamento da NC", { required: false, nc: true }),
      makeField("hig-nc-6", "Disposicao final", "texto", "Detalhamento da NC", { required: false, nc: true }),
      ...signatureFields
    ];
  }

  if (type === "produto_liberacao") {
    return [
      ...productContextFields,
      makeField("libp-time-1", "Horario de liberacao", "hora", "Lancamentos"),
      ...makeFields("libp", liberacaoProdutoComponents, "Controle de liberacao"),
      ...signatureFields
    ];
  }

  if (type === "produto_avaliacao") {
    return [
      ...productContextFields,
      makeField("avp-time-1", "Horario da avaliacao", "hora", "Hora em hora"),
      ...makeFields("avp", avaliacaoProdutoComponents, "Hora em hora"),
      ...signatureFields
    ];
  }

  if (type === "processo") {
    return [makeField("rgp-time-1", "Horario", "hora", "Hora em hora"), ...makeFields("rgp", processoComponents, "Hora em hora"), ...signatureFields];
  }

  if (type === "fotografico") {
    return [
      makeField("regf-time-1", "Horario", "hora", "Hora em hora"),
      makeField("regf-photo-1", "Foto", "foto", "Registro visual", { nc: false, layout: "half" }),
      makeField("regf-obs-1", "Observacao", "texto", "Registro visual", { required: false, nc: false, layout: "half" }),
      ...signatureFields
    ];
  }

  return [];
}

function defaultFrequencyForProcess(type) {
  if (type === "higienizacao") return "Por setup";
  if (type === "produto_liberacao") return "Por horario liberado";
  if (type === "produto_avaliacao" || type === "processo" || type === "fotografico") return "Hora em hora";
  return "Por registro";
}

const initialRgs = [
  {
    id: "rg-005",
    code: "RG.QUA.005",
    title: "Controle de Liberacao de Produto",
    revision: "02",
    linkedLines: ["PUR"],
    processes: processTypes.map((type, index) => ({
      id: `proc-${index + 1}`,
      type: type.id,
      name: type.label,
      frequency: defaultFrequencyForProcess(type.id),
      fields: defaultFieldsForProcess(type.id)
    }))
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

function fieldTypeLabel(type) {
  return fieldTypes.find((item) => item.id === type)?.label ?? type;
}

function previewGridClass(layout) {
  return {
    full: "md:col-span-12",
    half: "md:col-span-6",
    third: "md:col-span-4",
    quarter: "md:col-span-3"
  }[layout ?? "third"];
}

function groupedBySection(fields) {
  return fields.reduce((groups, field) => {
    const section = field.section || "Geral";
    return { ...groups, [section]: [...(groups[section] ?? []), field] };
  }, {});
}

function getProcessPrefix(type) {
  return processTypes.find((item) => item.id === type)?.prefix ?? "REG";
}

function sectionTone(section) {
  const normalized = section.toLowerCase();

  if (normalized.includes("cabecalho")) return "border-l-cicopal-blue bg-blue-50/60";
  if (normalized.includes("sem contato")) return "border-l-gray-500 bg-gray-50";
  if (normalized.includes("zona")) return "border-l-cicopal-green bg-green-50/60";
  if (normalized.includes("nc")) return "border-l-cicopal-red bg-red-50/60";
  if (normalized.includes("assinatura")) return "border-l-cicopal-blue bg-blue-50/40";
  if (normalized.includes("hora")) return "border-l-cicopal-green bg-green-50/40";

  return "border-l-gray-400 bg-gray-50";
}

function sectionKind(section) {
  const normalized = section.toLowerCase();

  if (normalized.includes("cabecalho")) return "Dados iniciais";
  if (normalized.includes("sem contato")) return "Area sem contato";
  if (normalized.includes("zona")) return "Area critica";
  if (normalized.includes("nc")) return "Nao conformidade";
  if (normalized.includes("assinatura")) return "Validacao";
  if (normalized.includes("hora")) return "Preenchimento periodico";

  return "Bloco do formulario";
}

function FieldPreview({ field, selected, onSelect, onDragStart, onDrop, onDragOver }) {
  return (
    <button
      type="button"
      draggable
      className={`${previewGridClass(field.layout)} rounded-md border p-3 text-left transition ${
        selected ? "border-cicopal-blue bg-blue-50 shadow-soft" : "border-gray-200 bg-white hover:border-cicopal-blue"
      }`}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-gray-950">{field.name}</span>
        <GripVertical size={18} className="shrink-0 text-gray-400" />
      </div>
      <div className="flex min-h-11 items-center rounded-md border border-gray-300 bg-gray-50 px-3 text-sm font-semibold text-gray-500">
        {fieldTypeLabel(field.type)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="audit-badge bg-gray-100 text-gray-600">
          {layoutOptions.find((item) => item.id === field.layout)?.preview ?? "1/3"}
        </span>
        {field.nc ? <span className="audit-badge bg-red-100 text-cicopal-red">NC</span> : null}
      </div>
    </button>
  );
}

function SectionCard({ section, fields, children }) {
  const types = [...new Set(fields.map((field) => fieldTypeLabel(field.type)))];

  return (
    <section className={`rounded-md border border-l-[6px] border-gray-200 p-3 ${sectionTone(section)}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 rounded-md bg-white/80 p-3">
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">{sectionKind(section)}</p>
          <h4 className="text-xl font-bold text-gray-950">{section}</h4>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="audit-badge bg-white text-gray-700">{fields.length} campos</span>
          {types.slice(0, 4).map((type) => (
            <span key={type} className="audit-badge bg-gray-900 text-white">
              {type}
            </span>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}

export function RgConfigurator({ lines }) {
  const [rgs, setRgs] = useState(initialRgs);
  const [activeStep, setActiveStep] = useState("componente");
  const [selectedRgId, setSelectedRgId] = useState(initialRgs[0].id);
  const [selectedProcessId, setSelectedProcessId] = useState(initialRgs[0].processes[0].id);
  const [selectedFieldId, setSelectedFieldId] = useState(initialRgs[0].processes[0].fields[0].id);
  const [draggedFieldId, setDraggedFieldId] = useState("");

  const selectedRg = rgs.find((rg) => rg.id === selectedRgId) ?? rgs[0];
  const selectedProcess = selectedRg.processes.find((process) => process.id === selectedProcessId) ?? selectedRg.processes[0];
  const selectedField = selectedProcess?.fields.find((field) => field.id === selectedFieldId) ?? selectedProcess?.fields[0];
  const fieldsBySection = useMemo(() => groupedBySection(selectedProcess?.fields ?? []), [selectedProcess]);
  const linkedLineNames = useMemo(
    () => lines.filter((line) => selectedRg.linkedLines.includes(line.id)).map((line) => line.nome),
    [lines, selectedRg]
  );

  function updateRg(field, value) {
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
    setSelectedFieldId("");
    setActiveStep("rg");
  }

  function toggleLine(lineId) {
    setRgs((current) =>
      current.map((rg) => {
        if (rg.id !== selectedRg.id) return rg;
        const active = rg.linkedLines.includes(lineId);
        return { ...rg, linkedLines: active ? rg.linkedLines.filter((id) => id !== lineId) : [...rg.linkedLines, lineId] };
      })
    );
  }

  function addProcess() {
    const type = processTypes[0];
    const newProcess = {
      id: makeId("proc"),
      type: type.id,
      name: type.label,
      frequency: defaultFrequencyForProcess(type.id),
      fields: defaultFieldsForProcess(type.id)
    };
    setRgs((current) =>
      current.map((rg) => (rg.id === selectedRg.id ? { ...rg, processes: [...rg.processes, newProcess] } : rg))
    );
    setSelectedProcessId(newProcess.id);
    setSelectedFieldId(newProcess.fields[0]?.id ?? "");
    setActiveStep("processo");
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
                const nextFields = field === "type" ? defaultFieldsForProcess(value) : process.fields;
                if (field === "type") setSelectedFieldId(nextFields[0]?.id ?? "");
                return {
                  ...process,
                  [field]: value,
                  name: field === "type" && typeInfo ? typeInfo.label : process.name,
                  frequency: field === "type" ? defaultFrequencyForProcess(value) : process.frequency,
                  fields: nextFields
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
        const processes = rg.processes.filter((process) => process.id !== processId);
        setSelectedProcessId(processes[0]?.id ?? "");
        setSelectedFieldId(processes[0]?.fields[0]?.id ?? "");
        return { ...rg, processes };
      })
    );
  }

  function addField() {
    if (!selectedProcess) return;
    const newField = makeField(makeId("field"), "Novo componente", "c_nc", "Geral", { layout: "third" });
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
    setSelectedFieldId(newField.id);
    setActiveStep("componente");
  }

  function updateField(fieldId, key, value) {
    setRgs((current) =>
      current.map((rg) =>
        rg.id === selectedRg.id
          ? {
              ...rg,
              processes: rg.processes.map((process) =>
                process.id === selectedProcess.id
                  ? { ...process, fields: process.fields.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field)) }
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
              processes: rg.processes.map((process) => {
                if (process.id !== selectedProcess.id) return process;
                const fields = process.fields.filter((field) => field.id !== fieldId);
                setSelectedFieldId(fields[0]?.id ?? "");
                return { ...process, fields };
              })
            }
          : rg
      )
    );
  }

  function moveField(targetFieldId) {
    if (!draggedFieldId || draggedFieldId === targetFieldId) return;
    setRgs((current) =>
      current.map((rg) =>
        rg.id === selectedRg.id
          ? {
              ...rg,
              processes: rg.processes.map((process) => {
                if (process.id !== selectedProcess.id) return process;
                const fields = [...process.fields];
                const fromIndex = fields.findIndex((field) => field.id === draggedFieldId);
                const toIndex = fields.findIndex((field) => field.id === targetFieldId);
                const [moved] = fields.splice(fromIndex, 1);
                fields.splice(toIndex, 0, moved);
                return { ...process, fields };
              })
            }
          : rg
      )
    );
    setDraggedFieldId("");
  }

  return (
    <section className="rounded-md border border-gray-200 bg-[#f4f7fb] p-3 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-3">
        <div>
          <h2 className="text-2xl font-bold text-cicopal-blue">Configurador visual de RG</h2>
          <p className="text-sm font-semibold text-gray-600">Monte o formulario arrastando, selecionando e ajustando os campos.</p>
        </div>
        <button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white">
          <LayoutTemplate size={20} />
          Salvar modelo
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 rounded-md bg-white p-1">
        {steps.map((step) => {
          const Icon = step.icon;
          const active = activeStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-md px-3 font-bold ${
                active ? "bg-cicopal-blue text-white" : "bg-gray-50 text-cicopal-blue"
              }`}
              onClick={() => setActiveStep(step.id)}
            >
              <Icon size={20} />
              {step.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="space-y-3">
          <section className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-gray-950">RGs</h3>
              <button type="button" className="inline-flex size-10 items-center justify-center rounded-md bg-cicopal-blue text-white" onClick={addRg}>
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {rgs.map((rg) => (
                <button
                  key={rg.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left ${rg.id === selectedRg.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200"}`}
                  onClick={() => {
                    setSelectedRgId(rg.id);
                    setSelectedProcessId(rg.processes[0]?.id ?? "");
                    setSelectedFieldId(rg.processes[0]?.fields[0]?.id ?? "");
                  }}
                >
                  <span className="block font-bold text-gray-950">{rg.code}</span>
                  <span className="block truncate text-xs font-semibold text-gray-500">{rg.title}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-gray-950">Processos</h3>
              <button type="button" className="inline-flex size-10 items-center justify-center rounded-md bg-cicopal-blue text-white" onClick={addProcess}>
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {selectedRg.processes.map((process) => (
                <button
                  key={process.id}
                  type="button"
                  className={`w-full rounded-md border p-3 text-left ${process.id === selectedProcess?.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200"}`}
                  onClick={() => {
                    setSelectedProcessId(process.id);
                    setSelectedFieldId(process.fields[0]?.id ?? "");
                  }}
                >
                  <span className="block font-bold text-gray-950">{process.name}</span>
                  <span className="text-xs font-semibold text-gray-500">
                    {getProcessPrefix(process.type)} - {process.fields.length} campos
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="min-w-0 rounded-md border border-gray-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xl font-bold text-gray-950">{selectedProcess?.name ?? "Selecione um processo"}</h3>
              <p className="text-sm font-semibold text-gray-500">
                {selectedRg.code} / {linkedLineNames.join(", ") || "sem linha vinculada"}
              </p>
            </div>
            <button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white" onClick={addField}>
              <Plus size={20} />
              Adicionar campo
            </button>
          </div>

          {selectedProcess ? (
            <div className="space-y-4">
              {Object.entries(fieldsBySection).map(([section, fields]) => (
                <SectionCard key={section} section={section} fields={fields}>
                  <div className="grid gap-3 md:grid-cols-12">
                    {fields.map((field) => (
                      <FieldPreview
                        key={field.id}
                        field={field}
                        selected={field.id === selectedField?.id}
                        onSelect={() => {
                          setSelectedFieldId(field.id);
                          setActiveStep("componente");
                        }}
                        onDragStart={() => setDraggedFieldId(field.id)}
                        onDrop={(event) => {
                          event.preventDefault();
                          moveField(field.id);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                      />
                    ))}
                  </div>
                </SectionCard>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-300 p-8 text-center font-bold text-gray-500">
              Crie ou selecione um processo.
            </div>
          )}
        </main>

        <aside className="rounded-md border border-gray-200 bg-white p-3">
          {activeStep === "rg" ? (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-950">Propriedades do RG</h3>
              <label>
                <FieldLabel>Codigo</FieldLabel>
                <ConfigInput value={selectedRg.code} onChange={(event) => updateRg("code", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Titulo</FieldLabel>
                <ConfigInput value={selectedRg.title} onChange={(event) => updateRg("title", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Revisao</FieldLabel>
                <ConfigInput value={selectedRg.revision} onChange={(event) => updateRg("revision", event.target.value)} />
              </label>
              <div>
                <FieldLabel>Linhas vinculadas</FieldLabel>
                <div className="grid gap-2">
                  {lines.map((line) => {
                    const active = selectedRg.linkedLines.includes(line.id);
                    return (
                      <button
                        key={line.id}
                        type="button"
                        className={`flex min-h-11 items-center justify-between rounded-md border px-3 font-bold ${
                          active ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 text-gray-700"
                        }`}
                        onClick={() => toggleLine(line.id)}
                      >
                        {line.nome}
                        {active ? <CheckSquare size={18} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === "processo" && selectedProcess ? (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-950">Propriedades do processo</h3>
              <label>
                <FieldLabel>Tipo base</FieldLabel>
                <ConfigSelect value={selectedProcess.type} onChange={(event) => updateProcess(selectedProcess.id, "type", event.target.value)}>
                  {processTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </ConfigSelect>
              </label>
              <label>
                <FieldLabel>Nome</FieldLabel>
                <ConfigInput value={selectedProcess.name} onChange={(event) => updateProcess(selectedProcess.id, "name", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Frequencia</FieldLabel>
                <ConfigSelect value={selectedProcess.frequency} onChange={(event) => updateProcess(selectedProcess.id, "frequency", event.target.value)}>
                  {frequencies.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency}
                    </option>
                  ))}
                </ConfigSelect>
              </label>
              <button
                type="button"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 font-bold text-cicopal-red"
                onClick={() => removeProcess(selectedProcess.id)}
              >
                <Trash2 size={18} />
                Remover processo
              </button>
            </div>
          ) : null}

          {activeStep === "componente" && selectedField ? (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-950">Campo selecionado</h3>
              <label>
                <FieldLabel>Nome</FieldLabel>
                <ConfigInput value={selectedField.name} onChange={(event) => updateField(selectedField.id, "name", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Tipo</FieldLabel>
                <ConfigSelect value={selectedField.type} onChange={(event) => updateField(selectedField.id, "type", event.target.value)}>
                  {fieldTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </ConfigSelect>
              </label>
              <label>
                <FieldLabel>Secao</FieldLabel>
                <ConfigInput value={selectedField.section} onChange={(event) => updateField(selectedField.id, "section", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Largura no formulario</FieldLabel>
                <ConfigSelect value={selectedField.layout} onChange={(event) => updateField(selectedField.id, "layout", event.target.value)}>
                  {layoutOptions.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.label}
                    </option>
                  ))}
                </ConfigSelect>
              </label>
              <label className="flex min-h-11 items-center gap-2 font-bold text-gray-700">
                <input
                  type="checkbox"
                  className="size-6"
                  checked={selectedField.required}
                  onChange={(event) => updateField(selectedField.id, "required", event.target.checked)}
                />
                Obrigatorio
              </label>
              <label className="flex min-h-11 items-center gap-2 font-bold text-gray-700">
                <input
                  type="checkbox"
                  className="size-6"
                  checked={selectedField.nc}
                  onChange={(event) => updateField(selectedField.id, "nc", event.target.checked)}
                />
                Gera NC
              </label>
              <button
                type="button"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 font-bold text-cicopal-red"
                onClick={() => removeField(selectedField.id)}
              >
                <Trash2 size={18} />
                Remover campo
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
