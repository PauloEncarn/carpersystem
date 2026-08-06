"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ClipboardCheck, Eye, FileText, Plus, Settings2, Trash2, X } from "lucide-react";

const guidedSteps = [
  { id: "basico", label: "Dados básicos", help: "Identificação", icon: FileText },
  { id: "estrutura", label: "Estrutura", help: "Seções e campos", icon: Plus },
  { id: "regras", label: "Regras", help: "Validações e NC", icon: Settings2 },
  { id: "teste", label: "Testar", help: "Visão do operador", icon: Eye }
];

const guidedFieldTypes = [
  { id: "texto", label: "Texto" },
  { id: "numero", label: "Número" },
  { id: "lista", label: "Lista de opções" },
  { id: "c_nc", label: "Conforme / Não conforme" },
  { id: "data", label: "Data" },
  { id: "hora", label: "Hora" },
  { id: "foto", label: "Foto" },
  { id: "assinatura", label: "Assinatura" }
];

const emptyDraft = () => ({
  code: "RG.QUA.000",
  title: "Novo RG",
  revision: "00",
  description: "",
  linkedLines: [],
  processName: "Preenchimento do RG",
  frequency: "Por registro",
  sections: [
    {
      id: `section-${Date.now()}`,
      name: "Identificação",
      description: "Informe os dados do registro.",
      fields: []
    }
  ]
});

