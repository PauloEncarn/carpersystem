"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Check, Clock, FileSignature, Plus, RotateCcw, Upload, X } from "lucide-react";
import { ChecklistTable } from "@/components/ChecklistTable";
import { getRgDocumentConfig } from "@/lib/rgDocumentConfigs";

const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);

const liberacaoProdutoColumns = [
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

const avaliacaoProdutoColumns = [
  { label: "Umidade produto final", unit: "%" },
  { label: "Sal", unit: "%" },
  { label: "Temperatura de envase", unit: "deg C" }
];
const processoColumns = ["Datador", "Selagem", "Microfuro", "Caixa", "Etiqueta", "Peso", "Ar (mm)"];

const clextralParameterGroups = [
  {
    title: "Produto por horario",
    rows: [
      { label: "Marca", type: "select", options: ["MIC", "MIK", "ANE"] },
      { label: "Formato", type: "select", options: ["CX", "ZZ", "ANE", "CON"] },
      { label: "Sabor", type: "select", options: ["QJ", "RQ", "CB", "PZ", "PR", "CM", "GL", "CR"] }
    ]
  },
  {
    title: "Parametros extrusora",
    rows: [
      { label: "Dosagem farinha", unit: "Kg/h" },
      { label: "Dosagem agua", unit: "L/h" },
      { label: "Rotacao rosca", unit: "rpm" },
      { label: "Torque", unit: "%" },
      { label: "Amps - BA", unit: "A" },
      { label: "Zona 1", type: "group", fields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
      { label: "Zona 2", type: "group", fields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
      { label: "Zona 3", type: "group", fields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
      { label: "Fieira", unit: "BAR" },
      { label: "Bomba de oleo", unit: "Hz" },
      { label: "Refrigeracao", unit: "deg C" },
      { label: "Rotacao cortador", unit: "rpm" }
    ]
  },
  {
    title: "Dimensional",
    rows: [
      { label: "Comp. / Diametro", unit: "mm" },
      { label: "Larg. Sup. / Espes.", unit: "mm" },
      { label: "Larg. Inferior", unit: "mm" },
      { label: "Altura", unit: "mm" }
    ]
  },
  {
    title: "Forno",
    rows: [
      { label: "Temp. fieira", unit: "deg C" },
      { label: "Temp. zona 1 forno", type: "group", fields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
      { label: "Temp. zona 2 forno", type: "group", fields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
      { label: "Tempo residencia", unit: "min" }
    ]
  },
  {
    title: "Qualidade",
    rows: [
      { label: "Densidade", unit: "g/L" },
      { label: "Umidade", unit: "%" },
      { label: "SME", unit: "KW/Kg.hr" }
    ]
  }
];

function Field({ label, defaultValue = "", placeholder = "", type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">{label}</span>
      <input
        type={type}
        className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({ label, defaultValue = "", options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">{label}</span>
      <select className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold" defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ObservacoesProcesso({ value, onChange }) {
  return (
    <section className="mb-4 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-950">Observacoes</h2>
        <p className="text-sm font-semibold text-gray-500">Anote pontos importantes do RG e deste processo.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Observacao do RG</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
            value={value.rg}
            onChange={(event) => onChange({ ...value, rg: event.target.value })}
            placeholder="Observacao geral deste RG no lote/data"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Observacao do processo</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
            value={value.processo}
            onChange={(event) => onChange({ ...value, processo: event.target.value })}
            placeholder="Observacao especifica deste preenchimento"
          />
        </label>
      </div>
    </section>
  );
}

function SaveProcessBar({ savedAt, onSave }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-3">
      <span className="text-sm font-bold text-gray-500">
        {savedAt ? `Registro gravado as ${savedAt}` : "Grave para aparecer na lista de registros do processo."}
      </span>
      <button
        type="button"
        className="inline-flex min-h-14 items-center justify-center rounded-md bg-cicopal-blue px-5 text-base font-bold text-white shadow-soft"
        onClick={onSave}
      >
        Gravar registro
      </button>
    </div>
  );
}

function StatusClickButton({ value: controlledValue, onChange }) {
  const [internalValue, setInternalValue] = useState("");
  const lastTapRef = useRef(0);
  const value = controlledValue ?? internalValue;

  function setValue(nextValue) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  function handlePointerUp() {
    const now = Date.now();
    if (now - lastTapRef.current < 340) {
      setValue("NC");
    } else {
      setValue("C");
    }
    lastTapRef.current = now;
  }

  return (
    <button
      type="button"
      className={`min-h-12 w-full touch-manipulation rounded-md border px-2 text-sm font-bold ${
        value === "NC"
          ? "border-cicopal-red bg-cicopal-red text-white"
          : value === "C"
            ? "border-cicopal-green bg-cicopal-green text-white"
            : "border-green-200 bg-green-50 text-cicopal-green"
      }`}
      onPointerUp={handlePointerUp}
      title="Um clique confirma C. Dois cliques marcam NC."
    >
      {value || "C"}
    </button>
  );
}

function makeNcId(base = "NC") {
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function HourlyTable({ title, columns, minWidth = "min-w-[980px]", onSave }) {
  const [values, setValues] = useState({});
  const [savedAt, setSavedAt] = useState("");

  function valueKey(hour, column) {
    return `${hour}|${column}`;
  }

  function updateValue(hour, column, value) {
    setValues((current) => ({
      ...current,
      [valueKey(hour, column)]: value
    }));
  }

  function saveHourlyTable() {
    const apontamentos = Object.entries(values).map(([key, resultado]) => {
      const [horario, item] = key.split("|");
      return { horario, item, resultado };
    });
    const ncs = apontamentos
      .filter((apontamento) => apontamento.resultado === "NC")
      .map((apontamento, index) => ({
        id: `${makeNcId(title)}-NC-${String(index + 1).padStart(2, "0")}`,
        item: apontamento.item,
        status: "Aberta",
        horario: apontamento.horario,
        quantidade: "-",
        descricao: `${apontamento.item} marcado como NC em ${apontamento.horario}`,
        causa: "Nao informada",
        acao: "Nao informada",
        disposicaoImediata: "Nao informada",
        disposicaoFinal: "Nao informada",
        operador: "Operador logado",
        produto: "-",
        assinaturaSupervisorAt: null
      }));

    onSave?.({ apontamentos, ncs });
    setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }

  return (
    <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 p-3">
        <Clock size={24} className="text-cicopal-blue" />
        <div>
          <h2 className="text-xl font-bold text-gray-950">{title}</h2>
          <p className="text-sm font-semibold text-gray-600">Hora em hora</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={`audit-table ${minWidth} text-left`}>
          <thead>
            <tr>
              <th className="w-24 px-3 py-3">Hora</th>
              {columns.map((column) => (
                <th key={column} className="px-3 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {hours.map((hour) => (
              <tr key={hour} className="bg-white">
                <td className="px-3 py-3 text-base font-bold text-gray-950">{hour}</td>
                {columns.map((column) => (
                <td key={`${hour}-${column}`} className="px-3 py-3">
                    <StatusClickButton value={values[valueKey(hour, column)]} onChange={(value) => updateValue(hour, column, value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-3">
        <span className="text-sm font-bold text-gray-500">
          {savedAt ? `Bloco gravado as ${savedAt}` : "Dois toques em um item geram NC ao gravar."}
        </span>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-cicopal-blue px-4 font-bold text-white"
          onClick={saveHourlyTable}
        >
          Gravar bloco
        </button>
      </div>
    </section>
  );
}

function LiberacaoProdutoTable({ columns = liberacaoProdutoColumns, onSave }) {
  const [rows, setRows] = useState([{ id: 1 }]);
  const [values, setValues] = useState({});
  const [savedAt, setSavedAt] = useState("");

  function valueKey(rowId, column) {
    return `${rowId}|${column}`;
  }

  function updateValue(rowId, column, value) {
    setValues((current) => ({ ...current, [valueKey(rowId, column)]: value }));
  }

  function saveLiberacao() {
    const apontamentos = rows.flatMap((row) =>
      columns
        .filter((column) => values[valueKey(row.id, column)])
        .map((column) => ({
          horario: row.horario || "-",
          item: column,
          resultado: values[valueKey(row.id, column)]
        }))
    );
    const ncs = apontamentos
      .filter((apontamento) => apontamento.resultado === "NC")
      .map((apontamento, index) => ({
        id: `LIBP-NC-${String(index + 1).padStart(2, "0")}`,
        item: apontamento.item,
        status: "Aberta",
        horario: apontamento.horario,
        quantidade: "-",
        descricao: `${apontamento.item} marcado como NC na liberacao`,
        causa: "Nao informada",
        acao: "Nao informada",
        disposicaoImediata: "Nao informada",
        disposicaoFinal: "Nao informada",
        operador: "Operador logado",
        produto: "-",
        assinaturaSupervisorAt: null
      }));

    onSave?.({ apontamentos, ncs });
    setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }

  return (
    <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 p-3">
        <Check size={24} className="text-cicopal-blue" />
        <div>
          <h2 className="text-xl font-bold text-gray-950">Liberacao do Produto</h2>
          <p className="text-sm font-semibold text-gray-600">Registre cada horario em que o produto for liberado</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="audit-table min-w-[1180px] text-left">
          <thead>
            <tr>
              <th className="w-28 px-3 py-3">Hora</th>
              {columns.map((column) => (
                <th key={column} className="px-3 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="bg-white">
                <td className="px-3 py-3">
                  <input
                    type="time"
                    className="min-h-12 w-full rounded-md border border-gray-300 px-2 font-semibold"
                    value={row.horario ?? ""}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((entry) => (entry.id === row.id ? { ...entry, horario: event.target.value } : entry))
                      )
                    }
                  />
                </td>
                {columns.map((column) => (
                  <td key={column} className="px-3 py-3">
                    <StatusClickButton value={values[valueKey(row.id, column)]} onChange={(value) => updateValue(row.id, column, value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white"
            onClick={() => setRows((current) => [...current, { id: current.length + 1 }])}
          >
            <Plus size={18} />
            Adicionar horario
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-gray-500">
              {savedAt ? `Liberacao gravada as ${savedAt}` : "Dois toques em item C/NC geram NC ao gravar."}
            </span>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-cicopal-blue px-4 font-bold text-white"
              onClick={saveLiberacao}
            >
              Gravar liberacao
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductEvaluationHourlyTable({ columns = avaliacaoProdutoColumns }) {
  return (
    <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 p-3">
        <Clock size={24} className="text-cicopal-blue" />
        <div>
          <h2 className="text-xl font-bold text-gray-950">Avaliacao do Produto</h2>
          <p className="text-sm font-semibold text-gray-600">Hora em hora</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="audit-table min-w-[720px] text-left">
          <thead>
            <tr>
              <th className="w-24 px-3 py-3">Hora</th>
              {columns.map((column) => (
                <th key={column.label} className="px-3 py-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {hours.map((hour) => (
              <tr key={hour} className="bg-white">
                <td className="px-3 py-3 text-base font-bold text-gray-950">{hour}</td>
                {columns.map((column) => (
                  <td key={`${hour}-${column.label}`} className="px-3 py-3">
                    <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
                      <input
                        type="number"
                        step="0.01"
                        className="min-h-12 w-full min-w-24 px-3 font-semibold outline-none"
                      />
                      <span className="flex min-h-12 items-center bg-gray-100 px-3 text-sm font-bold text-gray-600">
                        {column.unit}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MachineHourlySections({ title, machines = [], onSave }) {
  if (!machines.length) return null;

  return (
    <div className="space-y-4">
      {machines.map((machine) => (
        <HourlyTable
          key={machine.label}
          title={`${title} - ${machine.label}`}
          columns={machine.columns}
          minWidth="min-w-[860px]"
          onSave={onSave}
        />
      ))}
    </div>
  );
}

function NumericUnitInput({ unit }) {
  return (
    <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
      <input type="number" step="0.01" className="min-h-12 w-full min-w-24 px-3 font-semibold outline-none" />
      <span className="flex min-h-12 items-center bg-gray-100 px-3 text-xs font-bold text-gray-600">{unit}</span>
    </div>
  );
}

function getCurrentHourSlot() {
  const currentHour = new Date().getHours();
  return `${String(currentHour).padStart(2, "0")}:00`;
}

function ClextralTimeCell({ row, value, onChange }) {
  if (row.type === "select") {
    return (
      <select
        className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 text-base font-semibold"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">-</option>
        {row.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (row.type === "group") {
    const groupValue = value ?? {};
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {row.fields.map((field) => (
          <label key={field.label} className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-gray-500">{field.label}</span>
            <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
              <input
                type="number"
                step="0.01"
                className="min-h-12 w-full px-3 font-semibold outline-none"
                value={groupValue[field.label] ?? ""}
                onChange={(event) => onChange({ ...groupValue, [field.label]: event.target.value })}
              />
              <span className="flex min-h-12 items-center bg-gray-100 px-3 text-xs font-bold text-gray-600">{field.unit}</span>
            </div>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
      <input
        type="number"
        step="0.01"
        className="min-h-12 w-full px-3 font-semibold outline-none"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="flex min-h-12 items-center bg-gray-100 px-3 text-xs font-bold text-gray-600">{row.unit}</span>
    </div>
  );
}

function ClextralContexto({ registro }) {
  return (
    <section className="mb-4 rounded-md border border-gray-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Data" type="date" />
        <Field label="Operador TA" defaultValue={registro?.operador ?? ""} />
        <Field label="Operador TB" />
        <Field label="Operador TC" />
      </div>
      <p className="mt-3 text-xs font-semibold text-gray-500">
        Marca, formato e sabor sao preenchidos por horario, pois podem mudar ao longo da producao.
      </p>
    </section>
  );
}

function ClextralParameterTable({ registro }) {
  const [activeHour, setActiveHour] = useState(() => getCurrentHourSlot());
  const [hourValues, setHourValues] = useState({});
  const [savedHours, setSavedHours] = useState([]);
  const activeHourIndex = hours.indexOf(activeHour);

  function valueKey(groupTitle, rowLabel) {
    return `${groupTitle}:${rowLabel}`;
  }

  function updateHourValue(groupTitle, rowLabel, value) {
    const key = valueKey(groupTitle, rowLabel);
    setHourValues((current) => ({
      ...current,
      [activeHour]: {
        ...(current[activeHour] ?? {}),
        [key]: value
      }
    }));
  }

  function saveCurrentHour(nextHour = activeHour) {
    setSavedHours((current) => (current.includes(activeHour) ? current : [...current, activeHour]));
    setActiveHour(nextHour);
  }

  function goNextHour() {
    const nextHour = hours[Math.min(activeHourIndex + 1, hours.length - 1)];
    saveCurrentHour(nextHour);
  }

  return (
    <section className="space-y-4">
      <div className="sticky top-0 z-20 rounded-md border border-cicopal-blue bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">Horario ativo</p>
            <h2 className="text-3xl font-black text-cicopal-blue">{activeHour}</h2>
          </div>
          <label className="min-w-[240px] flex-1 md:max-w-sm">
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Operador deste horario</span>
            <input
              className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
              value={hourValues[activeHour]?.operador ?? registro?.operador ?? "Operador logado"}
              onChange={(event) =>
                setHourValues((current) => ({
                  ...current,
                  [activeHour]: {
                    ...(current[activeHour] ?? {}),
                    operador: event.target.value
                  }
                }))
              }
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-12 rounded-md border border-gray-300 bg-white px-4 font-bold text-gray-700"
              onClick={() => saveCurrentHour(activeHour)}
            >
              Salvar horario
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white disabled:bg-gray-300"
              onClick={goNextHour}
              disabled={activeHourIndex === hours.length - 1}
            >
              Proximo <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {hours.map((hour) => {
            const active = hour === activeHour;
            const saved = savedHours.includes(hour);
            return (
              <button
                key={hour}
                type="button"
                className={`min-h-12 min-w-20 rounded-md border px-3 text-sm font-black ${
                  active
                    ? "border-cicopal-blue bg-cicopal-blue text-white"
                    : saved
                      ? "border-cicopal-green bg-green-50 text-cicopal-green"
                      : hour === getCurrentHourSlot()
                        ? "border-cicopal-blue bg-blue-50 text-cicopal-blue"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                }`}
                onClick={() => setActiveHour(hour)}
              >
                {hour}
                {saved ? <span className="ml-1">OK</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {clextralParameterGroups.map((group) => (
        <section key={group.title} className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-200 p-3">
            <Clock size={24} className="text-cicopal-blue" />
            <div>
              <h2 className="text-xl font-bold text-gray-950">{group.title}</h2>
              <p className="text-sm font-semibold text-gray-600">Parametros por horario</p>
            </div>
          </div>
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {group.rows.map((row) => {
              const key = valueKey(group.title, row.label);
              return (
                <div key={key} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <span className="mb-2 block text-sm font-black text-gray-950">{row.label}</span>
                  <ClextralTimeCell
                    row={row}
                    value={hourValues[activeHour]?.[key]}
                    onChange={(value) => updateHourValue(group.title, row.label, value)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

function ClextralOccurrencesTable() {
  const [rows, setRows] = useState([{ id: 1 }]);

  return (
    <section className="overflow-hidden rounded-md border border-red-100 bg-white">
      <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 p-3">
        <X size={24} className="text-cicopal-red" />
        <div>
          <h2 className="text-xl font-bold text-gray-950">Ocorrencias / Nao conformidades</h2>
          <p className="text-sm font-semibold text-gray-600">Horario, causa, acao e responsavel</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="audit-table min-w-[980px] text-left">
          <thead>
            <tr>
              <th className="w-28 px-3 py-3">Horario</th>
              <th className="px-3 py-3">Nao conformidade</th>
              <th className="px-3 py-3">Causa</th>
              <th className="px-3 py-3">Acao</th>
              <th className="px-3 py-3">Responsavel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="bg-white">
                <td className="px-3 py-3">
                  <input type="time" className="min-h-12 w-full rounded-md border border-gray-300 px-2 font-semibold" />
                </td>
                {["Nao conformidade", "Causa", "Acao", "Responsavel"].map((column) => (
                  <td key={column} className="px-3 py-3">
                    <input className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-200 p-3">
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-red px-4 font-bold text-white"
          onClick={() => setRows((current) => [...current, { id: current.length + 1 }])}
        >
          <Plus size={18} />
          Adicionar ocorrencia
        </button>
      </div>
    </section>
  );
}

function getCurrentTimeValue() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function BateladaMilhoForm({ registro }) {
  const [rows, setRows] = useState([]);

  function addBatelada() {
    setRows((current) => [
      ...current,
      {
        id: current.length + 1,
        numero: current.length + 1,
        horario: getCurrentTimeValue()
      }
    ]);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-gray-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Data" type="date" />
          <Field label="Produto" defaultValue={registro?.produto ?? ""} />
          <Field label="Supervisor" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Lote urucum" />
          <Field label="Lote carbonato de calcio" />
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-3">
          <div className="flex items-center gap-3">
            <Clock size={24} className="text-cicopal-blue" />
            <div>
              <h2 className="text-xl font-bold text-gray-950">Bateladas</h2>
              <p className="text-sm font-semibold text-gray-600">Adicione uma batelada a cada preparo do milho</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white"
            onClick={addBatelada}
          >
            <Plus size={18} />
            Adicionar batelada
          </button>
        </div>

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="audit-table min-w-[1180px] text-left">
              <thead>
                <tr>
                  <th className="w-20 px-3 py-3">N</th>
                  <th className="w-28 px-3 py-3">Horario</th>
                  <th className="px-3 py-3">Operador</th>
                  <th className="px-3 py-3">Quantidade</th>
                  <th className="px-3 py-3">Fornecedor</th>
                  <th className="px-3 py-3">Lote</th>
                  <th className="px-3 py-3">Validade</th>
                  <th className="px-3 py-3">Urucum</th>
                  <th className="px-3 py-3">Carbonato calcio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row.id} className="bg-white">
                    <td className="px-3 py-3 text-base font-bold text-gray-950">{row.numero}</td>
                    <td className="px-3 py-3">
                      <input type="time" className="min-h-12 w-full rounded-md border border-gray-300 px-2 font-semibold" defaultValue={row.horario} />
                    </td>
                    <td className="px-3 py-3">
                      <input className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" defaultValue={registro?.operador ?? "Operador logado"} />
                    </td>
                    <td className="px-3 py-3">
                      <NumericUnitInput unit="kg" />
                    </td>
                    <td className="px-3 py-3">
                      <input className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" />
                    </td>
                    <td className="px-3 py-3">
                      <input className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="date" className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" />
                    </td>
                    <td className="px-3 py-3">
                      <NumericUnitInput unit="kg" />
                    </td>
                    <td className="px-3 py-3">
                      <NumericUnitInput unit="kg" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-[1fr_260px]">
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-lg font-bold text-gray-950">Nenhuma batelada adicionada</p>
              <p className="mt-1 text-sm font-semibold text-gray-600">Clique para criar a primeira linha com o horario atual.</p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-20 items-center justify-center gap-2 rounded-md bg-cicopal-blue px-4 text-lg font-bold text-white"
              onClick={addBatelada}
            >
              <Plus size={20} />
              Nova batelada
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function setupSignatureContext(canvas) {
  const context = canvas.getContext("2d");
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3;
  context.strokeStyle = "#111827";
  return context;
}

function SignaturePadModal({ label, nome, onClose, onSave }) {
  const canvasRef = useRef(null);
  const lastPointRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);

    const context = setupSignatureContext(canvas);
    context.scale(ratio, ratio);
  }, []);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function startDrawing(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture?.(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getPoint(event);
  }

  function draw(event) {
    if (!isDrawingRef.current) return;

    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = getPoint(event);
    const lastPoint = lastPointRef.current ?? point;

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    lastPointRef.current = point;
    setHasInk(true);
  }

  function stopDrawing(event) {
    event.preventDefault();
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    setHasInk(false);
  }

  function saveSignature() {
    if (!hasInk) return;

    onSave({
      nome,
      dataHora: new Date().toLocaleString("pt-BR"),
      imagem: canvasRef.current.toDataURL("image/png")
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section className="w-full max-w-3xl overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-xl font-bold text-gray-950">Assinatura - {label}</h2>
            <p className="text-sm font-semibold text-gray-500">{nome}</p>
          </div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700"
            onClick={onClose}
            aria-label="Fechar assinatura"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-4">
          <canvas
            ref={canvasRef}
            className="h-72 w-full touch-none rounded-md border-2 border-dashed border-gray-300 bg-white"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={(event) => {
              if (isDrawingRef.current) stopDrawing(event);
            }}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 font-bold text-gray-700"
              onClick={clearSignature}
            >
              <RotateCcw size={20} />
              Limpar
            </button>
            <button
              type="button"
              className={`inline-flex min-h-12 items-center gap-2 rounded-md px-5 font-bold text-white ${
                hasInk ? "bg-cicopal-blue" : "bg-gray-300"
              }`}
              onClick={saveSignature}
              disabled={!hasInk}
            >
              <Check size={20} />
              Salvar assinatura
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SignatureActionButton({ assinatura, onOpen }) {
  const activatedAtRef = useRef(0);

  function openSignature() {
    const now = Date.now();

    if (now - activatedAtRef.current < 350) return;

    activatedAtRef.current = now;
    onOpen();
  }

  return (
    <button
      type="button"
      className={`mt-3 inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-md px-3 font-bold ${
        assinatura ? "bg-cicopal-green text-white" : "bg-cicopal-blue text-white"
      }`}
      onClick={openSignature}
      onMouseDown={openSignature}
      onPointerDown={openSignature}
      onPointerUp={openSignature}
      onTouchStart={openSignature}
      onTouchEnd={openSignature}
    >
      {assinatura ? "Assinar novamente" : "Assinar"}
    </button>
  );
}

function AssinaturasRegistro({ registro }) {
  const assinaturas = registro?.subregistros?.[0]?.assinaturas ?? {};
  const [signed, setSigned] = useState(assinaturas);
  const [activeSigner, setActiveSigner] = useState(null);

  const names = {
    Operador: registro?.operador ?? "Operador logado",
    Qualidade: "Qualidade",
    Supervisor: "Supervisor"
  };

  function salvarAssinatura(assinatura) {
    setSigned((current) => ({
      ...current,
      [activeSigner.toLowerCase()]: assinatura
    }));
    setActiveSigner(null);
  }

  return (
    <section className="mt-4 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-950">
        <FileSignature size={22} className="text-cicopal-blue" />
        Assinaturas
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Operador", signed.operador],
          ["Qualidade", signed.qualidade],
          ["Supervisor", signed.supervisor]
        ].map(([label, assinatura]) => (
          <div
            key={label}
            className={`rounded-md border p-3 ${assinatura ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}
          >
            <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
            <p className="mt-1 min-h-6 font-semibold text-gray-800">{assinatura?.nome ?? "Pendente"}</p>
            <p className="text-xs font-semibold text-gray-500">{assinatura?.dataHora ?? ""}</p>
            {assinatura?.imagem ? (
              <div className="mt-2 flex h-20 items-center rounded-md border border-green-200 bg-white p-2">
                <img src={assinatura.imagem} alt={`Assinatura ${label}`} className="h-full w-full object-contain" />
              </div>
            ) : null}
            <SignatureActionButton assinatura={assinatura} onOpen={() => setActiveSigner(label)} />
          </div>
        ))}
      </div>
      {activeSigner ? (
        <SignaturePadModal
          label={activeSigner}
          nome={names[activeSigner]}
          onClose={() => setActiveSigner(null)}
          onSave={salvarAssinatura}
        />
      ) : null}
    </section>
  );
}

function PhotoHourlyGrid() {
  const [photos, setPhotos] = useState({});

  function updatePhoto(hour, file) {
    if (!file) return;
    setPhotos((current) => ({
      ...current,
      [hour]: file.name
    }));
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-4 flex items-center gap-3">
        <Camera size={24} className="text-cicopal-blue" />
        <div>
          <h2 className="text-xl font-bold text-gray-950">RG - Registro Fotografico</h2>
          <p className="text-sm font-semibold text-gray-600">Registro visual do produto de hora em hora</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {hours.map((hour) => (
          <article key={hour} className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-lg font-bold text-gray-950">{hour}</span>
              <span
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  photos[hour] ? "bg-green-100 text-cicopal-green" : "bg-gray-100 text-gray-600"
                }`}
              >
                {photos[hour] ? "Foto anexada" : "Pendente"}
              </span>
            </div>
            <label className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 font-bold text-gray-600">
              <Camera size={24} />
              Tirar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => updatePhoto(hour, event.target.files?.[0])}
              />
            </label>
            <label className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 bg-white font-bold text-gray-700">
              <Upload size={20} />
              Anexar arquivo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => updatePhoto(hour, event.target.files?.[0])}
              />
            </label>
            {photos[hour] ? <p className="mt-2 truncate text-xs font-semibold text-gray-500">{photos[hour]}</p> : null}
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Observacao</span>
              <input className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" />
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}

function HigienizacaoContexto({ registro }) {
  return (
    <section className="mb-4 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Field label="Operador logado" defaultValue={registro?.operador ?? "Operador logado"} />
        <SelectField label="Turno operador" defaultValue={registro?.turno ?? "A"} options={["A", "B", "C"]} />
        <SelectField
          label="Tipo de setup"
          defaultValue={registro?.motivo ?? "Troca de sabor/produto"}
          options={["Troca de sabor/produto", "Inicio de producao semana", "Final de producao", "Outros"]}
        />
      </div>
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <Field label="Troca de sabor/produto de" defaultValue={registro?.setupDe ?? ""} placeholder="Produto anterior" />
        <Field label="Para" defaultValue={registro?.setupPara ?? registro?.produto ?? ""} placeholder="Produto novo" />
      </div>
      <Field label="Matriz de troca" defaultValue={registro?.matriz ?? ""} placeholder="Ex: de Cebola para Bacon" />
    </section>
  );
}

function ProdutoContexto({ registro }) {
  return (
    <section className="mb-4 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Field label="Marca" defaultValue={registro?.marca ?? ""} />
        <Field label="Sabor" defaultValue={registro?.sabor ?? registro?.produto ?? ""} />
        <Field label="Gramatura" defaultValue={registro?.gramatura ?? ""} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Operador logado" defaultValue={registro?.operador ?? "Operador logado"} />
        <SelectField label="Turno operador" defaultValue={registro?.turno ?? "A"} options={["A", "B", "C"]} />
        <Field label="Data/Hora do registro" defaultValue={registro?.dataRegistro ?? ""} />
      </div>
    </section>
  );
}

export function Rg005SubregistroForm({ documentName, loteId, registro, subregistro, onSave }) {
  const [observacoes, setObservacoes] = useState({ rg: "", processo: "" });
  const [savedAt, setSavedAt] = useState("");
  if (!subregistro) return null;
  const config = getRgDocumentConfig(documentName);
  const observacoesPanel = <ObservacoesProcesso value={observacoes} onChange={setObservacoes} />;

  function saveProcesso(payload = {}) {
    onSave?.({
      registro: {
        ...registro,
        status: "Gravado",
        observacaoRg: observacoes.rg,
        observacaoProcesso: observacoes.processo,
        dataRegistro: registro?.dataRegistro === "Novo registro" ? new Date().toLocaleString("pt-BR") : registro?.dataRegistro
      },
      subregistro: {
        ...subregistro,
        ...payload,
        status: payload.ncs?.length ? "Com NC" : "Gravado",
        observacoes
      }
    });
    setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }

  if (subregistro.id === "higienizacao") {
    return (
      <>
        {observacoesPanel}
        <HigienizacaoContexto registro={registro} />
        <ChecklistTable
          documentName={`${documentName} - Higienizacao`}
          loteId={loteId}
          registro={registro}
          subregistro={subregistro}
          groups={config.checklistGroups}
          onSave={saveProcesso}
        />
        <AssinaturasRegistro registro={registro} />
      </>
    );
  }

  if (subregistro.id === "produto_liberacao") {
    return (
      <>
        {observacoesPanel}
        <ProdutoContexto registro={registro} />
        <LiberacaoProdutoTable columns={config.liberacaoProdutoColumns} onSave={saveProcesso} />
        <AssinaturasRegistro registro={registro} />
      </>
    );
  }

  if (subregistro.id === "produto_avaliacao") {
    return (
      <>
        {observacoesPanel}
        <ProdutoContexto registro={registro} />
        <ProductEvaluationHourlyTable columns={config.avaliacaoProdutoColumns} />
        <MachineHourlySections title="Avaliacao por maquina" machines={config.produtoMaquinas} onSave={saveProcesso} />
        <SaveProcessBar savedAt={savedAt} onSave={() => saveProcesso()} />
        <AssinaturasRegistro registro={registro} />
      </>
    );
  }

  if (subregistro.id === "processo") {
    return (
      <>
        {observacoesPanel}
        <MachineHourlySections
          title="RG - Processo"
          machines={config.processoMaquinas?.length ? config.processoMaquinas : [{ label: "Linha", columns: processoColumns }]}
          onSave={saveProcesso}
        />
        <AssinaturasRegistro registro={registro} />
      </>
    );
  }

  if (subregistro.id === "fotografico") {
    return (
      <>
        {observacoesPanel}
        <PhotoHourlyGrid />
        <SaveProcessBar savedAt={savedAt} onSave={() => saveProcesso()} />
        <AssinaturasRegistro registro={registro} />
      </>
    );
  }

  if (subregistro.id === "extrusora_clextral") {
    return (
      <div className="space-y-4">
        {observacoesPanel}
        <ClextralContexto registro={registro} />
        <ClextralParameterTable registro={registro} />
        <ClextralOccurrencesTable />
        <SaveProcessBar savedAt={savedAt} onSave={() => saveProcesso()} />
        <AssinaturasRegistro registro={registro} />
      </div>
    );
  }

  if (subregistro.id === "batelada_milho") {
    return (
      <>
        {observacoesPanel}
        <BateladaMilhoForm registro={registro} />
        <SaveProcessBar savedAt={savedAt} onSave={() => saveProcesso()} />
        <AssinaturasRegistro registro={registro} />
      </>
    );
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Check size={24} className="text-cicopal-green" />
        <p className="text-lg font-bold text-gray-950">Subregistro selecionado.</p>
      </div>
    </section>
  );
}

