"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Clock3, Radio } from "lucide-react";

const plantLines = [
  {
    id: "PUR", name: "Pururuca", short: "PUR", product: "Pururuca Original 90g", status: "running", x: 120, y: 125, w: 235, h: 145,
    operator: "Carlos Mendes", shift: "A", completion: 92, ncs: 0, lastOffset: 3, sourceRg: "RG.QUA.005",
    controls: [{ label: "Temperatura do óleo", value: "178 °C", ok: true }, { label: "Peso médio", value: "90,4 g", ok: true }, { label: "Selagem", value: "Conforme", ok: true }],
    recentRecords: [{ time: "10:00", process: "Liberação do produto", result: "Conforme" }, { time: "09:00", process: "Avaliação do produto", result: "Conforme" }],
    lastPhoto: { time: "10:03", operator: "Carlos Mendes", label: "Fritador e saída da linha" }
  },
  {
    id: "SAL", name: "Salgadinho", short: "SAL", product: "MIC Queijo 45g", status: "warning", x: 410, y: 125, w: 260, h: 145,
    operator: "Marina Souza", shift: "A", completion: 78, ncs: 2, lastOffset: 8, sourceRg: "RG.QUA.BA.004",
    controls: [{ label: "Umidade", value: "2,8%", ok: true }, { label: "Peso médio", value: "43,9 g", ok: false }, { label: "Sabor e odor", value: "Conforme", ok: true }],
    recentRecords: [{ time: "10:00", process: "Liberação do produto", result: "NC em peso" }, { time: "09:00", process: "Parâmetros Clextral", result: "Conforme" }],
    lastPhoto: { time: "10:08", operator: "Marina Souza", label: "Tumbler e produto na esteira" },
    ncDetails: [{ code: "NC-0241", item: "Peso médio", value: "43,9 g", action: "Ajustar dosador", status: "Em tratamento" }, { code: "NC-0240", item: "Selagem máquina 03", value: "NC", action: "Regular temperatura", status: "Aguardando validação" }]
  },
  {
    id: "ROS", name: "Rosca", short: "ROS", product: "Rosca Coco 400g", status: "stopped", x: 730, y: 125, w: 250, h: 145,
    operator: "João Ribeiro", shift: "A", completion: 61, ncs: 1, lastOffset: 16, sourceRg: "RG.QUA.BA.003",
    controls: [{ label: "Umidade final", value: "4,1%", ok: true }, { label: "Peso médio", value: "402 g", ok: true }, { label: "Forno zona 04", value: "Aguardando", ok: false }],
    recentRecords: [{ time: "08:00", process: "Avaliação do produto", result: "Conforme" }, { time: "07:00", process: "Higienização", result: "Conforme" }],
    lastPhoto: { time: "08:06", operator: "João Ribeiro", label: "Saída do forno" }
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
  const [selectedLineId, setSelectedLineId] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedLine = plantLines.find((line) => line.id === selectedLineId);
  const hoveredLine = plantLines.find((line) => line.id === hoveredLineId);
  const currentSlot = `${String(now.getHours()).padStart(2, "0")}:00–${String((now.getHours() + 1) % 24).padStart(2, "0")}:00`;

  return (
    <section className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-[24px] border border-gray-300 bg-[#e7e9ed] shadow-xl">
      <div className="absolute left-5 top-5 z-10 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
        <span className="grid size-10 place-items-center rounded-xl bg-cicopal-blue text-white"><Radio size={20} /></span>
        <div><p className="text-xs font-bold uppercase tracking-wider text-gray-400">Planta Cicopal • ao vivo</p><p className="font-black tabular-nums text-gray-950">{formatTime(now)} <span className="ml-2 text-xs font-semibold text-gray-500">{currentSlot}</span></p></div>
      </div>
      <div className="absolute right-5 top-5 z-10 hidden rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-bold text-gray-600 shadow-lg backdrop-blur sm:block">Passe o mouse • clique para detalhes</div>
      <div className="relative min-h-[calc(100vh-112px)] overflow-x-auto p-2 pt-20 md:p-5 md:pt-20">
          <div className="relative mx-auto min-w-[820px] overflow-hidden rounded-2xl shadow-2xl">
            <img src="/images/fabrica-isometrica-cicopal.png" alt="Ilustração isométrica da fábrica Cicopal com três linhas de produção" className="block h-auto w-full" />
            {plantLines.map((line, index) => {
              const areas = [
                { left: "17%", top: "7%", width: "69%", height: "26%" },
                { left: "13%", top: "31%", width: "73%", height: "27%" },
                { left: "16%", top: "57%", width: "70%", height: "27%" }
              ];
              const area = areas[index];
              const activeArea = selectedLineId === line.id || hoveredLineId === line.id;
              return <button key={line.id} type="button" aria-label={`Linha ${line.name}, ${statusMeta[line.status].label}`} className={`absolute rounded-[28px] border-2 transition-all ${activeArea ? "border-white/90 bg-white/10 shadow-[0_0_0_4px_rgba(30,34,168,.45)]" : "border-transparent bg-transparent"} ${line.status === "stopped" ? "factory-inactive-hotspot" : ""}`} style={area} onMouseEnter={() => setHoveredLineId(line.id)} onMouseLeave={() => setHoveredLineId("")} onFocus={() => setHoveredLineId(line.id)} onBlur={() => setHoveredLineId("")} onClick={() => setSelectedLineId(line.id)}>{activeArea ? <><span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-black shadow-lg ${line.status === "stopped" ? "bg-gray-600 text-white" : "bg-white text-cicopal-blue"}`}>{line.name} • {statusMeta[line.status].label}</span>{line.ncs ? <span className="absolute right-3 top-3 rounded-full bg-cicopal-red px-2.5 py-1.5 text-xs font-black text-white shadow-lg">{line.ncs} NC</span> : null}</> : null}</button>;
            })}
          </div>
          {hoveredLine ? (
            <div className="pointer-events-none absolute right-6 top-24 z-20 hidden w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur md:block">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase text-cicopal-blue">{hoveredLine.sourceRg}</p><h3 className="text-lg font-black text-gray-950">Linha {hoveredLine.name}</h3><p className="text-xs font-semibold text-gray-500">{hoveredLine.status === "stopped" ? "Sem produção ativa" : hoveredLine.product}</p></div><span className="rounded-full px-2 py-1 text-xs font-bold" style={{ color: statusMeta[hoveredLine.status].color, background: statusMeta[hoveredLine.status].fill }}>{statusMeta[hoveredLine.status].label}</span></div>
              {hoveredLine.ncs ? <div className="mt-3 flex items-center gap-3 rounded-xl bg-cicopal-red p-3 text-white"><AlertTriangle size={23} /><div><p className="text-lg font-black">{hoveredLine.ncs} NCs abertas</p><p className="text-xs font-semibold text-white/80">Requer acompanhamento da supervisão</p></div></div> : <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-bold text-cicopal-green"><CheckCircle2 size={19} /> Nenhuma NC aberta</div>}
              <div className="mt-3"><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Últimos registros</p>{hoveredLine.recentRecords.slice(0, 2).map((record) => <div key={`${record.time}-${record.process}`} className="flex items-center justify-between border-t border-gray-100 py-2 text-xs"><span><strong className="mr-2 text-gray-900">{record.time}</strong><span className="font-semibold text-gray-600">{record.process}</span></span><span className={record.result.includes("NC") ? "font-bold text-cicopal-red" : "font-bold text-cicopal-green"}>{record.result}</span></div>)}</div>
              <p className="mt-2 text-xs font-bold text-cicopal-blue">Clique para abrir histórico, NCs e foto →</p>
            </div>
          ) : null}
          {selectedLine ? (
            <aside className="absolute bottom-6 left-6 z-20 max-h-[78%] w-[min(540px,calc(100%-3rem))] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-cicopal-blue">{selectedLine.sourceRg} • linha selecionada</p><h2 className="mt-1 text-xl font-black text-gray-950">{selectedLine.name}</h2><p className="text-sm font-semibold text-gray-500">{selectedLine.status === "stopped" ? "Sem produto ativo no horário" : selectedLine.product}</p></div><button type="button" className="min-h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600" onClick={() => setSelectedLineId("")}>Fechar</button></div>
              {selectedLine.status !== "stopped" ? <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]"><div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-gray-50 p-2"><p className="text-[9px] font-bold uppercase text-gray-400">Atualizado</p><p className="text-sm font-black">{lastUpdate(now, selectedLine.lastOffset)}</p></div><div className="rounded-lg bg-gray-50 p-2"><p className="text-[9px] font-bold uppercase text-gray-400">Preenchido</p><p className="text-sm font-black">{selectedLine.completion}%</p></div><div className={`rounded-lg p-2 ${selectedLine.ncs ? "bg-red-50" : "bg-green-50"}`}><p className="text-[9px] font-bold uppercase text-gray-400">NCs</p><p className={`text-sm font-black ${selectedLine.ncs ? "text-cicopal-red" : "text-cicopal-green"}`}>{selectedLine.ncs}</p></div></div><p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Registros recentes</p>{selectedLine.recentRecords.map((record) => <div key={`${record.time}-${record.process}`} className="flex items-center justify-between border-t border-gray-100 py-2 text-xs"><span className="flex items-center gap-2"><Clock3 size={14} className="text-gray-400" /><strong>{record.time}</strong><span className="font-semibold text-gray-600">{record.process}</span></span><span className={record.result.includes("NC") ? "font-bold text-cicopal-red" : "font-bold text-cicopal-green"}>{record.result}</span></div>)}</div><div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100"><div className="relative h-28 overflow-hidden"><img src="/images/fabrica-isometrica-cicopal.png" alt={`Último registro fotográfico da linha ${selectedLine.name}`} className="h-full w-full object-cover" /><span className="absolute inset-0 bg-black/10" /><span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold text-white">DEMONSTRAÇÃO</span></div><div className="p-2"><p className="flex items-center gap-1.5 text-xs font-bold text-gray-900"><Camera size={14} /> Última foto • {selectedLine.lastPhoto.time}</p><p className="mt-1 text-[10px] font-semibold text-gray-500">{selectedLine.lastPhoto.label}</p></div></div></div> : null}
              {selectedLine.ncDetails?.length ? <div className="mt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-cicopal-red">Não conformidades em aberto</p>{selectedLine.ncDetails.map((nc) => <div key={nc.code} className="mb-2 rounded-xl border border-red-100 bg-red-50 p-3"><div className="flex justify-between gap-3"><strong className="text-sm text-cicopal-red">{nc.code} • {nc.item}</strong><span className="text-[10px] font-bold text-red-700">{nc.status}</span></div><p className="mt-1 text-xs font-semibold text-red-900">Valor: {nc.value} • Ação: {nc.action}</p></div>)}</div> : null}
            </aside>
          ) : null}
      </div>
    </section>
  );
}
