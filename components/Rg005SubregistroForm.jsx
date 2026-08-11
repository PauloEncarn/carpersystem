"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FileSignature,
  Plus,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { ChecklistTable } from "@/components/ChecklistTable";
import { getRgDocumentConfig } from "@/lib/rgDocumentConfigs";
import {
  loadRg003Record,
  persistCycleTransition,
} from "@/lib/rg003Persistence";
import { repairTextDeep } from "@/lib/textEncoding";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  classifyProductValue,
  matchSpecification,
  specificationTone,
} from "@/lib/productSpecifications";

const hours = Array.from(
  { length: 24 },
  (_, index) => `${String(index).padStart(2, "0")}:00`,
);

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
  "Tempo residencia",
];

const avaliacaoProdutoColumns = [
  { label: "Umidade produto final", unit: "%" },
  { label: "Sal", unit: "%" },
  { label: "Temperatura de envase", unit: "deg C" },
];
const processoColumns = [
  "Datador",
  "Selagem",
  "Microfuro",
  "Caixa",
  "Etiqueta",
  "Peso",
  "Ar (mm)",
];

const clextralParameterGroups = [
  {
    title: "Produto por horario",
    rows: [
      { label: "Marca", type: "select", options: ["MIC", "MIK", "ANE"] },
      { label: "Formato", type: "select", options: ["CX", "ZZ", "ANE", "CON"] },
      {
        label: "Sabor",
        type: "select",
        options: ["QJ", "RQ", "CB", "PZ", "PR", "CM", "GL", "CR"],
      },
    ],
  },
  {
    title: "Parametros extrusora",
    rows: [
      { label: "Dosagem farinha", unit: "Kg/h" },
      { label: "Dosagem agua", unit: "L/h" },
      { label: "Rotacao rosca", unit: "rpm" },
      { label: "Torque", unit: "%" },
      { label: "Amps - BA", unit: "A" },
      {
        label: "Zona 1",
        type: "group",
        fields: [
          { label: "Set point", unit: "deg C" },
          { label: "Real", unit: "deg C" },
        ],
      },
      {
        label: "Zona 2",
        type: "group",
        fields: [
          { label: "Set point", unit: "deg C" },
          { label: "Real", unit: "deg C" },
        ],
      },
      {
        label: "Zona 3",
        type: "group",
        fields: [
          { label: "Set point", unit: "deg C" },
          { label: "Real", unit: "deg C" },
        ],
      },
      { label: "Fieira", unit: "BAR" },
      { label: "Bomba de oleo", unit: "Hz" },
      { label: "Refrigeracao", unit: "deg C" },
      { label: "Rotacao cortador", unit: "rpm" },
    ],
  },
  {
    title: "Dimensional",
    rows: [
      { label: "Comp. / Diametro", unit: "mm" },
      { label: "Larg. Sup. / Espes.", unit: "mm" },
      { label: "Larg. Inferior", unit: "mm" },
      { label: "Altura", unit: "mm" },
    ],
  },
  {
    title: "Forno",
    rows: [
      { label: "Temp. fieira", unit: "deg C" },
      {
        label: "Temp. zona 1 forno",
        type: "group",
        fields: [
          { label: "Set point", unit: "deg C" },
          { label: "Real", unit: "deg C" },
        ],
      },
      {
        label: "Temp. zona 2 forno",
        type: "group",
        fields: [
          { label: "Set point", unit: "deg C" },
          { label: "Real", unit: "deg C" },
        ],
      },
      { label: "Tempo residencia", unit: "min" },
    ],
  },
  {
    title: "Qualidade",
    rows: [
      { label: "Densidade", unit: "g/L" },
      { label: "Umidade", unit: "%" },
      { label: "SME", unit: "KW/Kg.hr" },
    ],
  },
];

function Field({ label, defaultValue = "", placeholder = "", type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
        {label}
      </span>
      <input
        type={type}
        className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </label>
  );
}

function LockedField({ label, value = "" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
        {label}
      </span>
      <div className="flex min-h-12 items-center rounded-md border border-gray-200 bg-gray-50 px-3 font-bold text-gray-800">
        {value || "-"}
      </div>
    </label>
  );
}

