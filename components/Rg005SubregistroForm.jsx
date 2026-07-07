"use client";

import { useState } from "react";
import { Camera, Check, Clock, Plus, Upload } from "lucide-react";
import { ChecklistTable } from "@/components/ChecklistTable";

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
  { label: "Temperatura de envase", unit: "°C" }
];
const processoColumns = ["Datador", "Selagem", "Microfuro", "Caixa", "Etiqueta", "Peso", "Ar (mm)"];

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

function StatusClickButton({ value: controlledValue, onChange }) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue ?? internalValue;

  function setValue(nextValue) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  return (
    <button
      type="button"
      className={`min-h-12 w-full rounded-md border px-2 text-sm font-bold ${
        value === "NC"
          ? "border-cicopal-red bg-cicopal-red text-white"
          : value === "C"
            ? "border-cicopal-green bg-cicopal-green text-white"
            : "border-green-200 bg-green-50 text-cicopal-green"
      }`}
      onClick={() => setValue("C")}
      onDoubleClick={() => setValue("NC")}
      title="Um clique confirma C. Dois cliques marcam NC."
    >
      {value || "C"}
    </button>
  );
}

function HourlyTable({ title, columns, minWidth = "min-w-[980px]" }) {
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
                    <StatusClickButton />
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

function LiberacaoProdutoTable() {
  const [rows, setRows] = useState([{ id: 1 }]);

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
              {liberacaoProdutoColumns.map((column) => (
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
                  <input type="time" className="min-h-12 w-full rounded-md border border-gray-300 px-2 font-semibold" />
                </td>
                {liberacaoProdutoColumns.map((column) => (
                  <td key={column} className="px-3 py-3">
                    <StatusClickButton />
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
          className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white"
          onClick={() => setRows((current) => [...current, { id: current.length + 1 }])}
        >
          <Plus size={18} />
          Adicionar horario
        </button>
      </div>
    </section>
  );
}

function ProductEvaluationHourlyTable() {
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
              {avaliacaoProdutoColumns.map((column) => (
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
                {avaliacaoProdutoColumns.map((column) => (
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

function PhotoHourlyGrid() {
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
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">Pendente</span>
            </div>
            <button
              type="button"
              className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 font-bold text-gray-600"
            >
              <Camera size={24} />
              Tirar foto
            </button>
            <button
              type="button"
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white font-bold text-gray-700"
            >
              <Upload size={20} />
              Anexar arquivo
            </button>
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

export function Rg005SubregistroForm({ documentName, loteId, registro, subregistro }) {
  if (!subregistro) return null;

  if (subregistro.id === "higienizacao") {
    return (
      <>
        <HigienizacaoContexto registro={registro} />
        <ChecklistTable
          documentName={`${documentName} - Higienizacao`}
          loteId={loteId}
          registro={registro}
          subregistro={subregistro}
        />
      </>
    );
  }

  if (subregistro.id === "produto_liberacao") {
    return (
      <>
        <ProdutoContexto registro={registro} />
        <LiberacaoProdutoTable />
      </>
    );
  }

  if (subregistro.id === "produto_avaliacao") {
    return (
      <>
        <ProdutoContexto registro={registro} />
        <ProductEvaluationHourlyTable />
      </>
    );
  }

  if (subregistro.id === "processo") {
    return (
      <>
        <HourlyTable title="RG - Processo" columns={processoColumns} />
      </>
    );
  }

  if (subregistro.id === "fotografico") {
    return (
      <>
        <PhotoHourlyGrid />
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
