"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FileText, Gauge, Radio, Users } from "lucide-react";

const plantLines = [
  {
    id: "PUR", name: "Pururuca", short: "PUR", product: "Pururuca Original 90g", status: "running", x: 120, y: 125, w: 235, h: 145,
    operator: "Carlos Mendes", shift: "A", completion: 92, ncs: 0, lastOffset: 3, sourceRg: "RG.QUA.005",
    controls: [{ label: "Temperatura do óleo", value: "178 °C", ok: true }, { label: "Peso médio", value: "90,4 g", ok: true }, { label: "Selagem", value: "Conforme", ok: true }]
  },
  {
    id: "SAL", name: "Salgadinho", short: "SAL", product: "MIC Queijo 45g", status: "warning", x: 410, y: 125, w: 260, h: 145,
    operator: "Marina Souza", shift: "A", completion: 78, ncs: 2, lastOffset: 8, sourceRg: "RG.QUA.BA.004",
    controls: [{ label: "Umidade", value: "2,8%", ok: true }, { label: "Peso médio", value: "43,9 g", ok: false }, { label: "Sabor e odor", value: "Conforme", ok: true }]
  },
  {
    id: "ROS", name: "Rosca", short: "ROS", product: "Rosca Coco 400g", status: "stopped", x: 730, y: 125, w: 250, h: 145,
    operator: "João Ribeiro", shift: "A", completion: 61, ncs: 1, lastOffset: 16, sourceRg: "RG.QUA.BA.003",
    controls: [{ label: "Umidade final", value: "4,1%", ok: true }, { label: "Peso médio", value: "402 g", ok: true }, { label: "Forno zona 04", value: "Aguardando", ok: false }]
  }
];

const statusMeta = {
  running: { label: "Produzindo", color: "#198754", fill: "#eaf8f0", stroke: "#70c993" },
  warning: { label: "Atenção", color: "#b77900", fill: "#fff8df", stroke: "#efc75e" },
  stopped: { label: "Parada", color: "#e30613", fill: "#fff0f1", stroke: "#ef8d94" }
};