function makeField() {
  return {
    id: `field-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "Novo campo",
    type: "texto",
    required: false,
    nc: false,
    unit: "",
    min: "",
    max: "",
    options: []
  };
}

function GuidedInput({ label, required, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
        {label} {required ? <span className="text-cicopal-red">*</span> : null}
      </span>
      <input className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold outline-none focus:border-cicopal-blue" {...props} />
    </label>
  );
}

function OperatorField({ field, value, onChange }) {
  const label = (
    <span className="mb-1 block text-sm font-bold text-gray-800">
      {field.name} {field.required ? <span className="text-cicopal-red">*</span> : null}
    </span>
  );

  if (field.type === "c_nc") {
    return (
      <label className="block">
        {label}
        <span className="grid grid-cols-2 gap-2">
          <button type="button" className={`min-h-12 rounded-md border font-bold ${value === "C" ? "border-cicopal-green bg-green-50 text-cicopal-green" : "border-gray-300 bg-white"}`} onClick={() => onChange("C")}>
            Conforme
          </button>
          <button type="button" className={`min-h-12 rounded-md border font-bold ${value === "NC" ? "border-cicopal-red bg-red-50 text-cicopal-red" : "border-gray-300 bg-white"}`} onClick={() => onChange("NC")}>
            Não conforme
          </button>
        </span>
      </label>
    );
  }

  if (field.type === "lista") {
    return (
      <label className="block">
        {label}
        <select className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecione...</option>
          {field.options.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === "foto" || field.type === "assinatura") {
    return (
      <label className="block">
        {label}
        <button type="button" className="min-h-12 w-full rounded-md border border-cicopal-blue bg-blue-50 px-3 font-bold text-cicopal-blue" onClick={() => onChange(field.type === "foto" ? "Foto anexada" : "Assinatura registrada")}>
          {value || (field.type === "foto" ? "Tirar foto" : "Registrar assinatura")}
        </button>
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      <input
        className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold"
        type={field.type === "numero" ? "number" : field.type === "data" ? "date" : field.type === "hora" ? "time" : "text"}
        value={value ?? ""}
        placeholder={field.unit ? `Unidade: ${field.unit}` : "Digite aqui"}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function GuidedRgBuilder({ lines, onCancel, onCreate }) {
  const [draft, setDraft] = useState(() => emptyDraft());
  const [activeStep, setActiveStep] = useState("basico");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [testValues, setTestValues] = useState({});
  const [message, setMessage] = useState("");
  const stepIndex = guidedSteps.findIndex((step) => step.id === activeStep);
  const fields = useMemo(() => draft.sections.flatMap((section) => section.fields.map((field) => ({ ...field, sectionId: section.id, sectionName: section.name }))), [draft.sections]);
  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? fields[0];

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateSection(sectionId, patch) {
    setDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) }));
  }

  function addSection() {
    setDraft((current) => ({ ...current, sections: [...current.sections, { id: `section-${Date.now()}`, name: `Nova seção ${current.sections.length + 1}`, description: "", fields: [] }] }));
  }

  function removeSection(sectionId) {
    setDraft((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== sectionId) }));
  }

  function addField(sectionId) {
    const field = makeField();
    updateSection(sectionId, { fields: [...(draft.sections.find((section) => section.id === sectionId)?.fields ?? []), field] });
    setSelectedFieldId(field.id);
  }

  function updateField(fieldId, patch) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => ({ ...section, fields: section.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) }))
    }));
  }

  function removeField(fieldId) {
    setDraft((current) => ({ ...current, sections: current.sections.map((section) => ({ ...section, fields: section.fields.filter((field) => field.id !== fieldId) })) }));
    setSelectedFieldId("");
  }

  function toggleLine(lineId) {
    updateDraft({ linkedLines: draft.linkedLines.includes(lineId) ? draft.linkedLines.filter((id) => id !== lineId) : [...draft.linkedLines, lineId] });
  }

  function goToStep(nextStep) {
    if (nextStep === "estrutura" && (!draft.code.trim() || !draft.title.trim())) {
      setMessage("Informe o código e o nome do RG antes de continuar.");
      return;
    }
    setMessage("");
    setActiveStep(nextStep);
  }

  function validateTest() {
    const issues = [];
    fields.forEach((field) => {
      const value = testValues[field.id];
      if (field.required && !value) issues.push(`${field.name}: preenchimento obrigatório`);
      if (field.type === "c_nc" && value === "NC" && field.nc) issues.push(`${field.name}: gera uma não conformidade`);
      if (field.type === "numero" && value !== "" && value !== undefined && ((field.min !== "" && Number(value) < Number(field.min)) || (field.max !== "" && Number(value) > Number(field.max))) && field.nc) issues.push(`${field.name}: valor fora dos limites`);
    });
    setMessage(issues.length ? issues.join(" • ") : "Teste validado. O preenchimento está pronto para conclusão.");
  }

  return (
    <section className="rounded-md border border-gray-200 bg-[#f4f7fb] p-3 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <p className="text-xs font-bold uppercase text-cicopal-blue">Criação guiada</p>
          <h2 className="text-2xl font-bold text-gray-950">Criar um novo RG</h2>
          <p className="text-sm font-semibold text-gray-500">Monte, configure e teste o documento antes de adicioná-lo ao configurador.</p>
        </div>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 font-bold text-gray-700" onClick={onCancel}><X size={18} /> Cancelar</button>
      </div>

      <div className="mb-3 grid gap-2 rounded-md bg-white p-2 sm:grid-cols-2 xl:grid-cols-4">
        {guidedSteps.map((step, index) => {
          const Icon = step.icon;
          const active = step.id === activeStep;
          const done = index < stepIndex;
          return (
            <button key={step.id} type="button" className={`flex min-h-20 items-center gap-3 rounded-md border border-t-[5px] p-3 text-left ${active ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : done ? "border-cicopal-green bg-green-50 text-cicopal-green" : "border-gray-200 bg-white text-gray-600"}`} onClick={() => goToStep(step.id)}>
              <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-cicopal-blue text-white" : done ? "bg-cicopal-green text-white" : "bg-gray-100"}`}>{done ? <Check size={18} /> : <Icon size={18} />}</span>
              <span><span className="block font-bold">{index + 1}. {step.label}</span><span className="text-xs font-semibold opacity-70">{step.help}</span></span>
            </button>
          );
        })}
      </div>

      {message ? <div className={`mb-3 rounded-md border p-3 text-sm font-bold ${message.startsWith("Teste validado") ? "border-green-200 bg-green-50 text-cicopal-green" : "border-yellow-200 bg-yellow-50 text-yellow-900"}`}>{message}</div> : null}

      {activeStep === "basico" ? (
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-4"><h3 className="text-xl font-bold text-gray-950">Identificação do documento</h3><p className="text-sm font-semibold text-gray-500">Use nomes que o operador reconheça facilmente.</p></div>
          <div className="grid gap-3 md:grid-cols-3">
            <GuidedInput label="Código do RG" required value={draft.code} onChange={(event) => updateDraft({ code: event.target.value })} />
            <GuidedInput label="Nome do RG" required value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
            <GuidedInput label="Revisão" value={draft.revision} onChange={(event) => updateDraft({ revision: event.target.value })} />
            <label className="block md:col-span-3"><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Orientação para o operador</span><textarea className="min-h-24 w-full rounded-md border border-gray-300 p-3 font-semibold" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} /></label>
            <GuidedInput label="Nome do processo inicial" value={draft.processName} onChange={(event) => updateDraft({ processName: event.target.value })} />
            <label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Frequência</span><select className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold" value={draft.frequency} onChange={(event) => updateDraft({ frequency: event.target.value })}>{["Por registro", "Por setup", "Por horário liberado", "Hora em hora", "Por batelada", "Turno"].map((frequency) => <option key={frequency}>{frequency}</option>)}</select></label>
          </div>
          <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase text-gray-500">Linhas vinculadas</p><div className="grid gap-2 md:grid-cols-3">{lines.map((line) => <button key={line.id} type="button" className={`min-h-12 rounded-md border px-3 text-left font-bold ${draft.linkedLines.includes(line.id) ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 bg-white"}`} onClick={() => toggleLine(line.id)}>{line.nome}{draft.linkedLines.includes(line.id) ? <Check className="float-right" size={18} /> : null}</button>)}</div></div>
        </section>
      ) : null}

      {activeStep === "estrutura" ? (
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-gray-950">Seções e campos</h3><p className="text-sm font-semibold text-gray-500">Divida o preenchimento em blocos curtos e objetivos.</p></div><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cicopal-blue px-3 font-bold text-white" onClick={addSection}><Plus size={18} /> Nova seção</button></div>
          <div className="space-y-3">{draft.sections.map((section, sectionIndex) => <article key={section.id} className="rounded-md border border-gray-200 bg-gray-50 p-3"><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><GuidedInput label={`Nome da seção ${sectionIndex + 1}`} value={section.name} onChange={(event) => updateSection(section.id, { name: event.target.value })} /><GuidedInput label="Orientação" value={section.description} onChange={(event) => updateSection(section.id, { description: event.target.value })} /><button type="button" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 text-cicopal-red" title="Excluir seção" onClick={() => removeSection(section.id)}><Trash2 size={18} /></button></div><div className="mt-3 space-y-2">{section.fields.map((field) => <button key={field.id} type="button" className="flex min-h-14 w-full items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 text-left" onClick={() => { setSelectedFieldId(field.id); setActiveStep("regras"); }}><span><span className="block font-bold text-gray-950">{field.name}</span><span className="text-xs font-semibold text-gray-500">{guidedFieldTypes.find((type) => type.id === field.type)?.label}{field.required ? " • obrigatório" : ""}</span></span><Settings2 size={18} className="text-cicopal-blue" /></button>)}</div><button type="button" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-cicopal-blue bg-blue-50 px-3 font-bold text-cicopal-blue" onClick={() => addField(section.id)}><Plus size={18} /> Adicionar campo</button></article>)}</div>
        </section>
      ) : null}

      {activeStep === "regras" ? (
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-4"><h3 className="text-xl font-bold text-gray-950">Campos e regras</h3><p className="text-sm font-semibold text-gray-500">Selecione um campo e defina seu comportamento.</p></div>
          {fields.length ? <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]"><aside className="grid content-start gap-2">{fields.map((field) => <button key={field.id} type="button" className={`rounded-md border p-3 text-left ${field.id === selectedField?.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-gray-50"}`} onClick={() => setSelectedFieldId(field.id)}><span className="block font-bold">{field.name}</span><span className="text-xs font-semibold text-gray-500">{field.sectionName}</span></button>)}</aside>{selectedField ? <div className="rounded-md border border-gray-200 bg-gray-50 p-4"><div className="grid gap-3 md:grid-cols-2"><GuidedInput label="Nome do campo" value={selectedField.name} onChange={(event) => updateField(selectedField.id, { name: event.target.value })} /><label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Tipo de resposta</span><select className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold" value={selectedField.type} onChange={(event) => updateField(selectedField.id, { type: event.target.value })}>{guidedFieldTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>{selectedField.type === "lista" ? <label className="md:col-span-2"><span className="mb-1 block text-xs font-bold uppercase text-gray-500">Opções, uma por linha</span><textarea className="min-h-28 w-full rounded-md border border-gray-300 bg-white p-3 font-semibold" value={selectedField.options.join("\n")} onChange={(event) => updateField(selectedField.id, { options: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} /></label> : null}{selectedField.type === "numero" ? <><GuidedInput label="Unidade" value={selectedField.unit} onChange={(event) => updateField(selectedField.id, { unit: event.target.value })} /><div className="grid grid-cols-2 gap-2"><GuidedInput label="Mínimo" type="number" value={selectedField.min} onChange={(event) => updateField(selectedField.id, { min: event.target.value })} /><GuidedInput label="Máximo" type="number" value={selectedField.max} onChange={(event) => updateField(selectedField.id, { max: event.target.value })} /></div></> : null}</div><div className="mt-4 grid gap-2"><label className="flex min-h-14 items-center gap-3 rounded-md border border-gray-200 bg-white p-3"><input type="checkbox" className="size-6" checked={selectedField.required} onChange={(event) => updateField(selectedField.id, { required: event.target.checked })} /><span><span className="block font-bold">Preenchimento obrigatório</span><span className="text-xs font-semibold text-gray-500">Impede a conclusão sem resposta.</span></span></label><label className="flex min-h-14 items-center gap-3 rounded-md border border-gray-200 bg-white p-3"><input type="checkbox" className="size-6" checked={selectedField.nc} onChange={(event) => updateField(selectedField.id, { nc: event.target.checked })} /><span><span className="block font-bold">Gerar NC automaticamente</span><span className="text-xs font-semibold text-gray-500">Para resposta NC ou valor fora dos limites.</span></span></label></div><button type="button" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 font-bold text-cicopal-red" onClick={() => removeField(selectedField.id)}><Trash2 size={18} /> Excluir campo</button></div> : null}</div> : <div className="rounded-md border border-dashed border-gray-300 p-8 text-center font-bold text-gray-500">Adicione campos na etapa Estrutura.</div>}
        </section>
      ) : null}

      {activeStep === "teste" ? (
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-gray-950">Prévia para o operador</h3><p className="text-sm font-semibold text-gray-500">Faça um preenchimento de teste antes de criar o modelo.</p></div><span className="audit-badge bg-blue-50 text-cicopal-blue">SIMULAÇÃO</span></div>
          <div className="rounded-md bg-cicopal-blue p-4 text-white"><p className="text-xs font-bold uppercase text-white/70">{draft.code} • Revisão {draft.revision}</p><h4 className="mt-1 text-xl font-bold">{draft.title}</h4><p className="mt-1 text-sm font-semibold text-white/80">{draft.description}</p></div>
          <div className="mt-3 space-y-3">{draft.sections.map((section) => <article key={section.id} className="rounded-md border border-gray-200 p-4"><h4 className="text-lg font-bold text-gray-950">{section.name}</h4><p className="text-sm font-semibold text-gray-500">{section.description}</p><div className="mt-3 grid gap-3 md:grid-cols-2">{section.fields.map((field) => <OperatorField key={field.id} field={field} value={testValues[field.id]} onChange={(value) => setTestValues((current) => ({ ...current, [field.id]: value }))} />)}</div></article>)}</div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md border border-cicopal-blue bg-blue-50 px-4 font-bold text-cicopal-blue" onClick={validateTest}><ClipboardCheck size={19} /> Validar teste</button><button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-green px-4 font-bold text-white" onClick={() => onCreate(draft)}><Check size={19} /> Criar RG no configurador</button></div>
        </section>
      ) : null}

      <div className="mt-3 flex items-center justify-between rounded-md bg-white p-3">
        <button type="button" className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-gray-300 px-3 font-bold ${stepIndex === 0 ? "invisible" : ""}`} onClick={() => goToStep(guidedSteps[stepIndex - 1]?.id)}><ArrowLeft size={18} /> Voltar</button>
        <span className="hidden text-sm font-bold text-gray-500 sm:block">Etapa {stepIndex + 1} de {guidedSteps.length}</span>
        <button type="button" className={`inline-flex min-h-11 items-center gap-2 rounded-md bg-cicopal-blue px-3 font-bold text-white ${stepIndex === guidedSteps.length - 1 ? "invisible" : ""}`} onClick={() => goToStep(guidedSteps[stepIndex + 1]?.id)}>Continuar <ArrowRight size={18} /></button>
      </div>
    </section>
  );
}