function SelectField({ label, defaultValue = "", options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
        {label}
      </span>
      <select
        className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold"
        defaultValue={defaultValue}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SaveProcessBar({ savedAt, onSave }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-3">
      <span className="text-sm font-bold text-gray-500">
        {savedAt
          ? `Registro gravado as ${savedAt}`
          : "Grave para aparecer na lista de registros do processo."}
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

function StatusClickButton({ value: controlledValue, onChange, onConfirm }) {
  const [internalValue, setInternalValue] = useState("");
  const tapRef = useRef({ value: "", at: 0 });
  const value = controlledValue ?? internalValue;

  function setValue(nextValue) {
    const now = Date.now();
    const confirmed =
      tapRef.current.value === nextValue && now - tapRef.current.at < 900;
    setInternalValue(nextValue);
    onChange?.(nextValue);
    tapRef.current = { value: nextValue, at: now };
    if (confirmed) onConfirm?.(nextValue);
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <button
        type="button"
        className={`min-h-24 touch-manipulation rounded-2xl border-2 text-lg font-black transition ${value === "C" ? "border-cicopal-green bg-cicopal-green text-white shadow-lg" : "border-green-200 bg-green-50 text-cicopal-green"}`}
        onClick={() => setValue("C")}
      >
        <span className="block text-2xl">C</span>
        <span className="text-sm">Conforme</span>
      </button>
      <button
        type="button"
        className={`min-h-24 touch-manipulation rounded-2xl border-2 text-lg font-black transition ${value === "N" || value === "NC" ? "border-cicopal-red bg-cicopal-red text-white shadow-lg" : "border-red-200 bg-red-50 text-cicopal-red"}`}
        onClick={() => setValue("N")}
      >
        <span className="block text-2xl">N</span>
        <span className="text-sm">Não conforme</span>
      </button>
      <button
        type="button"
        className={`min-h-24 touch-manipulation rounded-2xl border-2 text-lg font-black transition ${value === "NA" ? "border-gray-500 bg-gray-600 text-white shadow-lg" : "border-gray-300 bg-gray-100 text-gray-600"}`}
        onClick={() => setValue("NA")}
      >
        <span className="block text-2xl">NA</span>
        <span className="text-sm">Não se aplica</span>
      </button>
    </div>
  );
}

function SystemConfirmationDialog({ confirmation, onAnswer }) {
  if (!confirmation) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#11152a]/70 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="system-confirmation-title"
        className="w-full max-w-lg overflow-hidden border border-gray-200 bg-white shadow-2xl"
      >
        <header className="border-b border-gray-200 bg-[#f5f6fa] p-5">
          <p className="text-xs font-black uppercase tracking-[.14em] text-cicopal-blue">
            CICOPAL · Confirmação do evento
          </p>
          <h2
            id="system-confirmation-title"
            className="mt-2 text-2xl font-black text-gray-950"
          >
            {confirmation.title}
          </h2>
        </header>
        <div className="p-5">
          <p className="text-base font-semibold leading-relaxed text-gray-600">
            {confirmation.description}
          </p>
          <div className="mt-4 border-l-4 border-cicopal-blue bg-blue-50 p-3 text-sm font-bold text-cicopal-blue">
            Produto, usuário, data e hora serão vinculados automaticamente.
          </div>
        </div>
        <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 p-4">
          <button
            type="button"
            className="min-h-14 border border-gray-300 bg-white font-black text-gray-700"
            onClick={() => onAnswer(false)}
          >
            Voltar
          </button>
          <button
            type="button"
            className="min-h-14 bg-cicopal-blue font-black text-white"
            onClick={() => onAnswer(true)}
          >
            {confirmation.confirmLabel ?? "Confirmar"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function makeNcId(base = "NC") {
  const normalized =
    typeof base.normalize === "function" ? base.normalize("NFD") : base;
  return normalized
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function HourlyTable({
  title,
  columns,
  minWidth = "min-w-[980px]",
  registro,
  onSave,
  activeHour = "",
}) {
  const [values, setValues] = useState({});
  const [savedAt, setSavedAt] = useState("");

  function valueKey(hour, column) {
    return `${hour}|${column}`;
  }

  function updateValue(hour, column, value) {
    setValues((current) => ({
      ...current,
      [valueKey(hour, column)]: value,
    }));
  }

  function saveHourlyTable() {
    const apontamentos = Object.entries(values).map(([key, resultado]) => {
      const [horario, item] = key.split("|");
      return { horario, item, resultado };
    });
    const ncs = apontamentos
      .filter((apontamento) => ["N", "NC"].includes(apontamento.resultado))
      .map((apontamento, index) => ({
        id: `${makeNcId(title)}-NC-${String(index + 1).padStart(2, "0")}`,
        item: apontamento.item,
        status: "Aberta",
        horario: apontamento.horario,
        quantidade: "-",
        descricao: `${apontamento.item} marcado como N em ${apontamento.horario}`,
        causa: "Nao informada",
        acao: "Nao informada",
        disposicaoImediata: "Nao informada",
        disposicaoFinal: "Nao informada",
        operador: registro?.operador ?? "",
        produto: registro?.produto ?? "-",
        assinaturaSupervisorAt: null,
      }));

    onSave?.({ apontamentos, ncs });
    setSavedAt(
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
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
      {activeHour ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((column) => (
            <div
              key={column}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <p className="mb-2 min-h-10 text-sm font-black text-gray-800">
                {column}
              </p>
              <StatusClickButton
                value={values[valueKey(activeHour, column)]}
                onChange={(value) => updateValue(activeHour, column, value)}
              />
            </div>
          ))}
        </div>
      ) : (
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
                  <td className="px-3 py-3 text-base font-bold text-gray-950">
                    {hour}
                  </td>
                  {columns.map((column) => (
                    <td key={`${hour}-${column}`} className="px-3 py-3">
                      <StatusClickButton
                        value={values[valueKey(hour, column)]}
                        onChange={(value) => updateValue(hour, column, value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-3">
        <span className="text-sm font-bold text-gray-500">
          {savedAt
            ? `Bloco gravado as ${savedAt}`
            : "Dois toques em um item geram NC ao gravar."}
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

function LiberacaoProdutoTable({
  columns = liberacaoProdutoColumns,
  registro,
  onSave,
}) {
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
    const apontamentos = rows.reduce((acc, row) => {
      const rowApontamentos = columns
        .filter((column) => values[valueKey(row.id, column)])
        .map((column) => ({
          horario: row.horario || "-",
          item: column,
          resultado: values[valueKey(row.id, column)],
        }));

      return acc.concat(rowApontamentos);
    }, []);
    const ncs = apontamentos
      .filter((apontamento) => ["N", "NC"].includes(apontamento.resultado))
      .map((apontamento, index) => ({
        id: `LIBP-NC-${String(index + 1).padStart(2, "0")}`,
        item: apontamento.item,
        status: "Aberta",
        horario: apontamento.horario,
        quantidade: "-",
        descricao: `${apontamento.item} marcado como N na liberação`,
        causa: "Nao informada",
        acao: "Nao informada",
        disposicaoImediata: "Nao informada",
        disposicaoFinal: "Nao informada",
        operador: registro?.operador ?? "",
        produto: registro?.produto ?? "-",
        assinaturaSupervisorAt: null,
      }));

    onSave?.({ apontamentos, ncs });
    setSavedAt(
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 p-3">
        <Check size={24} className="text-cicopal-blue" />
        <div>
          <h2 className="text-xl font-bold text-gray-950">
            Liberacao do Produto
          </h2>
          <p className="text-sm font-semibold text-gray-600">
            Registre cada horario em que o produto for liberado
          </p>
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
                        current.map((entry) =>
                          entry.id === row.id
                            ? { ...entry, horario: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </td>
                {columns.map((column) => (
                  <td key={column} className="px-3 py-3">
                    <StatusClickButton
                      value={values[valueKey(row.id, column)]}
                      onChange={(value) => updateValue(row.id, column, value)}
                    />
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
            onClick={() =>
              setRows((current) => [...current, { id: current.length + 1 }])
            }
          >
            <Plus size={18} />
            Adicionar horario
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-gray-500">
              {savedAt
                ? `Liberacao gravada as ${savedAt}`
                : "Dois toques em item C/NC geram NC ao gravar."}
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
          <h2 className="text-xl font-bold text-gray-950">
            Avaliacao do Produto
          </h2>
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
                <td className="px-3 py-3 text-base font-bold text-gray-950">
                  {hour}
                </td>
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

function TabletHourNavigator({
  activeHour,
  onChange,
  allowedHours = hours,
  completedHours = [],
}) {
  const entries = allowedHours.map((item) =>
    typeof item === "string" ? { key: item, value: item, label: item } : item,
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const activeIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.value === activeHour),
  );
  const activeEntry = entries[activeIndex];
  const currentSlotTime = new Date(now);
  currentSlotTime.setMinutes(0, 0, 0);
  const currentTimestamp = currentSlotTime.getTime();
  const missing = entries.filter(
    (entry) => !entry.locked && !completedHours.includes(entry.value),
  ).length;
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  const minutesToNext = Math.max(
    0,
    Math.ceil((nextHour.getTime() - now.getTime()) / 60_000),
  );
  return (
    <section className="sticky top-[72px] z-10 mb-4 rounded-lg border border-cicopal-blue bg-white p-3 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">
            Horário selecionado
          </p>
          <p className="text-2xl font-bold tabular-nums text-cicopal-blue">
            {activeEntry?.hour ?? activeHour}
          </p>
          <p className="text-xs font-semibold text-gray-500">
            {activeEntry?.label}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={activeIndex === 0}
            className="min-h-11 rounded-md border border-gray-300 px-3 font-bold disabled:opacity-30"
            onClick={() => onChange(entries[activeIndex - 1].value)}
          >
            ← Anterior
          </button>
          <button
            type="button"
            disabled={
              activeIndex >= entries.length - 1 ||
              entries[activeIndex + 1]?.locked
            }
            className="min-h-11 rounded-md border border-gray-300 px-3 font-bold disabled:opacity-30"
            onClick={() => onChange(entries[activeIndex + 1].value)}
          >
            Próximo →
          </button>
        </div>
      </div>
      <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-2">
        {entries.map((entry, index) => {
          const completed = completedHours.includes(entry.value);
          const isSelected = entry.value === activeHour;
          const isCurrent = entry.timestamp === currentTimestamp;
          const isNext = entry.timestamp === currentTimestamp + 3_600_000;
          const isPast = entry.timestamp < currentTimestamp;
          const relation = isCurrent
            ? "Em preenchimento"
            : isNext
              ? "Próximo controle"
              : isPast
                ? "Anterior"
                : "Programado";
          return (
            <button
              key={entry.key}
              type="button"
              disabled={entry.locked}
              className={`relative min-h-20 min-w-36 border px-3 py-2 text-left text-sm font-bold transition ${isSelected || isCurrent ? "scale-[1.02] border-cicopal-blue bg-cicopal-blue text-white shadow-lg" : isNext ? "border-2 border-dashed border-amber-400 bg-amber-50 text-amber-900" : completed ? "border-green-100 bg-green-50/60 text-cicopal-green opacity-60" : isPast ? "border-gray-200 bg-gray-50 text-gray-500 opacity-55" : "border-gray-200 bg-gray-100 text-gray-400"}`}
              onClick={() => onChange(entry.value)}
            >
              <span className="block text-[10px] uppercase opacity-70">
                {relation}
              </span>
              <span className="mt-1 block text-lg tabular-nums">
                {entry.hour ?? entry.label}
              </span>
              {entry.dateLabel ? (
                <span className="block text-[11px] opacity-75">
                  {entry.dateLabel}
                </span>
              ) : null}
              <span className="mt-1 block text-[10px] uppercase">
                {completed
                  ? "Preenchido"
                  : entry.locked
                    ? "Ainda não liberado"
                    : "Pendente"}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className={`mt-2 flex flex-wrap justify-between gap-2 border-t pt-3 text-sm font-bold ${missing ? "text-amber-800" : "text-cicopal-green"}`}
      >
        <span>
          {missing
            ? `${missing} horário(s) pendente(s)`
            : "Todos os horários preenchidos"}
        </span>
        <span>Próximo controle em {minutesToNext} min</span>
      </div>
    </section>
  );
}

function TabletProductMetrics({ columns, activeHour, onSave }) {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({});
  const column = columns[index];
  const currentValue = values[column.label] ?? "";
  const classification = classifyProductValue(column.specification, currentValue);
  const tone = specificationTone[classification];
  function finish() {
    onSave?.({
      apontamentos: columns.map((item) => ({
        horario: activeHour,
        item: item.label,
        resultado: values[item.label],
        unidade: item.unit,
        classificacao: classifyProductValue(item.specification, values[item.label]),
      })),
      ncs: [],
    });
  }
  const isNa = currentValue === "NA";
  return (
    <section className="inspection-focus">
      <aside className="inspection-progress">
        <p>{activeHour}</p>
        <strong>{index + 1}</strong>
        <span>de {columns.length}</span>
        <div>
          <i style={{ height: `${((index + 1) / columns.length) * 100}%` }} />
        </div>
      </aside>
      <div className="inspection-question">
        <p className="inspection-eyebrow">Parâmetro do produto</p>
        <h2>{column.label}</h2>
        <div className={`inspection-number border-2 ${isNa ? "is-na" : ""} ${tone.className}`}>
          <input
            key={column.label}
            type="number"
            inputMode="decimal"
            step="0.01"
            disabled={isNa}
            autoFocus
            value={isNa ? "" : currentValue}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                [column.label]: event.target.value,
              }))
            }
            placeholder="0,00"
          />
          <span>{column.unit}</span>
        </div>
        {currentValue ? (
          <div className={`mt-3 border-l-4 p-3 text-center font-black ${tone.className}`}>
            {tone.label}
          </div>
        ) : null}
        <button
          type="button"
          className={`inspection-na ${isNa ? "is-selected" : ""}`}
          onClick={() =>
            setValues((current) => ({
              ...current,
              [column.label]: isNa ? "" : "NA",
            }))
          }
        >
          NA · Não se aplica
        </button>
        <footer>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            Voltar
          </button>
          {index === columns.length - 1 ? (
            <button
              type="button"
              disabled={!currentValue}
              className="primary"
              onClick={finish}
            >
              Confirmar parâmetros
            </button>
          ) : (
            <button
              type="button"
              disabled={!currentValue}
              className="primary"
              onClick={() => setIndex((value) => value + 1)}
            >
              Próximo item
            </button>
          )}
        </footer>
      </div>
    </section>
  );
}

function TabletRelease({ columns, activeHour, registro, onSave, onNextStep }) {
  const [values, setValues] = useState({});
  const [savedAt, setSavedAt] = useState("");
  const [index, setIndex] = useState(0);
  async function save() {
    const apontamentos = columns
      .filter((item) => values[item])
      .map((item) => ({ horario: activeHour, item, resultado: values[item] }));
    const ncs = apontamentos
      .filter((item) => ["N", "NC"].includes(item.resultado))
      .map((item, index) => ({
        id: `LIBP-NC-${index + 1}`,
        item: item.item,
        horario: activeHour,
        status: "Aberta",
        descricao: `${item.item} marcado como N na liberação`,
        operador: registro?.operador ?? "",
        produto: registro?.produto ?? "-",
      }));
    const confirmed = await onSave?.({ apontamentos, ncs });
    if (confirmed === false) return;
    setSavedAt(
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }
  const column = columns[index];
  function choose(value) {
    setValues((current) => ({ ...current, [column]: value }));
  }
  if (savedAt) {
    return (
      <section className="mx-auto max-w-5xl border border-green-200 bg-white p-6 text-center shadow-sm">
        <CheckCircle2 size={46} className="mx-auto text-cicopal-green" />
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-cicopal-green">
          Registro confirmado
        </p>
        <h2 className="mt-1 text-2xl font-bold text-gray-950">
          Liberação do produto gravada
        </h2>
        <p className="mt-2 font-semibold text-gray-500">
          Confirmada às {savedAt}. A etapa seguinte está disponível no fluxo.
          Para alterar este registro, use “Editar registro”.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex min-h-16 items-center justify-center gap-2 bg-cicopal-blue px-6 text-lg font-bold text-white"
          onClick={onNextStep}
        >
          Voltar ao fluxo para iniciar produção
          <ArrowRight size={22} />
        </button>
      </section>
    );
  }
  return (
    <section className="inspection-focus">
      <aside className="inspection-progress">
        <p>{activeHour}</p>
        <strong>{index + 1}</strong>
        <span>de {columns.length}</span>
        <div>
          <i style={{ height: `${((index + 1) / columns.length) * 100}%` }} />
        </div>
      </aside>
      <div className="inspection-question">
        <p className="inspection-eyebrow">Liberação do produto</p>
        <h2>{column}</h2>
        <p className="mb-4 font-semibold text-gray-500">
          Escolha a condição encontrada.
        </p>
        <StatusClickButton
          value={values[column]}
          onChange={(value) => choose(value)}
          onConfirm={() => {
            if (index < columns.length - 1) setIndex((current) => current + 1);
            else save();
          }}
        />
        <footer>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            Voltar
          </button>
          {index === columns.length - 1 ? (
            <button
              type="button"
              disabled={!values[column]}
              className="primary"
              onClick={save}
            >
              Confirmar registro
            </button>
          ) : (
            <button
              type="button"
              disabled={!values[column]}
              className="primary"
              onClick={() => setIndex((value) => value + 1)}
            >
              Próximo item
            </button>
          )}
        </footer>
        {savedAt ? (
          <p className="mt-3 text-center font-black text-cicopal-green">
            Gravado às {savedAt}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MachineEvaluationWizard({ title, machines, activeHour, onSave }) {
  const items = machines.flatMap((machine) =>
    machine.columns.map((column) => ({ machine: machine.label, column })),
  );
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({});
  const item = items[index];
  if (!item) return null;
  const key = `${item.machine}|${item.column}`;
  function finish() {
    const apontamentos = Object.entries(values).map(([itemKey, resultado]) => {
      const [maquina, parametro] = itemKey.split("|");
      return { horario: activeHour, maquina, item: parametro, resultado };
    });
    const ncs = apontamentos
      .filter((entry) => ["N", "NC"].includes(entry.resultado))
      .map((entry, ncIndex) => ({
        id: `MAQ-NC-${ncIndex + 1}`,
        item: `${entry.maquina} - ${entry.item}`,
        horario: activeHour,
        status: "Aberta",
        descricao: `${entry.item} marcado como N em ${entry.maquina}`,
      }));
    onSave?.({ apontamentos, ncs });
  }
  return (
    <section className="inspection-focus">
      <aside className="inspection-progress">
        <p className="text-center">{activeHour}</p>
        <strong>{index + 1}</strong>
        <span>de {items.length}</span>
        <div>
          <i style={{ height: `${((index + 1) / items.length) * 100}%` }} />
        </div>
      </aside>
      <div className="inspection-question">
        <div className="mb-5 border-l-8 border-cicopal-blue bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-cicopal-blue">
            Máquina em preenchimento
          </p>
          <strong className="mt-1 block text-3xl font-black text-gray-950 md:text-4xl">
            {item.machine}
          </strong>
          <span className="mt-1 block font-bold text-gray-600">{title}</span>
        </div>
        <p className="inspection-eyebrow">Parâmetro atual</p>
        <h2>{item.column}</h2>
        <StatusClickButton
          value={values[key]}
          onChange={(value) =>
            setValues((current) => ({ ...current, [key]: value }))
          }
          onConfirm={() => {
            if (index < items.length - 1) setIndex((current) => current + 1);
            else finish();
          }}
        />
        <footer>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((value) => value - 1)}
          >
            Voltar
          </button>
          {index === items.length - 1 ? (
            <button
              type="button"
              disabled={!values[key]}
              className="primary"
              onClick={finish}
            >
              Confirmar máquina
            </button>
          ) : (
            <button
              type="button"
              disabled={!values[key]}
              className="primary"
              onClick={() => setIndex((value) => value + 1)}
            >
              Próximo item
            </button>
          )}
        </footer>
        <p className="mt-3 text-center text-sm font-bold text-gray-500">
          Toque duas vezes na mesma resposta para confirmar e avançar.
        </p>
      </div>
    </section>
  );
}

function MachineHourlySections({
  title,
  machines = [],
  registro,
  onSave,
  requireMachineSetup = false,
  gramaturas = [],
  activeHour = "",
}) {
  const [activeCount, setActiveCount] = useState(
    requireMachineSetup ? "" : String(machines.length),
  );
  const [machineGrams, setMachineGrams] = useState({});
  const [setupComplete, setSetupComplete] = useState(!requireMachineSetup);
  const [selectedMachine, setSelectedMachine] = useState("");
  const setupStorageKey = `rg003-machine-setup-${registro?.id ?? title}`;
  useEffect(() => {
    if (!requireMachineSetup) return;
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(setupStorageKey) ?? "null",
      );
      if (saved?.quantidade) {
        setActiveCount(String(saved.quantidade));
        setMachineGrams(saved.gramaturas ?? {});
        setSetupComplete(true);
      }
    } catch {
      /* solicita configuração novamente */
    }
  }, [requireMachineSetup, setupStorageKey]);
  useEffect(() => {
    if (!requireMachineSetup || !setupComplete || !activeCount) return;
    window.localStorage.setItem(
      setupStorageKey,
      JSON.stringify({
        quantidade: Number(activeCount),
        gramaturas: machineGrams,
      }),
    );
  }, [
    activeCount,
    machineGrams,
    requireMachineSetup,
    setupComplete,
    setupStorageKey,
  ]);
  if (!machines.length) return null;
  const activeMachines = machines.slice(0, Number(activeCount || 0));
  const allGramsDefined =
    activeMachines.length > 0 &&
    activeMachines.every((machine) => machineGrams[machine.label]);
  const currentMachine = activeMachines.find(
    (machine) => machine.label === selectedMachine,
  );

  function changeCount(value) {
    setActiveCount(value);
    setMachineGrams((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([label]) =>
          machines
            .slice(0, Number(value || 0))
            .some((machine) => machine.label === label),
        ),
      ),
    );
    setSetupComplete(false);
    setSelectedMachine("");
  }

  function saveMachine(payload) {
    return onSave?.({
      ...payload,
      apontamentos: (payload.apontamentos ?? []).map((item) => ({
        ...item,
        gramatura: machineGrams[item.maquina] ?? "",
      })),
      configuracaoMaquinas: {
        quantidade: Number(activeCount),
        gramaturas: machineGrams,
      },
    });
  }

  return (
    <div className="space-y-4">
      {requireMachineSetup && !setupComplete ? (
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase text-cicopal-blue">
              Configuração da produção
            </p>
            <h3 className="mt-1 text-xl font-bold text-gray-950">
              Máquinas em operação
            </h3>
            <p className="mt-1 text-sm font-semibold text-gray-600">
              Esta etapa deve ser concluída antes de abrir os horários de cada
              máquina.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[250px_1fr]">
            <label>
              <span className="mb-2 block text-sm font-black text-gray-900">
                Quantas máquinas estão rodando?
              </span>
              <select
                className="min-h-14 w-full rounded-xl border border-blue-200 bg-white px-3 text-lg font-bold"
                value={activeCount}
                onChange={(event) => changeCount(event.target.value)}
              >
                <option value="">Selecione</option>
                {machines.map((_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1} máquina(s)
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="mb-2 block text-sm font-black text-gray-900">
                Gramatura de cada máquina
              </span>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {activeMachines.map((machine) => (
                  <label
                    key={machine.label}
                    className="rounded-xl border border-blue-100 bg-white p-2"
                  >
                    <span className="mb-1 block text-xs font-bold text-gray-600">
                      {machine.label}
                    </span>
                    <select
                      className="min-h-10 w-full rounded-lg border border-gray-200 px-2 font-bold"
                      value={machineGrams[machine.label] ?? ""}
                      onChange={(event) =>
                        setMachineGrams((current) => ({
                          ...current,
                          [machine.label]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecione</option>
                      {gramaturas.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {!activeCount ? (
            <p className="mt-3 text-sm font-bold text-cicopal-blue">
              Informe as máquinas ativas para abrir o preenchimento.
            </p>
          ) : null}
          <button
            type="button"
            disabled={!allGramsDefined}
            className="mt-4 min-h-14 w-full rounded-md bg-cicopal-blue px-5 text-lg font-bold text-white disabled:bg-gray-300"
            onClick={() => setSetupComplete(true)}
          >
            Confirmar máquinas e gramaturas
          </button>
        </section>
      ) : null}
      {requireMachineSetup && setupComplete && !currentMachine ? (
        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">
                {title}
              </p>
              <h3 className="mt-1 text-xl font-bold text-gray-950">
                Escolha a máquina
              </h3>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-md border border-gray-300 bg-white px-4 font-bold text-gray-700"
              onClick={() => setSetupComplete(false)}
            >
              Alterar configuração
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activeMachines.map((machine, index) => (
              <button
                key={machine.label}
                type="button"
                className="min-h-24 rounded-md border-2 border-gray-200 bg-gray-50 p-3 text-left hover:border-cicopal-blue hover:bg-blue-50"
                onClick={() => setSelectedMachine(machine.label)}
              >
                <span className="block text-lg font-bold text-gray-950">
                  Máquina {index + 1}
                </span>
                <span className="mt-1 block text-sm font-semibold text-cicopal-blue">
                  {machineGrams[machine.label]}
                </span>
                <span className="mt-2 block text-xs font-bold text-gray-500">
                  Abrir horários →
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {activeHour && requireMachineSetup && currentMachine ? (
        <>
          <button
            type="button"
            className="min-h-12 rounded-md border border-gray-300 bg-white px-4 font-bold text-gray-700"
            onClick={() => setSelectedMachine("")}
          >
            <ArrowLeft size={18} className="mr-2 inline" />
            Voltar às máquinas
          </button>
          <MachineEvaluationWizard
            title={`${title} · ${currentMachine.label} · ${machineGrams[currentMachine.label]}`}
            machines={[currentMachine]}
            activeHour={activeHour}
            onSave={saveMachine}
          />
        </>
      ) : !requireMachineSetup ? (
        activeMachines.map((machine) => (
          <HourlyTable
            key={machine.label}
            title={`${title} - ${machine.label}`}
            columns={machine.columns}
            minWidth="min-w-[860px]"
            registro={registro}
            onSave={onSave}
            activeHour={activeHour}
          />
        ))
      ) : null}
    </div>
  );
}

function ProductEvaluationTabletFlow({
  columns,
  machines,
  gramaturas,
  registro,
  activeHour,
  onSave,
}) {
  const storageKey = `rg003-product-machines-${registro?.id ?? "current"}`;
  const [activeCount, setActiveCount] = useState("");
  const [machineGrams, setMachineGrams] = useState({});
  const [configured, setConfigured] = useState(false);
  const [view, setView] = useState("menu");
  const [generalResult, setGeneralResult] = useState(null);
  const [machineResults, setMachineResults] = useState({});
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "null",
      );
      if (saved?.quantidade) {
        setActiveCount(String(saved.quantidade));
        setMachineGrams(saved.gramaturas ?? {});
        setConfigured(true);
      }
    } catch {
      /* inicia uma configuração limpa */
    }
  }, [storageKey]);
  const activeMachines = machines.slice(0, Number(activeCount || 0));
  const allGramsDefined =
    activeMachines.length > 0 &&
    activeMachines.every((machine) => machineGrams[machine.label]);
  const selectedMachine = activeMachines.find(
    (machine) => machine.label === view,
  );
  const allMachinesDone =
    activeMachines.length > 0 &&
    activeMachines.every((machine) => machineResults[machine.label]);
  const nextPendingMachine = activeMachines.find(
    (machine) => !machineResults[machine.label],
  );

  function confirmSetup() {
    if (!allGramsDefined) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        quantidade: Number(activeCount),
        gramaturas: machineGrams,
      }),
    );
    setConfigured(true);
    setView("general");
  }

  function finishHour() {
    const machinePayloads = Object.values(machineResults);
    return onSave?.({
      apontamentos: [
        ...(generalResult?.apontamentos ?? []),
        ...machinePayloads.flatMap((item) => item.apontamentos ?? []),
      ],
      ncs: [
        ...(generalResult?.ncs ?? []),
        ...machinePayloads.flatMap((item) => item.ncs ?? []),
      ],
      configuracaoMaquinas: {
        quantidade: Number(activeCount),
        gramaturas: machineGrams,
      },
    });
  }

  if (!configured)
    return (
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-bold uppercase text-cicopal-blue">
          Etapa 1 de 2
        </p>
        <h3 className="mt-1 text-2xl font-bold text-gray-950">
          Configurar máquinas
        </h3>
        <p className="mt-1 text-sm font-semibold text-gray-600">
          Informe primeiro quantas máquinas estão produzindo e a gramatura de
          cada uma.
        </p>
        <label className="mt-4 block">
          <span className="mb-2 block font-bold text-gray-800">
            Quantidade de máquinas
          </span>
          <select
            className="min-h-16 w-full rounded-md border-2 border-blue-200 bg-white px-4 text-xl font-bold"
            value={activeCount}
            onChange={(event) => {
              setActiveCount(event.target.value);
              setMachineGrams({});
            }}
          >
            <option value="">Selecionar</option>
            {machines.map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1} máquina(s)
              </option>
            ))}
          </select>
        </label>
        {activeMachines.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activeMachines.map((machine, index) => (
              <label
                key={machine.label}
                className="rounded-md border border-gray-200 bg-white p-3"
              >
                <span className="mb-2 block font-bold text-gray-800">
                  Máquina {index + 1}
                </span>
                <select
                  className="min-h-14 w-full rounded-md border border-gray-300 bg-white px-3 font-bold"
                  value={machineGrams[machine.label] ?? ""}
                  onChange={(event) =>
                    setMachineGrams((current) => ({
                      ...current,
                      [machine.label]: event.target.value,
                    }))
                  }
                >
                  <option value="">Gramatura</option>
                  {gramaturas.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          disabled={!allGramsDefined}
          className="mt-4 min-h-16 w-full rounded-md bg-cicopal-blue text-lg font-bold text-white disabled:bg-gray-300"
          onClick={confirmSetup}
        >
          Confirmar configuração
        </button>
      </section>
    );

  if (view === "general")
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="min-h-12 rounded-md border border-gray-300 bg-white px-4 font-bold"
          onClick={() => setView("menu")}
        >
          <ArrowLeft size={18} className="mr-2 inline" />
          Voltar ao menu
        </button>
        <TabletProductMetrics
          columns={columns}
          activeHour={activeHour}
          onSave={(payload) => {
            setGeneralResult(payload);
            setView(activeMachines[0]?.label ?? "menu");
          }}
        />
      </div>
    );
  if (selectedMachine)
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="min-h-12 rounded-md border border-gray-300 bg-white px-4 font-bold"
          onClick={() => setView("menu")}
        >
          <ArrowLeft size={18} className="mr-2 inline" />
          Voltar às máquinas
        </button>
        <MachineEvaluationWizard
          key={`${activeHour}-${selectedMachine.label}`}
          title={`Avaliação do produto · ${selectedMachine.label} · ${machineGrams[selectedMachine.label]}`}
          machines={[selectedMachine]}
          activeHour={activeHour}
          onSave={(payload) => {
            const currentIndex = activeMachines.findIndex(
              (machine) => machine.label === selectedMachine.label,
            );
            const nextMachine = activeMachines[currentIndex + 1];
            setMachineResults((current) => ({
              ...current,
              [selectedMachine.label]: {
                ...payload,
                apontamentos: (payload.apontamentos ?? []).map((item) => ({
                  ...item,
                  gramatura: machineGrams[selectedMachine.label],
                })),
              },
            }));
            setView(nextMachine?.label ?? "menu");
          }}
        />
      </div>
    );

  return (
    <section className="rounded-lg border border-gray-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-cicopal-blue">
            Avaliação do produto · {activeHour}
          </p>
          <h3 className="mt-1 text-2xl font-bold text-gray-950">
            Selecione o grupo
          </h3>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-md border border-gray-300 bg-white px-4 font-bold"
          onClick={() => setConfigured(false)}
        >
          Alterar máquinas
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          className={`min-h-24 rounded-md border-2 p-3 text-left ${generalResult ? "border-green-200 bg-green-50" : "border-cicopal-blue bg-blue-50 ring-4 ring-blue-100"}`}
          onClick={() => setView("general")}
        >
          <span className="block text-lg font-bold">Parâmetros gerais</span>
          <span className="mt-1 block text-sm font-semibold">
            {generalResult ? "✓ Preenchido" : "Umidade, pH e temperatura"}
          </span>
        </button>
        {activeMachines.map((machine, index) => (
          <button
            key={machine.label}
            type="button"
            className={`min-h-24 rounded-md border-2 p-3 text-left ${machineResults[machine.label] ? "border-green-200 bg-green-50 opacity-70" : nextPendingMachine?.label === machine.label ? "border-cicopal-blue bg-blue-50 ring-4 ring-blue-100" : "border-gray-200 bg-gray-50"}`}
            onClick={() => setView(machine.label)}
          >
            <span className="block text-lg font-bold">Máquina {index + 1}</span>
            <span className="mt-1 block text-sm font-semibold">
              {machineGrams[machine.label]} ·{" "}
              {machineResults[machine.label] ? "✓ Preenchida" : "Pendente"}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!generalResult || !allMachinesDone}
        className="mt-4 min-h-16 w-full rounded-md bg-cicopal-green text-lg font-bold text-white disabled:bg-gray-300"
        onClick={finishHour}
      >
        Confirmar avaliação completa de {activeHour}
      </button>
    </section>
  );
}

function ProcessEvaluationTabletFlow({
  machines,
  gramaturas,
  registro,
  activeHour,
  onSave,
}) {
  const storageKey = `rg003-process-machines-${registro?.cicloId ?? registro?.id ?? "current"}`;
  const [activeCount, setActiveCount] = useState("");
  const [machineGrams, setMachineGrams] = useState({});
  const [configured, setConfigured] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [machineResults, setMachineResults] = useState({});
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "null",
      );
      if (saved?.quantidade) {
        setActiveCount(String(saved.quantidade));
        setMachineGrams(saved.gramaturas ?? {});
        setConfigured(true);
      }
    } catch {
      /* configuração será solicitada novamente */
    }
  }, [storageKey]);
  const activeMachines = machines.slice(0, Number(activeCount || 0));
  const currentMachine = activeMachines.find(
    (machine) => machine.label === selectedMachine,
  );
  const allGramsDefined =
    activeMachines.length > 0 &&
    activeMachines.every((machine) => machineGrams[machine.label]);
  const completedCount = activeMachines.filter(
    (machine) => machineResults[machine.label],
  ).length;
  const allMachinesDone =
    activeMachines.length > 0 && completedCount === activeMachines.length;
  const nextPendingMachine = activeMachines.find(
    (machine) => !machineResults[machine.label],
  );

  function confirmSetup() {
    if (!allGramsDefined) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        quantidade: Number(activeCount),
        gramaturas: machineGrams,
      }),
    );
    setConfigured(true);
    setSelectedMachine(activeMachines[0]?.label ?? "");
  }
  async function finishHour() {
    const payloads = activeMachines
      .map((machine) => machineResults[machine.label])
      .filter(Boolean);
    return onSave?.({
      apontamentos: payloads.flatMap((payload) => payload.apontamentos ?? []),
      ncs: payloads.flatMap((payload) => payload.ncs ?? []),
      configuracaoMaquinas: {
        quantidade: Number(activeCount),
        gramaturas: machineGrams,
      },
    });
  }
  if (!configured)
    return (
      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <header className="bg-blue-50 p-5">
          <p className="text-xs font-black uppercase tracking-wider text-cicopal-blue">
            Configuração inicial
          </p>
          <h3 className="mt-1 text-2xl font-black text-gray-950">
            Máquinas deste processo
          </h3>
          <p className="mt-1 text-sm font-semibold text-gray-600">
            Defina as máquinas uma única vez. A configuração será mantida nos
            próximos horários.
          </p>
        </header>
        <div className="p-5">
          <label className="block">
            <span className="mb-2 block font-black text-gray-800">
              Quantidade de máquinas em operação
            </span>
            <select
              className="min-h-16 w-full rounded-xl border-2 border-blue-200 bg-white px-4 text-xl font-black"
              value={activeCount}
              onChange={(event) => {
                setActiveCount(event.target.value);
                setMachineGrams({});
              }}
            >
              <option value="">Selecionar quantidade</option>
              {machines.map((_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1} máquina(s)
                </option>
              ))}
            </select>
          </label>
          {activeMachines.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {activeMachines.map((machine, index) => (
                <label
                  key={machine.label}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <span className="mb-2 block font-black text-gray-900">
                    Máquina {index + 1}
                  </span>
                  <select
                    className="min-h-14 w-full rounded-lg border border-gray-300 bg-white px-3 font-bold"
                    value={machineGrams[machine.label] ?? ""}
                    onChange={(event) =>
                      setMachineGrams((current) => ({
                        ...current,
                        [machine.label]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecionar gramatura</option>
                    {gramaturas.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            disabled={!allGramsDefined}
            className="mt-5 min-h-16 w-full rounded-xl bg-cicopal-blue text-lg font-black text-white disabled:bg-gray-300"
            onClick={confirmSetup}
          >
            Abrir avaliação das máquinas
          </button>
        </div>
      </section>
    );
  if (currentMachine)
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="inline-flex min-h-12 items-center rounded-xl border border-gray-300 bg-white px-4 font-bold text-gray-700"
          onClick={() => setSelectedMachine("")}
        >
          <ArrowLeft size={18} className="mr-2" />
          Voltar às máquinas
        </button>
        <MachineEvaluationWizard
          key={`${activeHour}-${currentMachine.label}`}
          title={`Avaliação do processo · Máquina ${activeMachines.indexOf(currentMachine) + 1} · ${machineGrams[currentMachine.label]}`}
          machines={[currentMachine]}
          activeHour={activeHour}
          onSave={(payload) => {
            const currentIndex = activeMachines.findIndex(
              (machine) => machine.label === currentMachine.label,
            );
            const nextMachine = activeMachines[currentIndex + 1];
            setMachineResults((current) => ({
              ...current,
              [currentMachine.label]: {
                ...payload,
                apontamentos: (payload.apontamentos ?? []).map((item) => ({
                  ...item,
                  gramatura: machineGrams[currentMachine.label],
                })),
              },
            }));
            setSelectedMachine(nextMachine?.label ?? "");
          }}
        />
      </div>
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-cicopal-blue">
            Avaliação do processo · {activeHour}
          </p>
          <h3 className="mt-1 text-2xl font-black text-gray-950">
            Máquinas em operação
          </h3>
          <p className="mt-1 font-semibold text-gray-600">
            {completedCount} de {activeMachines.length} máquinas avaliadas
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 font-bold"
          onClick={() => setConfigured(false)}
        >
          Alterar configuração
        </button>
      </header>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {activeMachines.map((machine, index) => {
          const done = Boolean(machineResults[machine.label]);
          return (
            <button
              key={machine.label}
              type="button"
              className={`min-h-28 rounded-xl border-2 p-4 text-left transition ${done ? "border-green-300 bg-green-50 opacity-70" : nextPendingMachine?.label === machine.label ? "border-cicopal-blue bg-blue-50 ring-4 ring-blue-100" : "border-gray-200 bg-gray-50"}`}
              onClick={() => setSelectedMachine(machine.label)}
            >
              <span className="flex items-center justify-between">
                <strong className="text-xl text-gray-950">
                  Máquina {index + 1}
                </strong>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${done ? "bg-green-100 text-cicopal-green" : "bg-amber-100 text-amber-800"}`}
                >
                  {done ? "Concluída" : "Pendente"}
                </span>
              </span>
              <span className="mt-2 block font-bold text-cicopal-blue">
                {machineGrams[machine.label]}
              </span>
            </button>
          );
        })}
      </div>
      <footer className="border-t border-gray-200 p-5">
        <button
          type="button"
          disabled={!allMachinesDone}
          className="min-h-16 w-full rounded-xl bg-cicopal-green text-lg font-black text-white disabled:bg-gray-300"
          onClick={finishHour}
        >
          Confirmar avaliação completa de {activeHour}
        </button>
        <p className="mt-2 text-center text-xs font-semibold text-gray-500">
          O horário será gravado uma única vez com todas as máquinas.
        </p>
      </footer>
    </section>
  );
}

function NumericUnitInput({ unit }) {
  return (
    <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
      <input
        type="number"
        step="0.01"
        className="min-h-12 w-full min-w-24 px-3 font-semibold outline-none"
      />
      <span className="flex min-h-12 items-center bg-gray-100 px-3 text-xs font-bold text-gray-600">
        {unit}
      </span>
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
            <span className="mb-1 block text-[11px] font-bold uppercase text-gray-500">
              {field.label}
            </span>
            <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
              <input
                type="number"
                step="0.01"
                className="min-h-12 w-full px-3 font-semibold outline-none"
                value={groupValue[field.label] ?? ""}
                onChange={(event) =>
                  onChange({ ...groupValue, [field.label]: event.target.value })
                }
              />
              <span className="flex min-h-12 items-center bg-gray-100 px-3 text-xs font-bold text-gray-600">
                {field.unit}
              </span>
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
      <span className="flex min-h-12 items-center bg-gray-100 px-3 text-xs font-bold text-gray-600">
        {row.unit}
      </span>
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
        Marca, formato e sabor sao preenchidos por horario, pois podem mudar ao
        longo da producao.
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
        [key]: value,
      },
    }));
  }

  function saveCurrentHour(nextHour = activeHour) {
    setSavedHours((current) =>
      current.includes(activeHour) ? current : [...current, activeHour],
    );
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
            <p className="text-xs font-bold uppercase text-gray-500">
              Horario ativo
            </p>
            <h2 className="text-3xl font-black text-cicopal-blue">
              {activeHour}
            </h2>
          </div>
          <label className="min-w-[240px] flex-1 md:max-w-sm">
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
              Operador deste horario
            </span>
            <input
              className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
              value={
                hourValues[activeHour]?.operador ?? registro?.operador ?? ""
              }
              onChange={(event) =>
                setHourValues((current) => ({
                  ...current,
                  [activeHour]: {
                    ...(current[activeHour] ?? {}),
                    operador: event.target.value,
                  },
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
        <section
          key={group.title}
          className="overflow-hidden rounded-md border border-gray-200 bg-white"
        >
          <div className="flex items-center gap-3 border-b border-gray-200 p-3">
            <Clock size={24} className="text-cicopal-blue" />
            <div>
              <h2 className="text-xl font-bold text-gray-950">{group.title}</h2>
              <p className="text-sm font-semibold text-gray-600">
                Parametros por horario
              </p>
            </div>
          </div>
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {group.rows.map((row) => {
              const key = valueKey(group.title, row.label);
              return (
                <div
                  key={key}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3"
                >
                  <span className="mb-2 block text-sm font-black text-gray-950">
                    {row.label}
                  </span>
                  <ClextralTimeCell
                    row={row}
                    value={hourValues[activeHour]?.[key]}
                    onChange={(value) =>
                      updateHourValue(group.title, row.label, value)
                    }
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
          <h2 className="text-xl font-bold text-gray-950">
            Ocorrencias / Nao conformidades
          </h2>
          <p className="text-sm font-semibold text-gray-600">
            Horario, causa, acao e responsavel
          </p>
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
                  <input
                    type="time"
                    className="min-h-12 w-full rounded-md border border-gray-300 px-2 font-semibold"
                  />
                </td>
                {["Nao conformidade", "Causa", "Acao", "Responsavel"].map(
                  (column) => (
                    <td key={column} className="px-3 py-3">
                      <input className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold" />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-200 p-3">
        <button
          type="button"
          className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-red px-4 font-bold text-white"
          onClick={() =>
            setRows((current) => [...current, { id: current.length + 1 }])
          }
        >
          <Plus size={18} />
          Adicionar ocorrencia
        </button>
      </div>
    </section>
  );
}

function getCurrentTimeValue() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BateladaMilhoForm({ registro }) {
  const [rows, setRows] = useState([]);

  function addBatelada() {
    setRows((current) => [
      ...current,
      {
        id: current.length + 1,
        numero: current.length + 1,
        horario: getCurrentTimeValue(),
      },
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
              <p className="text-sm font-semibold text-gray-600">
                Adicione uma batelada a cada preparo do milho
              </p>
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
                    <td className="px-3 py-3 text-base font-bold text-gray-950">
                      {row.numero}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="time"
                        className="min-h-12 w-full rounded-md border border-gray-300 px-2 font-semibold"
                        defaultValue={row.horario}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
                        defaultValue={registro?.operador ?? ""}
                      />
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
                      <input
                        type="date"
                        className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
                      />
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
              <p className="text-lg font-bold text-gray-950">
                Nenhuma batelada adicionada
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-600">
                Clique para criar a primeira linha com o horario atual.
              </p>
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
      y: event.clientY - rect.top,
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
      imagem: canvasRef.current.toDataURL("image/png"),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section className="w-full max-w-3xl overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-xl font-bold text-gray-950">
              Assinatura - {label}
            </h2>
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
        assinatura
          ? "bg-cicopal-green text-white"
          : "bg-cicopal-blue text-white"
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
    Operador: registro?.operador ?? "",
    Qualidade: "Qualidade",
    Supervisor: "Supervisor",
  };

  function salvarAssinatura(assinatura) {
    setSigned((current) => ({
      ...current,
      [activeSigner.toLowerCase()]: assinatura,
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
          ["Supervisor", signed.supervisor],
        ].map(([label, assinatura]) => (
          <div
            key={label}
            className={`rounded-md border p-3 ${assinatura ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}
          >
            <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
            <p className="mt-1 min-h-6 font-semibold text-gray-800">
              {assinatura?.nome ?? "Pendente"}
            </p>
            <p className="text-xs font-semibold text-gray-500">
              {assinatura?.dataHora ?? ""}
            </p>
            {assinatura?.imagem ? (
              <div className="mt-2 flex h-20 items-center rounded-md border border-green-200 bg-white p-2">
                <img
                  src={assinatura.imagem}
                  alt={`Assinatura ${label}`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}
            <SignatureActionButton
              assinatura={assinatura}
              onOpen={() => setActiveSigner(label)}
            />
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

function PhotoHourlyGrid({ activeHour = "", onSave, recentPhotos = [] }) {
  const [photo, setPhoto] = useState(null);
  const [observation, setObservation] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function updatePhoto(file) {
    if (!file) return;
    setProcessing(true);
    try {
      const imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const image = new Image();
          image.onerror = reject;
          image.onload = () => {
            const maxSide = 1280;
            const scale = Math.min(
              1,
              maxSide / Math.max(image.width, image.height),
            );
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas
              .getContext("2d")
              .drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.72));
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
      setPhoto({ name: file.name, type: "image/jpeg", data: imageUrl });
    } finally {
      setProcessing(false);
    }
  }

  async function savePhoto() {
    if (!photo || saving) return;
    setSaving(true);
    try {
      await onSave?.({
        apontamentos: [
          {
            horario: activeHour,
            item: "Registro fotográfico",
            resultado: "Anexado",
            observacao: observation,
          },
        ],
        fotografias: [
          {
            horario: activeHour,
            nome: photo.name,
            tipo: photo.type,
            imagem: photo.data,
            observacao: observation,
          },
        ],
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-4 flex items-center gap-3">
        <Camera size={24} className="text-cicopal-blue" />
        <div>
          <h2 className="text-xl font-bold text-gray-950">
            RG - Registro Fotografico
          </h2>
          <p className="text-sm font-semibold text-gray-600">
            Registro visual do produto de hora em hora
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="p-3 text-lg font-bold text-gray-950">
              {activeHour}
            </span>
            <span
              className={`mr-3 rounded-full px-3 py-1 text-xs font-bold ${
                photo
                  ? "bg-green-100 text-cicopal-green"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {photo
                ? "Foto pronta"
                : processing
                  ? "Processando..."
                  : "Pendente"}
            </span>
          </div>
          {photo ? (
            <img
              src={photo.data}
              alt="Pré-visualização do registro"
              className="max-h-[420px] w-full bg-gray-100 object-contain"
            />
          ) : (
            <label className="m-3 flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 font-black text-cicopal-blue">
              <Camera size={24} />
              Tirar foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => updatePhoto(event.target.files?.[0])}
              />
            </label>
          )}
          <label className="m-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white font-bold text-gray-700">
            <Upload size={20} />
            {photo ? "Trocar imagem" : "Anexar da galeria"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => updatePhoto(event.target.files?.[0])}
            />
          </label>
        </article>
        <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-gray-500">
            Detalhes do registro
          </p>
          {photo ? (
            <p className="mt-2 truncate text-sm font-bold text-gray-700">
              {photo.name}
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-gray-500">
              Capture ou selecione uma imagem para continuar.
            </p>
          )}
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
              Observacao
            </span>
            <textarea
              rows={4}
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              className="w-full rounded-xl border border-gray-300 p-3 font-semibold"
              placeholder="Opcional"
            />
          </label>
          <button
            type="button"
            disabled={!photo || processing || saving}
            onClick={savePhoto}
            className="mt-4 min-h-16 w-full rounded-xl bg-cicopal-green text-lg font-black text-white disabled:bg-gray-300"
          >
            {saving ? "Salvando imagem..." : `Salvar foto de ${activeHour}`}
          </button>
        </aside>
      </div>
      {recentPhotos.length ? (
        <div className="mt-6 border-t border-gray-200 pt-5">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">
              Histórico visual
            </p>
            <h3 className="text-xl font-black text-gray-950">
              Últimos registros fotográficos
            </h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentPhotos.slice(0, 6).map((item, index) => (
              <figure
                key={`${item.horario}-${index}`}
                className="min-w-52 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
              >
                <img
                  src={item.imagem}
                  alt={`Registro de ${item.horario}`}
                  className="h-32 w-full object-cover"
                />
                <figcaption className="p-3 text-sm font-black text-gray-700">
                  {item.horario}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HigienizacaoContexto({ registro }) {
  return (
    <section className="mb-4 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <LockedField label="Operador logado" value={registro?.operador} />
        <LockedField label="Turno operador" value={registro?.turno} />
        <LockedField
          label="Data/Hora do registro"
          value={registro?.dataRegistro}
        />
      </div>
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <SelectField
          label="Tipo de setup"
          defaultValue={registro?.motivo ?? "Troca de sabor/produto"}
          options={[
            "Troca de sabor/produto",
            "Inicio de producao semana",
            "Final de producao",
            "Outros",
          ]}
        />
        <Field
          label="Troca de sabor/produto de"
          defaultValue={registro?.setupDe ?? ""}
          placeholder="Produto anterior"
        />
        <Field
          label="Para"
          defaultValue={registro?.setupPara ?? registro?.produto ?? ""}
          placeholder="Produto novo"
        />
      </div>
      <Field
        label="Matriz de troca"
        defaultValue={registro?.matriz ?? ""}
        placeholder="Ex: de Cebola para Bacon"
      />
    </section>
  );
}

function Rg003ProcessObjective({ registro, lineId = "ROS" }) {
  const [cycle, setCycle] = useState(null);
  useEffect(() => {
    try {
      setCycle(
        JSON.parse(
          window.localStorage.getItem(`carper_rg003_cycle_${lineId}`) ?? "null",
        ),
      );
    } catch {
      setCycle(null);
    }
  }, [lineId]);
  const isChangeover =
    cycle?.reason === "Troca de produto" || Boolean(cycle?.previousProduct);
  const currentProduct =
    cycle?.product ??
    registro?.setupPara ??
    registro?.produto ??
    "Produto não informado";
  const previousProduct = cycle?.previousProduct ?? registro?.setupDe ?? "";
  return (
    <section className="mb-4 rounded-md border border-gray-300 border-l-4 border-l-cicopal-blue bg-white p-4">
      <p className="text-xs font-bold uppercase text-gray-500">
        Objetivo do processo
      </p>
      <h2 className="mt-1 text-xl font-bold text-gray-950">
        {isChangeover
          ? `Troca de ${previousProduct} para ${currentProduct}`
          : `Início de produção — ${currentProduct}`}
      </h2>
      {isChangeover ? (
        <p className="mt-2 text-sm font-semibold text-gray-600">
          O produto anterior foi recuperado automaticamente do último ciclo de
          produção.
        </p>
      ) : null}
    </section>
  );
}

function ProdutoContexto({ registro, options }) {
  const produtoOptions = options ?? {};

  return (
    <section className="mb-4 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <SelectField
          label="Marca"
          defaultValue={registro?.marca ?? ""}
          options={["", ...(produtoOptions.marcas ?? [])]}
        />
        <SelectField
          label="Sabor"
          defaultValue={registro?.sabor ?? registro?.produto ?? ""}
          options={["", ...(produtoOptions.sabores ?? [])]}
        />
        <SelectField
          label="Gramatura"
          defaultValue={registro?.gramatura ?? ""}
          options={["", ...(produtoOptions.gramaturas ?? [])]}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <LockedField label="Operador logado" value={registro?.operador} />
        <LockedField label="Turno operador" value={registro?.turno} />
        <LockedField
          label="Data/Hora do registro"
          value={registro?.dataRegistro}
        />
      </div>
    </section>
  );
}

function Rg003ProductContext({ cycle }) {
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-300 border-l-4 border-l-cicopal-blue bg-white p-4">
      <div>
        <p className="text-xs font-bold uppercase text-gray-500">
          Produto deste ciclo
        </p>
        <p className="mt-1 text-xl font-bold text-gray-950">
          {cycle?.product ?? "Produto do ciclo"}
        </p>
      </div>
      <p className="text-sm font-semibold text-gray-500">
        Definido no início da produção e bloqueado para edição.
      </p>
    </section>
  );
}

function LegacyPersistedRg003Summary({ data, onEdit }) {
  const values = data.subregistro ?? {};
  const entries = [
    ...(values.avaliacoes ?? []),
    ...(values.apontamentos ?? []),
  ];
  const [confirmEdit, setConfirmEdit] = useState(false);
  return (
    <section className="min-h-[calc(100vh-250px)] overflow-hidden rounded-lg border border-gray-300 bg-white">
      <header className="brand-header flex flex-wrap items-center justify-between gap-4 p-5 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">
            CICOPAL · RG.QUA.BA.003
          </p>
          <h2 className="mt-1 text-2xl font-bold">Registro confirmado</h2>
          <p className="mt-1 text-sm font-semibold text-white/75">
            Somente visualização
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold">
            {new Date(data.filledAt).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-white/70">Versão {data.version}</p>
        </div>
      </header>
      <div className="border-b border-gray-200 bg-green-50 px-5 py-3 text-sm font-bold text-cicopal-green">
        ✓ Preenchimento gravado e protegido contra alterações acidentais.
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {entries.length ? (
          entries.map((item, index) => (
            <article
              key={`${item.item}-${index}`}
              className="border border-gray-200 bg-white p-4"
            >
              <p className="text-xs font-bold uppercase text-gray-400">
                {item.maquina ?? item.grupo ?? "Parâmetro"}
              </p>
              <p className="mt-1 font-semibold text-gray-800">{item.item}</p>
              <strong
                className={`mt-3 inline-flex min-h-8 items-center px-3 text-sm ${item.resultado === "NC" || item.av1 === "NC" ? "bg-red-50 text-cicopal-red" : "bg-green-50 text-cicopal-green"}`}
              >
                {item.resultado ?? item.av1 ?? "Preenchido"}
              </strong>
            </article>
          ))
        ) : (
          <p className="text-sm font-semibold text-gray-500">
            Registro concluído sem itens detalhados.
          </p>
        )}
      </div>
      {values.ncs?.length ? (
        <div className="border-y border-red-100 bg-red-50 p-4 text-sm font-bold text-cicopal-red">
          {values.ncs.length} não conformidade(s) vinculada(s).
        </div>
      ) : null}
      <footer className="flex justify-end border-t border-gray-200 p-5">
        <button
          type="button"
          className="min-h-14 rounded-md border border-amber-300 bg-amber-50 px-5 font-bold text-amber-900"
          onClick={() => setConfirmEdit(true)}
        >
          Solicitar alteração
        </button>
      </footer>
      {confirmEdit ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <section className="w-full max-w-lg overflow-hidden rounded-lg border border-gray-300 bg-white shadow-2xl">
            <header className="brand-header p-4 text-white">
              <p className="text-xs font-bold uppercase text-white/70">
                CICOPAL · RG 003
              </p>
              <h3 className="mt-1 text-xl font-bold">Confirmar alteração</h3>
            </header>
            <div className="p-5">
              <p className="font-semibold text-gray-800">
                Este registro já foi confirmado. Deseja abrir para alteração?
              </p>
              <p className="mt-2 text-sm text-gray-500">
                A nova versão registrará o Técnico, data e hora da modificação.
              </p>
            </div>
            <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 p-4">
              <button
                type="button"
                className="min-h-14 border border-gray-300 bg-white font-bold"
                onClick={() => setConfirmEdit(false)}
              >
                Manter visualização
              </button>
              <button
                type="button"
                className="min-h-14 bg-amber-500 font-bold text-white"
                onClick={onEdit}
              >
                Confirmar alteração
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function PersistedRg003Summary({ data, onEdit }) {
  const [confirmEdit, setConfirmEdit] = useState(false);
  const values = data.subregistro ?? {};
  const entries = [
    ...(values.avaliacoes ?? []),
    ...(values.apontamentos ?? []),
  ];
  const photos = values.fotografias ?? [];
  const groups = Object.entries(
    entries.reduce((result, item) => {
      const key = item.maquina ?? item.grupo ?? "Parâmetros gerais";
      (result[key] ??= []).push(item);
      return result;
    }, {}),
  );
  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-[#171b78] to-cicopal-blue p-6 text-white">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-white/65">
            Registro confirmado
          </p>
          <h2 className="mt-2 text-2xl font-black">Preenchimento concluído</h2>
          <p className="mt-1 text-sm font-semibold text-white/75">
            Organizado por etapa e máquina
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
          <p className="font-black">
            {new Date(data.filledAt).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs font-bold text-white/65">
            Versão {data.version}
          </p>
        </div>
      </header>
      <div className="flex items-center gap-3 border-b border-green-100 bg-green-50 px-6 py-4 font-black text-cicopal-green">
        <CheckCircle2 size={22} />
        Salvo e protegido
      </div>
      {photos.length ? (
        <div className="grid gap-4 border-b border-gray-200 p-6 md:grid-cols-2">
          {photos.map((photo, index) => (
            <figure
              key={`${photo.horario}-${index}`}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
            >
              <img
                src={photo.imagem}
                alt={`Registro de ${photo.horario}`}
                className="max-h-96 w-full object-contain"
              />
              <figcaption className="p-3 font-bold">
                {photo.horario}
                {photo.observacao ? ` · ${photo.observacao}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <div className="space-y-5 p-6">
        {groups.map(([group, items]) => (
          <section key={group}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-500">
                {group}
              </h3>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-500">
                {items.length} itens
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((item, index) => {
                const result = item.resultado ?? item.av1 ?? "Preenchido";
                const nc = result === "NC";
                return (
                  <article
                    key={`${item.item}-${index}`}
                    className={`flex min-h-20 items-center justify-between gap-3 rounded-2xl border p-4 ${nc ? "border-red-100 bg-red-50" : "border-green-100 bg-green-50/50"}`}
                  >
                    <div>
                      <p className="font-bold text-gray-900">{item.item}</p>
                      {item.gramatura ? (
                        <p className="mt-1 text-xs font-bold text-gray-500">
                          {item.gramatura}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`grid min-h-12 min-w-14 place-items-center rounded-xl px-3 text-sm font-black text-white ${nc ? "bg-cicopal-red" : "bg-cicopal-green"}`}
                    >
                      {result}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {!groups.length && !photos.length ? (
          <p className="rounded-2xl bg-gray-50 p-5 font-semibold text-gray-500">
            Registro concluído sem itens detalhados.
          </p>
        ) : null}
      </div>
      {values.ncs?.length ? (
        <div className="border-t border-red-100 bg-red-50 p-5 font-black text-cicopal-red">
          <AlertTriangle className="mr-2 inline" />
          {values.ncs.length} não conformidade(s)
        </div>
      ) : null}
      <footer className="flex justify-end border-t border-gray-200 p-5">
        <button
          type="button"
          className="min-h-14 rounded-xl border border-amber-300 bg-amber-50 px-5 font-black text-amber-900"
          onClick={() => setConfirmEdit(true)}
        >
          Editar registro
        </button>
      </footer>
      <SystemConfirmationDialog
        confirmation={
          confirmEdit
            ? {
                title: "Editar registro confirmado?",
                description:
                  "A alteração criará uma nova versão com a identidade do técnico, data e hora da modificação.",
                confirmLabel: "Abrir para edição",
              }
            : null
        }
        onAnswer={(answer) => {
          setConfirmEdit(false);
          if (answer) onEdit?.();
        }}
      />
    </section>
  );
}

function buildAllowedCycleHours(cycle) {
  const currentSlot = getCurrentHourSlot();
  const fallback = [
    {
      key: currentSlot,
      value: currentSlot,
      hour: currentSlot,
      label: currentSlot,
      timestamp: Date.now(),
      locked: false,
    },
  ];
  const productionStart =
    cycle?.productionStartedAt ??
    cycle?.events?.find((item) =>
      String(item.label ?? "")
        .toLowerCase()
        .includes("produção iniciada"),
    )?.at ??
    cycle?.startedAt;
  if (!productionStart) return fallback;
  const start = new Date(productionStart);
  if (!Number.isFinite(start.getTime())) return fallback;
  start.setMinutes(0, 0, 0);
  const productionEnd =
    cycle.productionEndedAt ?? cycle.endedAt ?? Date.now() + 3_600_000;
  const end = new Date(productionEnd);
  if (!Number.isFinite(end.getTime())) return fallback;
  end.setMinutes(0, 0, 0);
  if (end < start) end.setTime(start.getTime());
  const result = [];
  for (
    let cursor = new Date(start);
    cursor <= end && result.length < 145;
    cursor = new Date(cursor.getTime() + 3_600_000)
  ) {
    const value = `${String(cursor.getHours()).padStart(2, "0")}:00`;
    const slot = cursor.toISOString();
    result.push({
      key: slot,
      value: slot,
      hour: value,
      timestamp: cursor.getTime(),
      dateLabel: cursor.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      label:
        cursor
          .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
          .replace(".", "") + ` · ${value}`,
      locked: cursor.getTime() > Date.now(),
    });
  }
  return result.length ? result : fallback;
}

export function Rg005SubregistroForm({
  lineId = "ROS",
  documentName,
  loteId,
  registro,
  subregistro,
  loggedUser,
  onSave,
}) {
  const [savedAt, setSavedAt] = useState("");
  const [registroDataHora] = useState(() => new Date().toLocaleString("pt-BR"));
  const [activeHour, setActiveHour] = useState(() => getCurrentHourSlot());
  const [cycleContext, setCycleContext] = useState(null);
  const [persistedRecord, setPersistedRecord] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [productSpecifications, setProductSpecifications] = useState([]);
  const confirmationResolver = useRef(null);
  const isRg003 = ["RG.QUA.BA.003", "RG.QUA.005", "RG.QUA.004"].includes(
    documentName,
  );
  const cycleStorageKey = `carper_rg003_cycle_${lineId}`;
  function requestConfirmation(options) {
    return new Promise((resolve) => {
      confirmationResolver.current = resolve;
      setConfirmation(options);
    });
  }
  function answerConfirmation(answer) {
    confirmationResolver.current?.(answer);
    confirmationResolver.current = null;
    setConfirmation(null);
  }
  useEffect(() => {
    if (!isRg003) return;
    function loadCycle(event) {
      if (event?.detail) {
        setCycleContext(repairTextDeep(event.detail));
        return;
      }
      try {
        setCycleContext(
          repairTextDeep(
            JSON.parse(window.localStorage.getItem(cycleStorageKey) ?? "null"),
          ),
        );
      } catch {
        setCycleContext(null);
      }
    }
    loadCycle();
    window.addEventListener("rg003-cycle-updated", loadCycle);
    return () => window.removeEventListener("rg003-cycle-updated", loadCycle);
  }, [cycleStorageKey, isRg003]);
  useEffect(() => {
    const product = cycleContext?.product ?? cycleContext?.produto;
    if (!product) {
      setProductSpecifications([]);
      return;
    }
    try {
      const local = JSON.parse(
        window.localStorage.getItem("carper_product_specifications") ?? "{}",
      );
      setProductSpecifications(local[`${lineId}:${product}`] ?? []);
    } catch {
      setProductSpecifications([]);
    }
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("configuracoes_produto")
      .select("parametros")
      .eq("linha_id", lineId)
      .eq("produto", product)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.parametros) setProductSpecifications(data.parametros);
      });
  }, [cycleContext?.id, cycleContext?.product, cycleContext?.produto, lineId]);
  useEffect(() => {
    setSavedAt("");
    setPersistedRecord(null);
    setEditMode(false);
    setConfirmation(null);
  }, [cycleContext?.id, registro?.id, subregistro?.id]);
  useEffect(() => {
    let active = true;
    setPersistedRecord(null);
    setEditMode(false);
    if (!isRg003 || !registro?.id || !cycleContext?.id) return;
    loadRg003Record(registro.id)
      .then((data) => {
        if (active) {
          setPersistedRecord(data);
          setEditMode(false);
        }
      })
      .catch(() => {
        if (active) setPersistedRecord(null);
      });
    return () => {
      active = false;
    };
  }, [cycleContext?.id, isRg003, registro?.id, subregistro?.id]);
  useEffect(() => {
    setEditMode(false);
  }, [activeHour, subregistro?.id]);
  const allowedHours = useMemo(
    () => buildAllowedCycleHours(cycleContext),
    [cycleContext],
  );
  useEffect(() => {
    if (
      !isRg003 ||
      !allowedHours.length ||
      allowedHours.some((entry) => entry.value === activeHour)
    )
      return;
    const latestAvailable =
      [...allowedHours].reverse().find((entry) => !entry.locked) ??
      allowedHours[0];
    setActiveHour(latestAvailable.value);
  }, [activeHour, allowedHours, isRg003]);
  if (!subregistro) return null;
  const config = getRgDocumentConfig(documentName);
  const configuredProductColumns = config.avaliacaoProdutoColumns.map((column) => {
    const specification = matchSpecification(productSpecifications, column.label);
    return specification
      ? { ...column, unit: specification.unit || column.unit, specification }
      : column;
  });
  const isHourlyRg003 =
    isRg003 &&
    ["produto_avaliacao", "processo", "fotografico"].includes(subregistro.id);
  const persistedFillings = persistedRecord?.fillings ?? [];
  const fillingHour = (item) =>
    item.subregistro?.apontamentos?.[0]?.horario ??
    item.subregistro?.avaliacoes?.[0]?.horario ??
    "";
  const activeHourLabel =
    allowedHours.find((entry) => entry.value === activeHour)?.hour ??
    activeHour;
  const fillingSlot = (item) => item.subregistro?._slotKey ?? fillingHour(item);
  const completedHours = [
    ...new Set(
      [
        ...persistedFillings.map(fillingSlot),
        ...[
          ...(subregistro?.apontamentos ?? []),
          ...(subregistro?.avaliacoes ?? []),
        ].map((item) => item._slotKey ?? item.horario),
      ].filter(Boolean),
    ),
  ];
  const activePersisted = isHourlyRg003
    ? [...persistedFillings]
        .reverse()
        .find(
          (item) =>
            fillingSlot(item) === activeHour ||
            (!item.subregistro?._slotKey &&
              fillingHour(item) === activeHourLabel),
        )
    : persistedRecord;
  const recentPhotos = [...persistedFillings]
    .reverse()
    .flatMap((item) => item.subregistro?.fotografias ?? []);
  if (isRg003 && !isHourlyRg003 && persistedRecord && !editMode)
    return (
      <PersistedRg003Summary
        data={persistedRecord}
        onEdit={() => setEditMode(true)}
      />
    );
  const effectiveRegistro = {
    ...registro,
    operador: loggedUser?.nome ?? registro?.operador ?? "",
    operadorId: loggedUser?.id ?? registro?.operadorId,
    turno: loggedUser?.turno ?? registro?.turno ?? "",
    dataRegistro:
      registro?.dataRegistro && registro.dataRegistro !== "Novo registro"
        ? registro.dataRegistro
        : registroDataHora,
  };

  async function saveProcesso(payload = {}) {
    if (
      isRg003 &&
      subregistro.id === "higienizacao" &&
      !(await requestConfirmation({
        title: "Confirmar higienização?",
        description:
          "Ao confirmar, este checklist será gravado como pré-requisito da produção. Você permanecerá nesta tela e a próxima etapa ficará disponível no fluxo.",
        confirmLabel: "Confirmar registro",
      }))
    )
      return false;
    if (
      isRg003 &&
      subregistro.id === "produto_liberacao" &&
      !(await requestConfirmation({
        title: "Liberar produto?",
        description:
          "Ao confirmar, a liberação será registrada e a produção ficará disponível para início.",
        confirmLabel: "Liberar produto",
      }))
    )
      return false;
    const saveResult = await onSave?.({
      registro: {
        ...effectiveRegistro,
        status: "Gravado",
        dataRegistro: effectiveRegistro.dataRegistro,
      },
      subregistro: {
        ...subregistro,
        ...payload,
        ...(isHourlyRg003 ? { _slotKey: activeHour } : {}),
        ...(activePersisted && editMode
          ? {
              _persistence: {
                id: activePersisted.fillingId,
                version: activePersisted.version,
              },
            }
          : {}),
        status: payload.ncs?.length ? "Com NC" : "Gravado",
      },
    });
    if (saveResult === false) return false;
    if (
      isRg003 &&
      subregistro.id === "higienizacao" &&
      !(payload.ncs ?? []).length
    ) {
      try {
        const storageKey = cycleStorageKey;
        const cycle = JSON.parse(
          window.localStorage.getItem(storageKey) ?? "null",
        );
        if (cycle) {
          const nextCycle = {
            ...cycle,
            status: "awaiting_release",
            stageStartedAt: new Date().toISOString(),
            events: [
              ...(cycle.events ?? []),
              {
                id: `higiene-${Date.now()}`,
                label: "Higienização concluída conforme",
                at: new Date().toISOString(),
                operator: effectiveRegistro.operador,
              },
            ],
          };
          window.localStorage.setItem(storageKey, JSON.stringify(nextCycle));
          window.dispatchEvent(
            new CustomEvent("rg003-cycle-updated", { detail: nextCycle }),
          );
          await persistCycleTransition({
            cycle,
            status: "awaiting_release",
            description: "Higienização concluída conforme",
            operatorId: effectiveRegistro.operadorId,
            operatorName: effectiveRegistro.operador,
            activeAction: null,
          });
        }
      } catch (error) {
        setSavedAt("");
      }
    }
    if (
      isRg003 &&
      subregistro.id === "produto_liberacao" &&
      !(payload.ncs ?? []).length
    ) {
      try {
        const storageKey = cycleStorageKey;
        const cycle = JSON.parse(
          window.localStorage.getItem(storageKey) ?? "null",
        );
        if (cycle) {
          const nextCycle = {
            ...cycle,
            status: "ready",
            stageStartedAt: new Date().toISOString(),
            events: [
              ...(cycle.events ?? []),
              {
                id: `liberacao-${Date.now()}`,
                label: "Produto liberado para início",
                at: new Date().toISOString(),
                operator: effectiveRegistro.operador,
              },
            ],
          };
          window.localStorage.setItem(storageKey, JSON.stringify(nextCycle));
          window.dispatchEvent(
            new CustomEvent("rg003-cycle-updated", { detail: nextCycle }),
          );
          await persistCycleTransition({
            cycle,
            status: "ready",
            description: "Produto liberado para início",
            operatorId: effectiveRegistro.operadorId,
            operatorName: effectiveRegistro.operador,
            activeAction: null,
          });
        }
      } catch (error) {
        setSavedAt("");
      }
    }
    if (
      isRg003 &&
      ["produto_avaliacao", "processo", "fotografico"].includes(subregistro.id)
    ) {
      try {
        const storageKey = cycleStorageKey;
        const cycle = JSON.parse(
          window.localStorage.getItem(storageKey) ?? "null",
        );
        if (cycle?.activeAction) {
          const nextCycle = {
            ...cycle,
            activeAction: null,
            events: [
              ...(cycle.events ?? []),
              {
                id: `atividade-${Date.now()}`,
                label: `${cycle.activeAction.label} gravada`,
                at: new Date().toISOString(),
                operator: effectiveRegistro.operador,
              },
            ],
          };
          window.localStorage.setItem(storageKey, JSON.stringify(nextCycle));
          window.dispatchEvent(
            new CustomEvent("rg003-cycle-updated", { detail: nextCycle }),
          );
          await persistCycleTransition({
            cycle,
            status: cycle.status,
            description: `${cycle.activeAction.label} gravada`,
            operatorId: effectiveRegistro.operadorId,
            operatorName: effectiveRegistro.operador,
            activeAction: null,
          });
        }
      } catch {
        setSavedAt("");
      }
    }
    setSavedAt(
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    return true;
  }

  if (subregistro.id === "higienizacao") {
    return (
      <>
        {isRg003 ? (
          <Rg003ProcessObjective registro={effectiveRegistro} lineId={lineId} />
        ) : (
          <HigienizacaoContexto registro={effectiveRegistro} />
        )}
        <ChecklistTable
          key={`${cycleContext?.id ?? "sem-ciclo"}-higienizacao`}
          documentName={`${documentName} - Higienizacao`}
          loteId={loteId}
          registro={effectiveRegistro}
          subregistro={subregistro}
          groups={config.checklistGroups}
          onSave={saveProcesso}
          onNextStep={() =>
            window.dispatchEvent(
              new CustomEvent("rg003-advance-process", {
                detail: { processId: "produto_liberacao" },
              }),
            )
          }
          nextStepLabel="Ir para liberação do produto"
          stepByStep={isRg003}
        />
        {!isRg003 || savedAt ? (
          <AssinaturasRegistro registro={effectiveRegistro} />
        ) : null}
        <SystemConfirmationDialog
          confirmation={confirmation}
          onAnswer={answerConfirmation}
        />
      </>
    );
  }

  if (subregistro.id === "produto_liberacao") {
    return (
      <>
        {isRg003 ? (
          <Rg003ProductContext cycle={cycleContext} />
        ) : (
          <ProdutoContexto
            registro={effectiveRegistro}
            options={config.produtoOptions}
          />
        )}
        {isRg003 ? (
          <TabletRelease
            key={`${cycleContext?.id ?? "sem-ciclo"}-liberacao`}
            columns={config.liberacaoProdutoColumns}
            activeHour="Pré-produção"
            registro={effectiveRegistro}
            onSave={saveProcesso}
            onNextStep={() =>
              window.dispatchEvent(
                new CustomEvent("rg003-advance-process", { detail: {} }),
              )
            }
          />
        ) : (
          <LiberacaoProdutoTable
            columns={config.liberacaoProdutoColumns}
            registro={effectiveRegistro}
            onSave={saveProcesso}
          />
        )}
        {!isRg003 || savedAt ? (
          <AssinaturasRegistro registro={effectiveRegistro} />
        ) : null}
        <SystemConfirmationDialog
          confirmation={confirmation}
          onAnswer={answerConfirmation}
        />
      </>
    );
  }

  if (subregistro.id === "produto_avaliacao") {
    return (
      <>
        {isRg003 ? (
          <TabletHourNavigator
            activeHour={activeHour}
            onChange={setActiveHour}
            allowedHours={allowedHours}
            completedHours={completedHours}
          />
        ) : null}
        {isRg003 ? (
          <Rg003ProductContext cycle={cycleContext} />
        ) : (
          <ProdutoContexto
            registro={effectiveRegistro}
            options={config.produtoOptions}
          />
        )}
        {isRg003 && activePersisted && !editMode ? (
          <PersistedRg003Summary
            data={activePersisted}
            onEdit={() => setEditMode(true)}
          />
        ) : isRg003 ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-cicopal-blue">
                Controle hora a hora
              </p>
              <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-black text-gray-950">
                    Avaliação do produto
                  </h2>
                  <p className="mt-1 font-semibold text-gray-600">
                    Preencha os parâmetros gerais e depois cada máquina ativa.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-cicopal-blue">
                  Horário {activeHourLabel}
                </span>
              </div>
            </section>
            <ProductEvaluationTabletFlow
              key={activeHour}
              columns={configuredProductColumns}
              machines={config.produtoMaquinas}
              gramaturas={config.produtoOptions.gramaturas}
              registro={effectiveRegistro}
              activeHour={activeHourLabel}
              onSave={saveProcesso}
            />
          </div>
        ) : (
          <>
            <ProductEvaluationHourlyTable
              columns={configuredProductColumns}
            />
            <MachineHourlySections
              title="Avaliacao por maquina"
              machines={config.produtoMaquinas}
              registro={effectiveRegistro}
              onSave={saveProcesso}
            />
          </>
        )}
        {!isRg003 ? (
          <SaveProcessBar savedAt={savedAt} onSave={() => saveProcesso()} />
        ) : null}
        {!isRg003 || savedAt ? (
          <AssinaturasRegistro registro={effectiveRegistro} />
        ) : null}
      </>
    );
  }

  if (subregistro.id === "processo") {
    return (
      <>
        {isRg003 ? (
          <TabletHourNavigator
            activeHour={activeHour}
            onChange={setActiveHour}
            allowedHours={allowedHours}
            completedHours={completedHours}
          />
        ) : null}
        {isRg003 ? <Rg003ProductContext cycle={cycleContext} /> : null}
        {isRg003 && activePersisted && !editMode ? (
          <PersistedRg003Summary
            data={activePersisted}
            onEdit={() => setEditMode(true)}
          />
        ) : isRg003 ? (
          <ProcessEvaluationTabletFlow
            key={activeHour}
            machines={
              config.processoMaquinas?.length
                ? config.processoMaquinas
                : [{ label: "Linha", columns: processoColumns }]
            }
            gramaturas={config.produtoOptions.gramaturas}
            registro={effectiveRegistro}
            activeHour={activeHourLabel}
            onSave={saveProcesso}
          />
        ) : (
          <MachineHourlySections
            title="RG - Processo"
            machines={
              config.processoMaquinas?.length
                ? config.processoMaquinas
                : [{ label: "Linha", columns: processoColumns }]
            }
            registro={effectiveRegistro}
            onSave={saveProcesso}
            requireMachineSetup={false}
            gramaturas={config.produtoOptions.gramaturas}
            activeHour={isRg003 ? activeHourLabel : ""}
          />
        )}
        {!isRg003 || savedAt ? (
          <AssinaturasRegistro registro={effectiveRegistro} />
        ) : null}
      </>
    );
  }

  if (subregistro.id === "fotografico") {
    return (
      <>
        {isRg003 ? (
          <TabletHourNavigator
            activeHour={activeHour}
            onChange={setActiveHour}
            allowedHours={allowedHours}
            completedHours={completedHours}
          />
        ) : null}
        {isRg003 ? <Rg003ProductContext cycle={cycleContext} /> : null}
        {isRg003 && activePersisted && !editMode ? (
          <PersistedRg003Summary
            data={activePersisted}
            onEdit={() => setEditMode(true)}
          />
        ) : (
          <PhotoHourlyGrid
            activeHour={isRg003 ? activeHourLabel : ""}
            onSave={saveProcesso}
            recentPhotos={recentPhotos}
          />
        )}
        {!isRg003 || savedAt ? (
          <AssinaturasRegistro registro={effectiveRegistro} />
        ) : null}
      </>
    );
  }

  if (subregistro.id === "extrusora_clextral") {
    return (
      <div className="space-y-4">
        <ClextralContexto registro={effectiveRegistro} />
        <ClextralParameterTable registro={effectiveRegistro} />
        <ClextralOccurrencesTable />
        <SaveProcessBar savedAt={savedAt} onSave={() => saveProcesso()} />
        <AssinaturasRegistro registro={effectiveRegistro} />
      </div>
    );
  }

  if (subregistro.id === "batelada_milho") {
    return (
      <>
        <BateladaMilhoForm registro={effectiveRegistro} />
        <SaveProcessBar savedAt={savedAt} onSave={() => saveProcesso()} />
        <AssinaturasRegistro registro={effectiveRegistro} />
      </>
    );
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Check size={24} className="text-cicopal-green" />
        <p className="text-lg font-bold text-gray-950">
          Subregistro selecionado.
        </p>
      </div>
    </section>
  );
}