function formatTime(date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function lastUpdate(now, minutes) {
  return new Date(now.getTime() - minutes * 60_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function PlantLine({ line, active, hovered, onHover, onSelect, now }) {
  const meta = statusMeta[line.status];
  return (
    <g role="button" tabIndex="0" aria-label={`Linha ${line.name}, ${meta.label}`} className="cursor-pointer outline-none" onMouseEnter={() => onHover(line.id)} onMouseLeave={() => onHover("")} onFocus={() => onHover(line.id)} onBlur={() => onHover("")} onClick={() => onSelect(line.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(line.id); }}>
      <rect x={line.x} y={line.y} width={line.w} height={line.h} rx="18" fill={active ? "#f5f6ff" : "#ffffff"} stroke={active ? "#1e22a8" : hovered ? meta.stroke : "#dfe3ec"} strokeWidth={active ? "4" : hovered ? "3" : "2"} className="transition-all" />
      <rect x={line.x + 14} y={line.y + 14} width="46" height="46" rx="13" fill="#1e22a8" />
      <text x={line.x + 37} y={line.y + 43} textAnchor="middle" fill="white" fontSize="13" fontWeight="800">{line.short}</text>
      <text x={line.x + 72} y={line.y + 34} fill="#202532" fontSize="18" fontWeight="800">{line.name}</text>
      <text x={line.x + 72} y={line.y + 54} fill="#73798a" fontSize="11" fontWeight="600">{line.product}</text>
      <rect x={line.x + 14} y={line.y + 77} width={line.w - 28} height="34" rx="10" fill={meta.fill} />
      <circle cx={line.x + 31} cy={line.y + 94} r="5" fill={meta.color} className={line.status === "running" ? "factory-pulse" : ""} />
      <text x={line.x + 44} y={line.y + 99} fill={meta.color} fontSize="12" fontWeight="800">{meta.label}</text>
      <text x={line.x + line.w - 20} y={line.y + 99} textAnchor="end" fill="#555c6c" fontSize="11" fontWeight="700">Atualizado {lastUpdate(now, line.lastOffset)}</text>
      <rect x={line.x + 14} y={line.y + 124} width={line.w - 28} height="7" rx="4" fill="#e8eaf0" />
      <rect x={line.x + 14} y={line.y + 124} width={(line.w - 28) * line.completion / 100} height="7" rx="4" fill={meta.color} />
      <text x={line.x + 14} y={line.y + 143} fill="#73798a" fontSize="10" fontWeight="700">{line.completion}% do horário preenchido</text>
    </g>
  );
}

export function FactorySupervision() {
  const [now, setNow] = useState(() => new Date());
  const [hoveredLineId, setHoveredLineId] = useState("");
  const [selectedLineId, setSelectedLineId] = useState("SAL");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedLine = plantLines.find((line) => line.id === selectedLineId) ?? plantLines[0];
  const hoveredLine = plantLines.find((line) => line.id === hoveredLineId);
  const currentSlot = `${String(now.getHours()).padStart(2, "0")}:00–${String((now.getHours() + 1) % 24).padStart(2, "0")}:00`;
  const activeLines = useMemo(() => plantLines.filter((line) => line.status !== "stopped"), []);
  const totalNcs = useMemo(() => activeLines.reduce((total, line) => total + line.ncs, 0), [activeLines]);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="modern-panel flex items-center gap-3 p-4"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-cicopal-blue"><Clock3 size={22} /></span><div><p className="text-xs font-bold uppercase text-gray-400">Agora</p><p className="text-xl font-black tabular-nums text-gray-950">{formatTime(now)}</p><p className="text-xs font-semibold text-gray-500">{now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p></div></div>
        <div className="modern-panel flex items-center gap-3 p-4"><span className="grid size-11 place-items-center rounded-xl bg-green-50 text-cicopal-green"><Radio size={22} /></span><div><p className="text-xs font-bold uppercase text-gray-400">Linhas com registro hoje</p><p className="text-xl font-black text-gray-950">{activeLines.length}</p><p className="text-xs font-semibold text-cicopal-green">Com preenchimento ativo</p></div></div>
        <div className="modern-panel flex items-center gap-3 p-4"><span className="grid size-11 place-items-center rounded-xl bg-yellow-50 text-yellow-700"><Gauge size={22} /></span><div><p className="text-xs font-bold uppercase text-gray-400">Janela atual</p><p className="text-xl font-black text-gray-950">{currentSlot}</p><p className="text-xs font-semibold text-gray-500">77% preenchido em média</p></div></div>
        <div className="modern-panel flex items-center gap-3 p-4"><span className="grid size-11 place-items-center rounded-xl bg-red-50 text-cicopal-red"><AlertTriangle size={22} /></span><div><p className="text-xs font-bold uppercase text-gray-400">NCs abertas hoje</p><p className="text-xl font-black text-gray-950">{totalNcs}</p><p className="text-xs font-semibold text-cicopal-red">2 aguardam tratamento</p></div></div>
      </section>

      <section className="modern-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-cicopal-red">Mapa operacional</p><h2 className="mt-1 text-xl font-black text-gray-950">Planta industrial — Unidade Cicopal</h2><p className="text-sm font-semibold text-gray-500">Passe o mouse para consultar • clique para abrir a linha</p></div><div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-xs font-bold text-cicopal-green"><span className="size-2 rounded-full bg-cicopal-green factory-pulse" /> Atualização em tempo real</div></div>
        <div className="relative overflow-x-auto bg-[#f0f2f6] p-3 md:p-5">
          <svg viewBox="0 0 1100 350" className="min-w-[780px] w-full" aria-label="Mapa interativo das linhas ativas da fábrica">
            <defs><pattern id="floor-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#dfe2e9" strokeWidth="1" /></pattern><marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#aeb4c1" /></marker></defs>
            <rect x="20" y="20" width="1060" height="300" rx="28" fill="url(#floor-grid)" stroke="#cfd3dc" strokeWidth="2" />
            <rect x="55" y="55" width="990" height="55" rx="14" fill="#ffffff" stroke="#dfe3ec" />
            <text x="80" y="88" fill="#4f5666" fontSize="15" fontWeight="800">LINHAS COM PREENCHIMENTO ATIVO HOJE</text><text x="1015" y="88" textAnchor="end" fill="#89909f" fontSize="11" fontWeight="700">DADOS ORIGINADOS NOS REGISTROS RG</text>
            {activeLines.map((line, index) => <PlantLine key={line.id} line={{ ...line, x: index === 0 ? 230 : 615, w: 270 }} active={selectedLineId === line.id} hovered={hoveredLineId === line.id} onHover={setHoveredLineId} onSelect={setSelectedLineId} now={now} />)}
          </svg>
          {hoveredLine ? <div className="pointer-events-none absolute right-6 top-6 z-10 hidden w-72 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur md:block"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase text-cicopal-blue">{hoveredLine.id}</p><h3 className="text-lg font-black text-gray-950">Linha {hoveredLine.name}</h3></div><span className="rounded-full px-2 py-1 text-xs font-bold" style={{ color: statusMeta[hoveredLine.status].color, background: statusMeta[hoveredLine.status].fill }}>{statusMeta[hoveredLine.status].label}</span></div><p className="mt-2 text-sm font-semibold text-gray-600">{hoveredLine.product}</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-gray-50 p-2"><p className="text-[10px] font-bold uppercase text-gray-400">Último horário</p><p className="font-black text-gray-900">{lastUpdate(now, hoveredLine.lastOffset)}</p></div><div className="rounded-lg bg-gray-50 p-2"><p className="text-[10px] font-bold uppercase text-gray-400">NCs abertas</p><p className={`font-black ${hoveredLine.ncs ? "text-cicopal-red" : "text-cicopal-green"}`}>{hoveredLine.ncs}</p></div></div><p className="mt-3 text-xs font-bold text-cicopal-blue">Clique para ver detalhes →</p></div> : null}
        </div>
      </section>

      <section className="modern-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-cicopal-blue">{selectedLine.id} • Detalhes da linha</p><h2 className="mt-1 text-xl font-black text-gray-950">{selectedLine.name} — {selectedLine.product}</h2></div><span className="rounded-full px-3 py-2 text-xs font-bold" style={{ color: statusMeta[selectedLine.status].color, background: statusMeta[selectedLine.status].fill }}>{statusMeta[selectedLine.status].label}</span></div>
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_1.4fr]">
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-gray-50 p-4"><Users size={19} className="text-cicopal-blue" /><p className="mt-3 text-xs font-bold uppercase text-gray-400">Operador / turno</p><p className="mt-1 font-black text-gray-900">{selectedLine.operator}</p><p className="text-xs font-semibold text-gray-500">Turno {selectedLine.shift}</p></div><div className="rounded-xl bg-gray-50 p-4"><FileText size={19} className="text-cicopal-blue" /><p className="mt-3 text-xs font-bold uppercase text-gray-400">Origem da informação</p><p className="mt-1 font-black text-gray-900">{selectedLine.sourceRg}</p><p className="text-xs font-semibold text-gray-500">Último registro da linha</p></div><div className="rounded-xl bg-gray-50 p-4 sm:col-span-2"><div className="flex justify-between text-xs font-bold"><span>Preenchimento do horário</span><span>{selectedLine.completion}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full" style={{ width: `${selectedLine.completion}%`, background: statusMeta[selectedLine.status].color }} /></div><p className="mt-2 text-xs font-semibold text-gray-500">Último envio às {lastUpdate(now, selectedLine.lastOffset)} • produto informado em {selectedLine.sourceRg}</p></div></div>
          <div><h3 className="mb-3 font-black text-gray-950">Últimos controles preenchidos</h3><div className="space-y-2">{selectedLine.controls.map((control) => <div key={control.label} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"><span className="flex items-center gap-3">{control.ok ? <CheckCircle2 size={20} className="text-cicopal-green" /> : <AlertTriangle size={20} className="text-cicopal-red" />}<span><span className="block text-sm font-bold text-gray-900">{control.label}</span><span className="text-xs font-semibold text-gray-500">Horário {currentSlot}</span></span></span><strong className={control.ok ? "text-gray-900" : "text-cicopal-red"}>{control.value}</strong></div>)}</div>{selectedLine.ncs ? <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3"><p className="font-black text-cicopal-red">{selectedLine.ncs} não conformidade(s) aberta(s)</p><p className="mt-1 text-xs font-semibold text-red-800">Clique no registro operacional para consultar causa, ação e responsável.</p></div> : null}</div>
        </div>
      </section>
    </div>
  );
}
