"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleGauge, Plus, Save, Trash2 } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const catalog = {
  ROS: {
    name: "Rosca",
    rg: "RG.QUA.BA.003",
    products: ["Rosca Leite", "Rosca Coco", "Rosca Chocolate", "Rosca Tradicional"],
    parameters: [
      ["Umidade do produto final", "%"],
      ["pH do biscoito", "pH"],
      ["Temperatura de envase", "°C"],
      ["Brix do açúcar invertido", "°Bx"],
      ["pH do açúcar invertido", "pH"],
    ],
  },
  PUR: {
    name: "Pururuca",
    rg: "RG.QUA.005",
    products: ["Pururuca Tradicional", "Pururuca Temperada"],
    parameters: [
      ["Umidade do produto final", "%"],
      ["Sal", "%"],
      ["Temperatura de envase", "°C"],
      ["Densidade", "g/L"],
    ],
  },
  SAL: {
    name: "Salgadinho",
    rg: "RG.QUA.004",
    products: ["Salgadinho Tradicional", "Salgadinho Queijo", "Salgadinho Churrasco"],
    parameters: [
      ["Umidade do produto final", "%"],
      ["Sal", "%"],
      ["Temperatura de envase", "°C"],
      ["Densidade", "g/L"],
    ],
  },
};

const makeParameter = ([name, unit], index) => ({
  id: `${name.toLowerCase().replace(/\W+/g, "-")}-${index}`,
  name,
  unit,
  criticalMin: "",
  idealMin: "",
  idealMax: "",
  criticalMax: "",
  allowNa: true,
});

function initialParameters(lineId) {
  return catalog[lineId].parameters.map(makeParameter);
}

