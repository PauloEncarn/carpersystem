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
  stopped: { label: "Inativa", color: "#73798a", fill: "#eef0f3", stroke: "#aeb4bf" }
};

function formatTime(date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function lastUpdate(now, minutes) {
  return new Date(now.getTime() - minutes * 60_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function PlantLine({ line, active, hovered, onHover, onSelect, now }) {
  const meta = statusMeta[line.status];
  const inactive = line.status === "stopped";
  const machines = line.id === "PUR" ? ["Silo", "Fritador", "Aroma", "Envase"] : line.id === "SAL" ? ["Extrusora", "Forno", "Tumbler", "Envase"] : ["Masseira", "Corte", "Forno", "Envase"];
  return (
    <g role="button" tabIndex="0" aria-label={`Linha ${line.name}, ${meta.label}`} className="cursor-pointer outline-none" onMouseEnter={() => onHover(line.id)} onMouseLeave={() => onHover("")} onFocus={() => onHover(line.id)} onBlur={() => onHover("")} onClick={() => onSelect(line.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(line.id); }}>
      <rect x={line.x} y={line.y} width={line.w} height={line.h} rx="12" fill={inactive ? "#e4e6ea" : active ? "#f5f6ff" : "#ffffff"} stroke={active ? "#1e22a8" : hovered ? meta.stroke : inactive ? "#aeb3bd" : "#d6dae3"} strokeWidth={active ? "4" : hovered ? "3" : "2"} />
      <rect x={line.x + 12} y={line.y + 12} width="105" height={line.h - 24} rx="9" fill={inactive ? "#c9cdd4" : "#1e22a8"} />
      <text x={line.x + 64} y={line.y + 38} textAnchor="middle" fill="white" fontSize="12" fontWeight="800">LINHA {line.short}</text>
      <text x={line.x + 64} y={line.y + 60} textAnchor="middle" fill="white" fontSize="16" fontWeight="800">{line.name}</text>
      <circle cx={line.x + 34} cy={line.y + 78} r="5" fill={inactive ? "#73798a" : meta.color} className={line.status === "running" ? "factory-pulse" : ""} />
      <text x={line.x + 47} y={line.y + 82} fill="white" fontSize="10" fontWeight="700">{meta.label}</text>
      <line x1={line.x + 142} y1={line.y + line.h / 2} x2={line.x + line.w - 32} y2={line.y + line.h / 2} stroke={inactive ? "#a8adb6" : "#8f96a5"} strokeWidth="8" strokeLinecap="round" />
      {machines.map((machine, index) => {
        const machineX = line.x + 150 + index * ((line.w - 210) / 3);
        return <g key={machine}><rect x={machineX - 29} y={line.y + 19} width="58" height="46" rx="7" fill={inactive ? "#bfc3ca" : "#ffffff"} stroke={inactive ? "#9fa4ad" : "#b9bec9"} strokeWidth="2" /><circle cx={machineX} cy={line.y + 42} r="10" fill="none" stroke={inactive ? "#858b96" : meta.color} strokeWidth="4" /><text x={machineX} y={line.y + 86} textAnchor="middle" fill={inactive ? "#747984" : "#454c5b"} fontSize="9" fontWeight="700">{machine}</text></g>;
      })}
      <text x={line.x + 142} y={line.y + line.h - 12} fill={inactive ? "#777c86" : "#555c6c"} fontSize="10" fontWeight="700">{inactive ? "Sem registro ativo no horário" : `${line.product} • atualizado ${lastUpdate(now, line.lastOffset)}`}</text>
      {!inactive ? <><rect x={line.x + line.w - 115} y={line.y + line.h - 24} width="92" height="8" rx="4" fill="#dde0e7" /><rect x={line.x + line.w - 115} y={line.y + line.h - 24} width={92 * line.completion / 100} height="8" rx="4" fill={meta.color} /></> : null}
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
          <svg viewBox="0 0 1100 590" className="min-w-[820px] w-full" aria-label="Representação gráfica das linhas da fábrica">
            <defs><pattern id="floor-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#dfe2e9" strokeWidth="1" /></pattern><marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#aeb4c1" /></marker></defs>
            <rect x="20" y="20" width="1060" height="550" rx="28" fill="url(#floor-grid)" stroke="#cfd3dc" strokeWidth="2" />
            <rect x="55" y="55" width="990" height="55" rx="14" fill="#ffffff" stroke="#dfe3ec" />
            <text x="80" y="88" fill="#4f5666" fontSize="15" fontWeight="800">ÁREA DE PRODUÇÃO</text><text x="1015" y="88" textAnchor="end" fill="#89909f" fontSize="11" fontWeight="700">DADOS ORIGINADOS NOS REGISTROS RG</text>
            <rect x="55" y="125" width="50" height="325" rx="10" fill="#d9dde4" stroke="#bdc2cc" /><text x="80" y="288" textAnchor="middle" fill="#656b77" fontSize="10" fontWeight="800" transform="rotate(-90 80 288)">PREPARO E ABASTECIMENTO</text>
            {plantLines.map((line, index) => <PlantLine key={line.id} line={{ ...line, x: 125, y: 125 + index * 110, w: 855, h: 95 }} active={selectedLineId === line.id} hovered={hoveredLineId === line.id} onHover={setHoveredLineId} onSelect={setSelectedLineId} now={now} />)}
            <rect x="995" y="125" width="50" height="325" rx="10" fill="#d9dde4" stroke="#bdc2cc" /><text x="1020" y="288" textAnchor="middle" fill="#656b77" fontSize="10" fontWeight="800" transform="rotate(90 1020 288)">SAÍDA DAS LINHAS</text>
            <rect x="125" y="470" width="265" height="65" rx="12" fill="#fff" stroke="#cdd1da" /><text x="145" y="497" fill="#555c6c" fontSize="11" fontWeight="800">SALA DA QUALIDADE</text><text x="145" y="517" fill="#8a909d" fontSize="10" fontWeight="600">Análises e liberações</text>
            <rect x="410" y="470" width="265" height="65" rx="12" fill="#fff" stroke="#cdd1da" /><text x="430" y="497" fill="#555c6c" fontSize="11" fontWeight="800">CORREDOR TÉCNICO</text><text x="430" y="517" fill="#8a909d" fontSize="10" fontWeight="600">Acesso aos equipamentos</text>
            <rect x="695" y="470" width="285" height="65" rx="12" fill="#fff" stroke="#cdd1da" /><text x="715" y="497" fill="#555c6c" fontSize="11" fontWeight="800">UTILIDADES</text><text x="715" y="517" fill="#8a909d" fontSize="10" fontWeight="600">Ar, água, gás e energia</text>
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