export function ProductSpecificationsConfigurator() {
  const [lineId, setLineId] = useState("ROS");
  const [product, setProduct] = useState(catalog.ROS.products[0]);
  const [configurations, setConfigurations] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const key = `${lineId}:${product}`;
  const parameters = configurations[key] ?? initialParameters(lineId);

  useEffect(() => {
    const local = localStorage.getItem("carper_product_specifications");
    if (local) {
      try {
        setConfigurations(JSON.parse(local));
      } catch {}
    }
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("configuracoes_produto")
      .select("linha_id,produto,parametros")
      .then(({ data }) => {
        if (!data?.length) return;
        setConfigurations((current) => ({
          ...current,
          ...Object.fromEntries(
            data.map((item) => [`${item.linha_id}:${item.produto}`, item.parametros]),
          ),
        }));
      });
  }, []);

  const configuredCount = useMemo(
    () => parameters.filter((item) => item.idealMin !== "" && item.idealMax !== "").length,
    [parameters],
  );

  function updateParameters(next) {
    setConfigurations((current) => ({ ...current, [key]: next }));
    setMessage("");
  }

  function changeLine(nextLine) {
    setLineId(nextLine);
    setProduct(catalog[nextLine].products[0]);
    setMessage("");
  }

  async function save() {
    const invalid = parameters.some((item) => {
      const values = [item.criticalMin, item.idealMin, item.idealMax, item.criticalMax];
      if (values.every((value) => value === "")) return false;
      if (values.some((value) => value === "" || Number.isNaN(Number(value)))) return true;
      const [criticalMin, idealMin, idealMax, criticalMax] = values.map(Number);
      return !(criticalMin <= idealMin && idealMin <= idealMax && idealMax <= criticalMax);
    });
    if (invalid) {
      setMessage("Revise as faixas: limite mínimo ≤ ideal mínimo ≤ ideal máximo ≤ limite máximo.");
      return;
    }
    setSaving(true);
    const next = { ...configurations, [key]: parameters };
    localStorage.setItem("carper_product_specifications", JSON.stringify(next));
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("configuracoes_produto").upsert(
          {
            linha_id: lineId,
            produto: product,
            rg_codigo: catalog[lineId].rg,
            parametros: parameters,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: "linha_id,produto" },
        );
        if (error) throw error;
        setMessage("Especificações salvas no sistema.");
      } else {
        setMessage("Especificações salvas neste dispositivo.");
      }
    } catch (error) {
      setMessage(`Salvo neste dispositivo. Banco pendente: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <header className="overflow-hidden border border-blue-950 bg-gradient-to-r from-[#171b68] via-cicopal-blue to-[#3439a8] p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-red-300">Configuração técnica</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">Especificações por produto</h2>
            <p className="mt-1 max-w-3xl font-semibold text-blue-100">
              Os RGs e seus fluxos são controlados pelo sistema. Aqui você define somente os limites usados na avaliação de cada produto.
            </p>
          </div>
          <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-12 items-center gap-2 bg-white px-5 font-black text-cicopal-blue shadow-lg disabled:opacity-50">
            <Save size={19} /> {saving ? "Salvando..." : "Salvar especificações"}
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border border-gray-200 bg-[#f7f8fc] p-4 shadow-sm">
          <p className="px-2 pb-2 text-xs font-bold uppercase text-gray-400">Linha de produção</p>
          <div className="space-y-2">
            {Object.entries(catalog).map(([id, line]) => (
              <button key={id} type="button" onClick={() => changeLine(id)} className={`w-full border-l-4 p-4 text-left transition ${lineId === id ? "border-l-cicopal-red border-y-cicopal-blue border-r-cicopal-blue bg-white shadow-md" : "border-gray-200 bg-transparent hover:bg-white"}`}>
                <strong className="block text-gray-950">{line.name}</strong>
                <span className="text-xs font-bold text-gray-500">{line.rg}</span>
              </button>
            ))}
          </div>
          <label className="mt-5 block">
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Produto</span>
            <select className="min-h-12 w-full border border-gray-300 bg-white px-3 font-bold" value={product} onChange={(event) => { setProduct(event.target.value); setMessage(""); }}>
              {catalog[lineId].products.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </aside>

        <main className="border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
            <div>
              <span className="text-xs font-bold uppercase text-cicopal-blue">{catalog[lineId].rg} · {catalog[lineId].name}</span>
              <h3 className="text-2xl font-black text-gray-950">{product}</h3>
            </div>
            <span className="bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600">{configuredCount}/{parameters.length} configurados</span>
          </div>

          <div className="grid gap-3 border-b border-gray-200 bg-[#f7f8fc] p-4 sm:grid-cols-2 xl:grid-cols-4">
            <Legend color="bg-green-600" title="Verde" text="Dentro da faixa ideal" />
            <Legend color="bg-amber-400" title="Amarelo" text="Atenção, próximo do limite" />
            <Legend color="bg-red-600" title="Vermelho" text="Fora do limite permitido" />
            <Legend color="bg-gray-400" title="Cinza" text="Não se aplica (NA)" />
          </div>

          <div className="space-y-3 p-4">
            {parameters.map((parameter, index) => (
              <article key={parameter.id} className="border border-gray-200 bg-white p-5 shadow-[0_8px_30px_rgba(20,28,70,.06)] transition hover:border-blue-200">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center bg-blue-50 text-cicopal-blue"><CircleGauge size={21} /></span>
                    <div>
                      <input aria-label="Nome do parâmetro" className="w-full border-0 p-0 text-lg font-black text-gray-950 outline-none" value={parameter.name} onChange={(event) => updateParameters(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                      <span className="text-xs font-bold uppercase text-gray-400">Parâmetro {index + 1}</span>
                    </div>
                  </div>
                  <button type="button" aria-label="Excluir parâmetro" className="p-2 text-gray-400 hover:text-cicopal-red" onClick={() => updateParameters(parameters.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={19} /></button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <Field label="Unidade" value={parameter.unit} onChange={(unit) => updateParameters(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, unit } : item))} text />
                  <Field label="Vermelho abaixo de" tone="red" value={parameter.criticalMin} onChange={(criticalMin) => updateParameters(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, criticalMin } : item))} />
                  <Field label="Amarelo mínimo" tone="yellow" value={parameter.idealMin} onChange={(idealMin) => updateParameters(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, idealMin } : item))} />
                  <Field label="Amarelo máximo" tone="yellow" value={parameter.idealMax} onChange={(idealMax) => updateParameters(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, idealMax } : item))} />
                  <Field label="Vermelho acima de" tone="red" value={parameter.criticalMax} onChange={(criticalMax) => updateParameters(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, criticalMax } : item))} />
                </div>
                <div className="mt-4 grid grid-cols-5 overflow-hidden text-center text-[10px] font-black uppercase sm:text-xs">
                  <span className="bg-red-600 px-2 py-2 text-white">Vermelho</span>
                  <span className="bg-amber-400 px-2 py-2 text-amber-950">Amarelo</span>
                  <span className="bg-green-600 px-2 py-2 text-white">Verde</span>
                  <span className="bg-amber-400 px-2 py-2 text-amber-950">Amarelo</span>
                  <span className="bg-red-600 px-2 py-2 text-white">Vermelho</span>
                </div>
                <div className="grid grid-cols-4 text-center text-xs font-bold text-gray-500">
                  <span>{parameter.criticalMin || "mín."}</span><span>{parameter.idealMin || "ideal mín."}</span><span>{parameter.idealMax || "ideal máx."}</span><span>{parameter.criticalMax || "máx."}</span>
                </div>
                <label className="mt-3 inline-flex min-h-11 items-center gap-2 border border-gray-200 bg-gray-50 px-3 font-bold text-gray-700">
                  <input type="checkbox" className="size-5" checked={parameter.allowNa} onChange={(event) => updateParameters(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, allowNa: event.target.checked } : item))} />
                  Permitir resposta NA <span className="ml-1 bg-gray-300 px-2 py-0.5 text-xs">CINZA</span>
                </label>
              </article>
            ))}
            <button type="button" onClick={() => updateParameters([...parameters, makeParameter(["Novo parâmetro", ""], parameters.length)])} className="inline-flex min-h-12 w-full items-center justify-center gap-2 border-2 border-dashed border-gray-300 font-bold text-cicopal-blue hover:border-cicopal-blue">
              <Plus size={19} /> Adicionar parâmetro ao produto
            </button>
          </div>
          {message ? <div className={`mx-4 mb-4 border p-3 font-bold ${message.startsWith("Especificações") ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><Check className="mr-2 inline" size={18} />{message}</div> : null}
        </main>
      </div>
    </section>
  );
}

function Legend({ color, title, text }) {
  return <div className="flex items-center gap-3"><span className={`size-4 shrink-0 ${color}`} /><span><strong className="block text-sm text-gray-900">{title}</strong><small className="font-semibold text-gray-500">{text}</small></span></div>;
}

function Field({ label, value, onChange, tone = "gray", text = false }) {
  const colors = { red: "border-red-300 bg-red-50", yellow: "border-amber-300 bg-amber-50", green: "border-green-300 bg-green-50", gray: "border-gray-300 bg-white" };
  return <label><span className="mb-1 block text-xs font-bold uppercase text-gray-500">{label}</span><input type={text ? "text" : "number"} step="any" className={`min-h-12 w-full border px-3 text-base font-bold outline-none focus:border-cicopal-blue ${colors[tone]}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="—" /></label>;
}
