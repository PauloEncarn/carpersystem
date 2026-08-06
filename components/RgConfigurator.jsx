"use client";

import { useMemo, useState } from "react";
import {
  Camera,
  CheckSquare,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Factory,
  FileSignature,
  FileText,
  GripVertical,
  Layers3,
  LayoutTemplate,
  Plus,
  Settings2,
  Trash2
} from "lucide-react";
import { checklistGroups } from "@/lib/checklist";
import { GuidedRgBuilder } from "@/components/GuidedRgBuilder";

const steps = [
  { id: "rg", label: "RG", icon: FileText },
  { id: "processo", label: "Processo", icon: ClipboardList },
  { id: "componente", label: "Indice", icon: Layers3 },
  { id: "nao_conformidade", label: "Nao Conformidade", icon: AlertTriangle }
];

const processTypes = [
  { id: "higienizacao", label: "Higienizacao", prefix: "HIG" },
  { id: "produto_liberacao", label: "Liberacao do Produto", prefix: "LIBP" },
  { id: "produto_avaliacao", label: "Avaliacao do Produto", prefix: "AVP" },
  { id: "processo", label: "RG - Processo", prefix: "RGP" },
  { id: "fotografico", label: "Registro Fotografico", prefix: "REGF" },
  { id: "batelada_milho", label: "Controle de Batelada", prefix: "BAT" }
];

const fieldTypes = [
  { id: "titulo", label: "Titulo visual" },
  { id: "instrucao", label: "Texto de orientacao" },
  { id: "separador", label: "Separador visual" },
  { id: "c_nc", label: "C / NC" },
  { id: "numero", label: "Numero" },
  { id: "percentual", label: "%" },
  { id: "temperatura", label: "deg C" },
  { id: "texto", label: "Texto" },
  { id: "data", label: "Data" },
  { id: "hora", label: "Hora" },
  { id: "grupo", label: "Grupo" },
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

const defaultValueModes = [
  { id: "manual", label: "Manual" },
  { id: "tag", label: "Tag automatica" },
  { id: "lista", label: "Lista de valores" }
];

const defaultTags = [
  { id: "nome_usuario_logado", label: "<nome_usuario_logado>" },
  { id: "turno_usuario_logado", label: "<turno_usuario_logado>" },
  { id: "data_atual", label: "<data_atual>" },
  { id: "hora_atual", label: "<hora_atual>" },
  { id: "data_hora_atual", label: "<data_hora_atual>" },
  { id: "linha_selecionada", label: "<linha_selecionada>" },
  { id: "codigo_rg", label: "<codigo_rg>" }
];

const initialValueLists = [
  { id: "gramatura_salgadinho", label: "gramatura_salgadinho", values: ["35g", "45g", "90g", "140g"] },
  { id: "sabor_pururuca", label: "sabor_pururuca", values: ["Original", "Bacon", "Cebola", "Churrasco"] },
  { id: "disposicao_imediata", label: "disposicao_imediata", values: ["Bloqueado", "Descarte"] },
  { id: "marca_extrusados", label: "marca_extrusados", values: ["MIC", "MIK", "ANE"] },
  { id: "formato_clextral", label: "formato_clextral", values: ["CX", "ZZ", "ANE", "CON"] },
  { id: "sabor_extrusados", label: "sabor_extrusados", values: ["QJ", "RQ", "CB", "PZ", "PR", "CM", "GL", "CR"] }
];

const lineRuleDefaults = {
  yellowBelow: "50",
  greenMin: "60",
  greenMax: "70",
  redAbove: "70"
};

const initialNcTypes = [
  { id: "nc-salgadinho", name: "NC Salgadinho", section: "Nao conformidades", indexIds: [] },
  { id: "nc-higienizacao", name: "NC Higienizacao", section: "Detalhamento da NC", indexIds: [] },
  { id: "nc-extrusora-clextral", name: "NC Extrusora Clextral", section: "Ocorrencias", indexIds: [] }
];

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

const clextralHourlyComponents = [
  { name: "Marca", type: "texto", section: "Produto por horario", defaultMode: "lista", valueList: "marca_extrusados" },
  { name: "Formato", type: "texto", section: "Produto por horario", defaultMode: "lista", valueList: "formato_clextral" },
  { name: "Sabor", type: "texto", section: "Produto por horario", defaultMode: "lista", valueList: "sabor_extrusados" },
  { name: "Dosagem farinha", type: "numero", section: "Parametros extrusora", unit: "Kg/h" },
  { name: "Dosagem agua", type: "numero", section: "Parametros extrusora", unit: "L/h" },
  { name: "Rotacao rosca", type: "numero", section: "Parametros extrusora", unit: "rpm" },
  { name: "Torque", type: "percentual", section: "Parametros extrusora" },
  { name: "Amps - BA", type: "numero", section: "Parametros extrusora", unit: "A" },
  { name: "Zona 1", type: "grupo", section: "Parametros extrusora", subfields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
  { name: "Zona 2", type: "grupo", section: "Parametros extrusora", subfields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
  { name: "Zona 3", type: "grupo", section: "Parametros extrusora", subfields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
  { name: "Fieira", type: "numero", section: "Parametros extrusora", unit: "BAR" },
  { name: "Bomba de oleo", type: "numero", section: "Parametros extrusora", unit: "Hz" },
  { name: "Refrigeracao", type: "temperatura", section: "Parametros extrusora" },
  { name: "Rotacao cortador", type: "numero", section: "Parametros extrusora", unit: "rpm" },
  { name: "Comp. / Diametro", type: "numero", section: "Dimensional", unit: "mm" },
  { name: "Larg. Sup. / Espes.", type: "numero", section: "Dimensional", unit: "mm" },
  { name: "Larg. Inferior", type: "numero", section: "Dimensional", unit: "mm" },
  { name: "Altura", type: "numero", section: "Dimensional", unit: "mm" },
  { name: "Temp. fieira", type: "temperatura", section: "Forno" },
  { name: "Temp. zona 1 forno", type: "grupo", section: "Forno", subfields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
  { name: "Temp. zona 2 forno", type: "grupo", section: "Forno", subfields: [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }] },
  { name: "Tempo residencia", type: "numero", section: "Forno", unit: "min" },
  { name: "Densidade", type: "numero", section: "Qualidade", unit: "g/L" },
  { name: "Umidade", type: "percentual", section: "Qualidade" },
  { name: "SME", type: "numero", section: "Qualidade", unit: "KW/Kg.hr" }
];

const clextralOccurrenceComponents = [
  makeField("clextral-occ-1", "Horario", "hora", "Ocorrencias", { nc: true, layout: "quarter", required: false }),
  makeField("clextral-occ-2", "Nao conformidade", "texto", "Ocorrencias", { nc: true, layout: "half", required: false }),
  makeField("clextral-occ-3", "Causa", "texto", "Ocorrencias", { nc: true, layout: "half", required: false }),
  makeField("clextral-occ-4", "Acao", "texto", "Ocorrencias", { nc: true, layout: "half", required: false }),
  makeField("clextral-occ-5", "Responsavel", "texto", "Ocorrencias", { nc: true, layout: "quarter", required: false })
];

const bateladaMilhoComponents = [
  makeField("bat-milho-1", "Data", "data", "Cabecalho", { nc: false, layout: "quarter" }),
  makeField("bat-milho-2", "Produto", "texto", "Cabecalho", { nc: false, layout: "quarter" }),
  makeField("bat-milho-3", "Supervisor", "assinatura", "Cabecalho", { nc: false, layout: "quarter" }),
  makeField("bat-milho-4", "Lote urucum", "texto", "Insumos", { nc: false, layout: "half" }),
  makeField("bat-milho-5", "Lote carbonato de calcio", "texto", "Insumos", { nc: false, layout: "half" }),
  makeField("bat-milho-6", "Numero da batelada", "numero", "Bateladas", { nc: false, layout: "quarter" }),
  makeField("bat-milho-7", "Horario", "hora", "Bateladas", { nc: false, layout: "quarter", defaultMode: "tag", defaultTag: "data_hora_atual" }),
  makeField("bat-milho-8", "Operador", "texto", "Bateladas", { nc: false, layout: "quarter", defaultMode: "tag", defaultTag: "nome_usuario_logado" }),
  makeField("bat-milho-9", "Quantidade", "numero", "Bateladas", { nc: false, layout: "quarter", unit: "kg" }),
  makeField("bat-milho-10", "Fornecedor", "texto", "Bateladas", { nc: false, layout: "third" }),
  makeField("bat-milho-11", "Lote", "texto", "Bateladas", { nc: false, layout: "third" }),
  makeField("bat-milho-12", "Validade", "data", "Bateladas", { nc: false, layout: "third" }),
  makeField("bat-milho-13", "Urucum", "numero", "Bateladas", { nc: false, layout: "quarter", unit: "kg" }),
  makeField("bat-milho-14", "Carbonato calcio", "numero", "Bateladas", { nc: false, layout: "quarter", unit: "kg" })
];

function makeField(id, name, type = "c_nc", section = "Geral", overrides = {}) {
  return {
    id,
    name,
    type,
    section,
    layout: type === "texto" || type === "foto" ? "half" : "third",
    required: true,
    nc: type === "c_nc",
    defaultMode: "manual",
    defaultTag: "",
    valueList: "",
    useLineRules: false,
    rulesByLine: {},
    subfields: [],
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

function buildClextralFields(processId) {
  const headerFields = [
    makeField(`${processId}-field-1`, "Data", "data", "Cabecalho", { nc: false, layout: "quarter" }),
    makeField(`${processId}-field-2`, "Operador TA", "texto", "Cabecalho", { nc: false, layout: "quarter" }),
    makeField(`${processId}-field-3`, "Operador TB", "texto", "Cabecalho", { nc: false, layout: "quarter" }),
    makeField(`${processId}-field-4`, "Operador TC", "texto", "Cabecalho", { nc: false, layout: "quarter" }),
    makeField(`${processId}-field-5`, "Supervisor TA", "assinatura", "Assinaturas", { nc: false, layout: "third" }),
    makeField(`${processId}-field-6`, "Supervisor TB", "assinatura", "Assinaturas", { nc: false, layout: "third" }),
    makeField(`${processId}-field-7`, "Supervisor TC", "assinatura", "Assinaturas", { nc: false, layout: "third" })
  ];

  const hourlyFields = clextralHourlyComponents.map((item, index) =>
    makeField(`${processId}-field-${index + 8}`, item.name, item.type, item.section, {
      nc: false,
      layout: "quarter",
      unit: item.unit ?? "",
      defaultMode: item.defaultMode ?? "manual",
      valueList: item.valueList ?? ""
    })
  );

  const occurrenceFields = clextralOccurrenceComponents.map((field, index) => ({
    ...field,
    id: `${processId}-field-${index + 8 + hourlyFields.length}`
  }));

  return [...headerFields, ...hourlyFields, ...occurrenceFields];
}

function buildBateladaMilhoFields(processId) {
  return bateladaMilhoComponents.map((field, index) => ({
    ...field,
    id: `${processId}-field-${index + 1}`
  }));
}

function defaultFieldsForProcess(type) {
  if (type === "higienizacao") {
    return [
      makeField("hig-context-1", "Operador logado", "texto", "Cabecalho", { nc: false }),
      makeField("hig-context-2", "Turno operador", "texto", "Cabecalho", { nc: false }),
      makeField("hig-context-3", "Tipo de setup", "texto", "Cabecalho", { nc: false }),
      makeField("hig-context-4", "Troca de sabor/produto de", "texto", "Cabecalho", { nc: false, required: false }),
      makeField("hig-context-5", "Para", "texto", "Cabecalho", { nc: false, required: false }),
      makeField("hig-context-6", "Matriz de troca", "texto", "Cabecalho", { nc: false, layout: "full" }),
      ...checklistGroups.reduce((acc, group) => {
        return acc.concat(makeFields(`hig-${group.id}`, group.items, group.title, "c_nc"));
      }, []),
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

  if (type === "batelada_milho") {
    return bateladaMilhoComponents;
  }

  return [];
}

function defaultFrequencyForProcess(type) {
  if (type === "higienizacao") return "Por setup";
  if (type === "produto_liberacao") return "Por horario liberado";
  if (type === "produto_avaliacao" || type === "processo" || type === "fotografico") return "Hora em hora";
  if (type === "batelada_milho") return "Por batelada";
  return "Por registro";
}

function buildComponentLibrary() {
  return processTypes.reduce((acc, processType) => {
    const processFields = defaultFieldsForProcess(processType.id).map((field, index) => ({
      id: `tpl-${processType.id}-${index + 1}`,
      processType: processType.id,
      name: field.name,
      type: field.type,
      section: field.section,
      layout: field.layout,
      required: field.required,
      nc: field.nc,
      defaultMode: field.defaultMode,
      defaultTag: field.defaultTag,
      valueList: field.valueList,
      useLineRules: field.useLineRules,
      rulesByLine: field.rulesByLine,
      subfields: field.subfields ?? []
    }));

    return acc.concat(processFields);
  }, []);
}

function buildClextralComponentLibrary() {
  return buildClextralFields("tpl-clextral").map((field, index) => ({
    id: `tpl-clextral-${index + 1}`,
    processType: "processo",
    name: field.name,
    type: field.type,
    section: field.section,
    layout: field.layout,
    required: field.required,
    nc: field.nc,
    defaultMode: field.defaultMode,
    defaultTag: field.defaultTag,
    valueList: field.valueList,
      useLineRules: field.useLineRules,
      rulesByLine: field.rulesByLine,
      unit: field.unit ?? "",
      subfields: field.subfields ?? []
    }));
}


function cloneFieldsForProcess(type, processId) {
  return defaultFieldsForProcess(type).map((field, index) => ({ ...field, id: `${processId}-field-${index + 1}` }));
}

function buildProcessesForRg(rgId) {
  return processTypes.map((type, index) => {
    const processId = `${rgId}-proc-${index + 1}`;
    return {
      id: processId,
      type: type.id,
      name: type.label,
      frequency: defaultFrequencyForProcess(type.id),
      fields: cloneFieldsForProcess(type.id, processId)
    };
  });
}

const initialRgs = [
  {
    id: "rg-005",
    code: "RG.QUA.005",
    title: "Controle de Liberacao de Produto",
    revision: "02",
    linkedLines: ["PUR"],
    processes: buildProcessesForRg("rg-005")
  },
  {
    id: "rg-qua-ba-004",
    code: "RG.QUA.BA.004",
    title: "Controle de Liberacao de Produto - Milho",
    revision: "03",
    linkedLines: ["SAL"],
    processes: buildProcessesForRg("rg-qua-ba-004")
  },
  {
    id: "rg-qua-ba-003",
    code: "RG.QUA.BA.003",
    title: "Controle de Liberacao de Produto - Rosca",
    revision: "03",
    linkedLines: ["ROS"],
    processes: buildProcessesForRg("rg-qua-ba-003")
  },
  {
    id: "rg-prd-ba-004",
    code: "RG.PRD.BA.004",
    title: "Parametros de Processo Extrusados - Linha Clextral",
    revision: "02",
    linkedLines: ["SAL"],
    processes: [
      {
        id: "rg-prd-ba-004-proc-1",
        type: "processo",
        name: "Parametros Extrusora Clextral",
        frequency: "Hora em hora",
        fields: buildClextralFields("rg-prd-ba-004-proc-1")
      }
    ]
  },
  {
    id: "rg-prd-ba-003",
    code: "RG.PRD.BA.003",
    title: "Controle de Batelada do Milho",
    revision: "00",
    linkedLines: ["SAL"],
    processes: [
      {
        id: "rg-prd-ba-003-proc-1",
        type: "batelada_milho",
        name: "Controle de Batelada do Milho",
        frequency: "Por batelada",
        fields: buildBateladaMilhoFields("rg-prd-ba-003-proc-1")
      }
    ]
  }
];

const initialComponentLibrary = [...buildComponentLibrary(), ...buildClextralComponentLibrary()];

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

function groupedByType(fields) {
  return fields.reduce((groups, field) => {
    const type = field.type || "texto";
    return { ...groups, [type]: [...(groups[type] ?? []), field] };
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

function FieldPreview({ field, selected, onSelect, onDragStart, onDrop, onDragOver, draggable = true }) {
  const visualType = ["titulo", "instrucao", "separador"].includes(field.type);
  return (
    <article
      draggable={draggable}
      className={`${previewGridClass(field.layout)} cursor-pointer rounded-md border p-3 text-left transition ${
        selected ? "border-cicopal-blue bg-blue-50 shadow-soft" : "border-gray-200 bg-white hover:border-cicopal-blue"
      }`}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onDragOver={onDragOver}
      role="button"
      tabIndex={0}
    >
      <div className={`${visualType ? "mb-0" : "mb-2"} flex items-start justify-between gap-2`}>
        {!visualType ? <span className="text-sm font-bold text-gray-950">{field.name}</span> : <span />}
        {draggable ? <GripVertical size={18} className="shrink-0 text-gray-400" /> : null}
      </div>
      <OperatorFieldControl field={field} />
      <div className={`${visualType ? "mt-3" : "mt-2"} flex flex-wrap gap-2`}>
        <span className="audit-badge bg-gray-100 text-gray-600">
          {layoutOptions.find((item) => item.id === field.layout)?.preview ?? "1/3"}
        </span>
        {field.nc ? <span className="audit-badge bg-red-100 text-cicopal-red">NC</span> : null}
        {field.defaultMode === "tag" && field.defaultTag ? <span className="audit-badge bg-blue-100 text-cicopal-blue">Tag</span> : null}
        {field.defaultMode === "lista" && field.valueList ? <span className="audit-badge bg-gray-900 text-white">Lista</span> : null}
        {Object.keys(field.rulesByLine ?? {}).length ? <span className="audit-badge bg-yellow-100 text-yellow-800">Parametros</span> : null}
      </div>
    </article>
  );
}

function ChecklistRowPreview({ field, selected, onSelect, onDragStart, onDrop, onDragOver, draggable = true }) {
  return (
    <tr
      draggable={draggable}
      className={`${selected ? "bg-blue-50" : "bg-white"} cursor-pointer`}
      onClick={onSelect}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {draggable ? <GripVertical size={17} className="shrink-0 text-gray-400" /> : null}
          <span className="text-base font-semibold text-gray-950">{field.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-green-200 bg-green-50 px-3 font-bold text-cicopal-green">
          C
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-gray-100 px-3 text-sm font-bold text-gray-500">
          Bloqueada
        </span>
      </td>
    </tr>
  );
}

function OperatorFieldControl({ field }) {
  if (field.type === "titulo") {
    return <div className="border-l-4 border-cicopal-blue pl-3 text-lg font-black tracking-tight text-gray-950">{field.name}</div>;
  }

  if (field.type === "instrucao") {
    return <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-sm font-semibold leading-relaxed text-blue-950">{field.name}</div>;
  }

  if (field.type === "separador") {
    return <div className="flex items-center gap-3 py-2"><span className="h-px flex-1 bg-gray-200" />{field.name ? <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{field.name}</span> : null}<span className="h-px flex-1 bg-gray-200" /></div>;
  }

  if (field.defaultMode === "tag" && field.defaultTag) {
    return (
      <div className="flex min-h-12 items-center rounded-md border border-blue-200 bg-blue-50 px-3 font-bold text-cicopal-blue">
        {defaultTags.find((tag) => tag.id === field.defaultTag)?.label ?? field.defaultTag}
      </div>
    );
  }

  if (field.defaultMode === "lista" && field.valueList) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3">
        <span className="font-semibold text-gray-500">Selecionar valor</span>
        <span className="audit-badge bg-gray-100 text-gray-700">{field.valueList}</span>
      </div>
    );
  }

  if (field.type === "c_nc") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase text-gray-500">1 AV</span>
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-green-200 bg-green-50 px-3 font-bold text-cicopal-green">
            C
          </span>
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase text-gray-500">2 AV</span>
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-gray-100 px-3 text-sm font-bold text-gray-500">
            Bloqueada
          </span>
        </div>
      </div>
    );
  }

  if (field.type === "percentual" || field.type === "temperatura") {
    const unit = field.unit || (field.type === "percentual" ? "%" : "deg C");
    return (
      <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
        <span className="w-full px-3 font-semibold text-gray-400">0,00</span>
        <span className="flex min-h-12 items-center bg-gray-100 px-3 text-sm font-bold text-gray-600">{unit}</span>
      </div>
    );
  }

  if (field.type === "numero") {
    return (
      <div className="flex min-h-12 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
        <span className="w-full px-3 font-semibold text-gray-400">0</span>
        {field.unit ? <span className="flex min-h-12 items-center bg-gray-100 px-3 text-sm font-bold text-gray-600">{field.unit}</span> : null}
      </div>
    );
  }

  if (field.type === "hora") {
    return (
      <div className="flex min-h-12 items-center rounded-md border border-gray-300 bg-white px-3 font-semibold text-gray-400">
        --:--
      </div>
    );
  }

  if (field.type === "data") {
    return (
      <div className="flex min-h-12 items-center rounded-md border border-gray-300 bg-white px-3 font-semibold text-gray-400">
        dd/mm/aaaa
      </div>
    );
  }

  if (field.type === "grupo") {
    const subfields = field.subfields?.length ? field.subfields : [{ label: "Set point", unit: "deg C" }, { label: "Real", unit: "deg C" }];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {subfields.map((subfield) => (
          <div key={subfield.label}>
            <span className="mb-1 block text-[11px] font-bold uppercase text-gray-500">{subfield.label}</span>
            <div className="flex min-h-11 items-center overflow-hidden rounded-md border border-gray-300 bg-white">
              <span className="w-full px-3 font-semibold text-gray-400">0,00</span>
              {subfield.unit ? <span className="flex min-h-11 items-center bg-gray-100 px-2 text-xs font-bold text-gray-600">{subfield.unit}</span> : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "foto") {
    return (
      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 font-bold text-gray-500">
        <Camera size={22} />
        Tirar foto
      </div>
    );
  }

  if (field.type === "assinatura") {
    return (
      <div className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-cicopal-blue px-3 font-bold text-white">
        <FileSignature size={20} />
        Assinar
      </div>
    );
  }

  return (
    <div className="flex min-h-12 items-center rounded-md border border-gray-300 bg-white px-3 font-semibold text-gray-400">
      Preencher texto
    </div>
  );
}

function SectionCard({ section, fields, children, collapsed = false, onToggle, onAddComponent, ncTypes = [], linkedNcId = "", onLinkNc }) {
  const types = [...new Set(fields.map((field) => fieldTypeLabel(field.type)))];
  const checklist = isChecklistSection(fields);

  return (
    <section className={`overflow-hidden rounded-md border border-gray-200 ${checklist ? "bg-white" : `border-l-[6px] p-3 ${sectionTone(section)}`}`}>
      <div className={`${checklist ? "border-t-[5px] border-cicopal-blue px-4 py-3" : "mb-3 rounded-md bg-white/80 p-3"} flex flex-wrap items-start justify-between gap-3`}>
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">{sectionKind(section)}</p>
          <h4 className={`text-xl font-bold ${checklist ? "text-cicopal-blue" : "text-gray-950"}`}>{section}</h4>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="audit-badge bg-white text-gray-700">{fields.length} campos</span>
          {types.slice(0, 4).map((type) => (
            <span key={type} className="audit-badge bg-gray-900 text-white">
              {type}
            </span>
          ))}
          {onToggle ? (
            <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-sm font-bold text-gray-700" onClick={onToggle}>
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              {collapsed ? "Abrir" : "Minimizar"}
            </button>
          ) : null}
        </div>
      </div>
      {collapsed ? null : <div className={checklist ? "" : ""}>{children}</div>}
      {!collapsed && onAddComponent ? (
        <div className={`${checklist ? "border-t border-gray-100 p-3" : "mt-3"} grid gap-2 md:grid-cols-[minmax(0,1fr)_260px]`}>
          <button
            type="button"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-cicopal-blue bg-white font-bold text-cicopal-blue"
            onClick={onAddComponent}
          >
            <Plus size={20} />
            Adicionar componente nesta secao
          </button>
          {onLinkNc ? (
            <label>
              <span className="sr-only">NC vinculada</span>
              <select
                className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-bold text-gray-700"
                value={linkedNcId}
                onChange={(event) => onLinkNc(event.target.value)}
              >
                <option value="">Sem NC vinculada</option>
                {ncTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function isChecklistSection(fields) {
  return fields.length > 3 && fields.every((field) => field.type === "c_nc");
}

function ComponentRulesEditor({ item, lines, lists, onChange, onLineRuleChange }) {
  const numeric = ["numero", "percentual", "temperatura"].includes(item.type);
  const selectedList = lists.find((list) => list.id === item.valueList);

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div>
        <h4 className="text-base font-bold text-gray-950">Regras do componente</h4>
        <p className="text-sm font-semibold text-gray-500">Defina como o campo nasce e como sera validado.</p>
      </div>

      <label>
        <FieldLabel>Valor padrao</FieldLabel>
        <ConfigSelect value={item.defaultMode ?? "manual"} onChange={(event) => onChange("defaultMode", event.target.value)}>
          {defaultValueModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </ConfigSelect>
      </label>

      {item.defaultMode === "tag" ? (
        <div className="rounded-md border border-blue-100 bg-white p-3">
          <FieldLabel>Tag automatica</FieldLabel>
          <div className="mb-2 grid gap-2">
            {defaultTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`min-h-11 rounded-md border px-3 text-left font-bold ${
                  item.defaultTag === tag.id ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 bg-white text-gray-700"
                }`}
                onClick={() => onChange("defaultTag", tag.id)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {item.defaultMode === "lista" ? (
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <label>
            <FieldLabel>Lista de valores</FieldLabel>
            <ConfigSelect value={item.valueList ?? ""} onChange={(event) => onChange("valueList", event.target.value)}>
              <option value="">Selecione uma lista</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.label}
                </option>
              ))}
            </ConfigSelect>
          </label>
          {selectedList ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedList.values.map((value) => (
                <span key={value} className="audit-badge bg-gray-100 text-gray-700">
                  {value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {numeric ? (
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 font-bold text-gray-700">
          <input
            type="checkbox"
            className="size-6"
            checked={Boolean(item.useLineRules)}
            onChange={(event) => onChange("useLineRules", event.target.checked)}
          />
          Usar parametros por linha
        </label>
      ) : null}

      {numeric && item.useLineRules ? (
        <div className="rounded-md border border-gray-200 bg-white p-3">
          <div className="mb-3">
            <h5 className="font-bold text-gray-950">Parametros por linha</h5>
            <p className="text-sm font-semibold text-gray-500">Use faixas diferentes quando PUR, SAL ou ROSCA tiverem limites proprios.</p>
          </div>
          <div className="grid gap-3">
            {lines.map((line) => {
              const rule = { ...lineRuleDefaults, ...(item.rulesByLine?.[line.id] ?? {}) };
              return (
                <div key={line.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 font-bold text-gray-950">{line.nome}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label>
                      <FieldLabel>Amarelo abaixo de</FieldLabel>
                      <ConfigInput value={rule.yellowBelow} onChange={(event) => onLineRuleChange(line.id, "yellowBelow", event.target.value)} />
                    </label>
                    <label>
                      <FieldLabel>Verde de</FieldLabel>
                      <ConfigInput value={rule.greenMin} onChange={(event) => onLineRuleChange(line.id, "greenMin", event.target.value)} />
                    </label>
                    <label>
                      <FieldLabel>Verde ate</FieldLabel>
                      <ConfigInput value={rule.greenMax} onChange={(event) => onLineRuleChange(line.id, "greenMax", event.target.value)} />
                    </label>
                    <label>
                      <FieldLabel>Vermelho acima de</FieldLabel>
                      <ConfigInput value={rule.redAbove} onChange={(event) => onLineRuleChange(line.id, "redAbove", event.target.value)} />
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-md text-center text-xs font-bold">
                    <span className="bg-yellow-100 px-2 py-2 text-yellow-800">&lt; {rule.yellowBelow}</span>
                    <span className="bg-green-100 px-2 py-2 text-green-800">{rule.greenMin} a {rule.greenMax}</span>
                    <span className="bg-red-100 px-2 py-2 text-red-800">&gt; {rule.redAbove}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddComponentDialog({ open, section, components, onClose, onSelect }) {
  if (!open) return null;
  const grouped = groupedByType(components);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-md bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
          <div>
            <h3 className="text-xl font-bold text-cicopal-blue">Adicionar componente</h3>
            <p className="text-sm font-semibold text-gray-500">Secao: {section}</p>
          </div>
          <button type="button" className="min-h-11 rounded-md border border-gray-300 px-4 font-bold text-gray-700" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          <div className="space-y-4">
            {fieldTypes.map((type) => {
              const items = grouped[type.id] ?? [];
              if (!items.length) return null;
              return (
                <section key={type.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-950">{type.label}</h4>
                    <span className="audit-badge bg-white text-gray-700">{items.length} componentes</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map((component) => (
                      <button
                        key={component.id}
                        type="button"
                        className="rounded-md border border-gray-200 bg-white p-3 text-left hover:border-cicopal-blue hover:bg-blue-50"
                        onClick={() => onSelect(component.id)}
                      >
                        <span className="block font-bold text-gray-950">{component.name}</span>
                        <span className="text-xs font-semibold text-gray-500">
                          {component.section} - {fieldTypeLabel(component.type)}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {component.defaultMode === "tag" && component.defaultTag ? <span className="audit-badge bg-blue-100 text-cicopal-blue">Tag</span> : null}
                          {component.defaultMode === "lista" && component.valueList ? <span className="audit-badge bg-gray-900 text-white">Lista</span> : null}
                          {Object.keys(component.rulesByLine ?? {}).length ? <span className="audit-badge bg-yellow-100 text-yellow-800">Parametros</span> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function IndexDialog({ draft, lines, lists, onChange, onLineRuleChange, onClose, onSave }) {
  if (!draft) return null;
  const isCnc = draft.type === "c_nc";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <section className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-md bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 p-4">
          <div>
            <h3 className="text-xl font-bold text-cicopal-blue">{draft.existing ? "Alterar indice" : "Novo indice"}</h3>
            <p className="text-sm font-semibold text-gray-500">Configure o indice antes de usa-lo nos processos.</p>
          </div>
          <button type="button" className="min-h-11 rounded-md border border-gray-300 px-4 font-bold text-gray-700" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <FieldLabel>Nome</FieldLabel>
              <ConfigInput value={draft.name} onChange={(event) => onChange("name", event.target.value)} />
            </label>
            <label>
              <FieldLabel>Tipo</FieldLabel>
              <ConfigSelect value={draft.type} onChange={(event) => onChange("type", event.target.value)}>
                {fieldTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </ConfigSelect>
            </label>
            <label>
              <FieldLabel>Secao sugerida</FieldLabel>
              <ConfigInput value={draft.section} onChange={(event) => onChange("section", event.target.value)} />
            </label>
            <label>
              <FieldLabel>Largura sugerida</FieldLabel>
              <ConfigSelect value={draft.layout} onChange={(event) => onChange("layout", event.target.value)}>
                {layoutOptions.map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.label}
                  </option>
                ))}
              </ConfigSelect>
            </label>
          </div>

          <label className="mt-3 flex min-h-11 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 font-bold text-gray-700">
            <input type="checkbox" className="size-6" checked={draft.required} onChange={(event) => onChange("required", event.target.checked)} />
            Obrigatorio
          </label>

          {isCnc ? (
            <div className="mt-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm font-bold text-cicopal-red">
              Todo indice C / NC gera nao conformidade quando marcado como NC.
            </div>
          ) : null}

          <div className="mt-3">
            <ComponentRulesEditor item={draft} lines={lines} lists={lists} onChange={onChange} onLineRuleChange={onLineRuleChange} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          <button type="button" className="min-h-12 rounded-md border border-gray-300 px-4 font-bold text-gray-700" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="min-h-12 rounded-md bg-cicopal-blue px-5 font-bold text-white" onClick={onSave}>
            Salvar indice
          </button>
        </div>
      </section>
    </div>
  );
}

export function RgConfigurator({ lines, loggedUser }) {
  const [guidedMode, setGuidedMode] = useState(false);
  const [rgs, setRgs] = useState(initialRgs);
  const [componentLibrary, setComponentLibrary] = useState(initialComponentLibrary);
  const [valueLists, setValueLists] = useState(initialValueLists);
  const [ncTypes, setNcTypes] = useState(initialNcTypes);
  const [activeStep, setActiveStep] = useState("componente");
  const [selectedRgId, setSelectedRgId] = useState(initialRgs[0].id);
  const [selectedProcessId, setSelectedProcessId] = useState(initialRgs[0].processes[0].id);
  const [selectedFieldId, setSelectedFieldId] = useState(initialRgs[0].processes[0].fields[0].id);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialComponentLibrary[0]?.id ?? "");
  const [draggedFieldId, setDraggedFieldId] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [addComponentSection, setAddComponentSection] = useState("");
  const [componentMode, setComponentMode] = useState("biblioteca");
  const [indexTypeFilter, setIndexTypeFilter] = useState("todos");
  const [selectedListId, setSelectedListId] = useState(initialValueLists[0]?.id ?? "");
  const [selectedNcTypeId, setSelectedNcTypeId] = useState(initialNcTypes[0]?.id ?? "");
  const [indexDraft, setIndexDraft] = useState(null);
  const [sectionNcLinks, setSectionNcLinks] = useState({});

  const selectedRg = rgs.find((rg) => rg.id === selectedRgId) ?? rgs[0];
  const selectedProcess = selectedRg.processes.find((process) => process.id === selectedProcessId) ?? selectedRg.processes[0];
  const selectedField = selectedProcess?.fields.find((field) => field.id === selectedFieldId) ?? selectedProcess?.fields[0];
  const fieldsBySection = useMemo(() => groupedBySection(selectedProcess?.fields ?? []), [selectedProcess]);
  const linkedLineNames = useMemo(
    () => lines.filter((line) => selectedRg.linkedLines.includes(line.id)).map((line) => line.nome),
    [lines, selectedRg]
  );
  const selectedTemplate = componentLibrary.find((component) => component.id === selectedTemplateId) ?? componentLibrary[0];
  const componentsByType = useMemo(() => groupedByType(componentLibrary), [componentLibrary]);
  const filteredFieldTypes = fieldTypes.filter((type) => indexTypeFilter === "todos" || type.id === indexTypeFilter);
  const selectedList = valueLists.find((list) => list.id === selectedListId) ?? valueLists[0];
  const selectedNcType = ncTypes.find((type) => type.id === selectedNcTypeId) ?? ncTypes[0];
  const cncIndexes = componentLibrary.filter((component) => component.type === "c_nc");
  const collapsedKey = selectedProcess ? `${selectedProcess.id}:` : "";

  function sectionKey(section) {
    return selectedProcess ? `${selectedProcess.id}:${section}` : section;
  }

  function updateRg(field, value) {
    setRgs((current) => current.map((rg) => (rg.id === selectedRg.id ? { ...rg, [field]: value } : rg)));
  }

  function addRg() {
    const rgId = makeId("rg");
    const newRg = {
      id: rgId,
      code: "RG.QUA.000",
      title: "Novo RG",
      revision: "00",
      linkedLines: [],
      processes: buildProcessesForRg(rgId)
    };
    setRgs((current) => [...current, newRg]);
    setSelectedRgId(newRg.id);
    setSelectedProcessId(newRg.processes[0]?.id ?? "");
    setSelectedFieldId(newRg.processes[0]?.fields[0]?.id ?? "");
    setActiveStep("rg");
  }

  function createGuidedRg(draft) {
    const rgId = makeId("rg");
    const processId = makeId("proc");
    const fields = draft.sections.flatMap((section) =>
      section.fields.map((field) =>
        makeField(makeId("field"), field.name, field.type === "lista" ? "texto" : field.type, section.name, {
          layout: field.layout ?? "half",
          required: field.required,
          nc: field.nc,
          unit: field.unit ?? "",
          min: field.min ?? "",
          max: field.max ?? "",
          options: field.options ?? [],
          subfields: field.subfields ?? [],
          groupTemplate: field.groupTemplate ?? "",
          groupDescription: field.groupDescription ?? "",
          defaultMode: field.defaultMode === "sistema" ? "tag" : field.type === "lista" ? "lista" : "manual",
          defaultTag: field.systemValue ?? "",
          defaultLocked: field.defaultLocked ?? false
        })
      )
    );
    const newRg = {
      id: rgId,
      code: draft.code,
      title: draft.title,
      description: draft.description,
      revision: draft.revision,
      linkedLines: draft.linkedLines,
      processes: [{ id: processId, type: "processo", name: draft.processName, frequency: draft.frequency, fields }]
    };
    setRgs((current) => [...current, newRg]);
    setSelectedRgId(rgId);
    setSelectedProcessId(processId);
    setSelectedFieldId(fields[0]?.id ?? "");
    setActiveStep("processo");
    setGuidedMode(false);
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
    const processId = makeId("proc");
    const newProcess = {
      id: processId,
      type: type.id,
      name: type.label,
      frequency: defaultFrequencyForProcess(type.id),
      fields: cloneFieldsForProcess(type.id, processId)
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
                const nextFields = field === "type" ? cloneFieldsForProcess(value, process.id) : process.fields;
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
    setIndexDraft({
      ...makeField(makeId("tpl"), "Novo indice", "texto", "Geral", { layout: "third", nc: false }),
      processType: "geral",
      existing: false
    });
  }

  function addFieldFromTemplate(templateId = selectedTemplate?.id, sectionOverride = "", openLayout = true) {
    if (!selectedProcess || !templateId) return;
    const template = componentLibrary.find((item) => item.id === templateId);
    if (!template) return;
    const newField = makeField(makeId("field"), template.name, template.type, sectionOverride || template.section, {
      layout: template.layout,
      required: template.required,
      nc: template.nc,
      defaultMode: template.defaultMode,
      defaultTag: template.defaultTag,
      valueList: template.valueList,
      useLineRules: template.useLineRules,
      rulesByLine: template.rulesByLine,
      unit: template.unit ?? "",
      subfields: template.subfields ?? []
    });

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
    if (openLayout) {
      setActiveStep("componente");
      setComponentMode("layout");
    }
  }

  function addTemplateToSection(templateId) {
    addFieldFromTemplate(templateId, addComponentSection, activeStep !== "processo");
    setAddComponentSection("");
  }

  function toggleSection(section) {
    if (!selectedProcess) return;
    const key = `${selectedProcess.id}:${section}`;
    setCollapsedSections((current) => ({ ...current, [key]: !current[key] }));
  }

  function linkNcToSection(section, ncId) {
    setSectionNcLinks((current) => ({ ...current, [sectionKey(section)]: ncId }));
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

  function updateTemplate(templateId, key, value) {
    setComponentLibrary((current) =>
      current.map((template) => (template.id === templateId ? { ...template, [key]: value } : template))
    );
  }

  function updateFieldLineRule(fieldId, lineId, key, value) {
    setRgs((current) =>
      current.map((rg) =>
        rg.id === selectedRg.id
          ? {
              ...rg,
              processes: rg.processes.map((process) =>
                process.id === selectedProcess.id
                  ? {
                      ...process,
                      fields: process.fields.map((field) =>
                        field.id === fieldId
                          ? {
                              ...field,
                              rulesByLine: {
                                ...(field.rulesByLine ?? {}),
                                [lineId]: { ...lineRuleDefaults, ...(field.rulesByLine?.[lineId] ?? {}), [key]: value }
                              }
                            }
                          : field
                      )
                    }
                  : process
              )
            }
          : rg
      )
    );
  }

  function updateTemplateLineRule(templateId, lineId, key, value) {
    setComponentLibrary((current) =>
      current.map((template) =>
        template.id === templateId
          ? {
              ...template,
              rulesByLine: {
                ...(template.rulesByLine ?? {}),
                [lineId]: { ...lineRuleDefaults, ...(template.rulesByLine?.[lineId] ?? {}), [key]: value }
              }
            }
          : template
      )
    );
  }

  function openEditIndex(template) {
    setIndexDraft({ ...template, existing: true });
  }

  function updateIndexDraft(key, value) {
    setIndexDraft((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      if (key === "type") next.nc = value === "c_nc";
      return next;
    });
  }

  function updateIndexDraftLineRule(lineId, key, value) {
    setIndexDraft((current) =>
      current
        ? {
            ...current,
            rulesByLine: {
              ...(current.rulesByLine ?? {}),
              [lineId]: { ...lineRuleDefaults, ...(current.rulesByLine?.[lineId] ?? {}), [key]: value }
            }
          }
        : current
    );
  }

  function saveIndexDraft() {
    if (!indexDraft) return;
    const saved = {
      ...indexDraft,
      nc: indexDraft.type === "c_nc"
    };
    delete saved.existing;
    setComponentLibrary((current) => {
      const exists = current.some((template) => template.id === saved.id);
      return exists ? current.map((template) => (template.id === saved.id ? saved : template)) : [...current, saved];
    });
    setSelectedTemplateId(saved.id);
    setIndexDraft(null);
  }

  function addNcType() {
    const newType = { id: makeId("nc"), name: "Nova NC", section: "Nao conformidades", indexIds: [] };
    setNcTypes((current) => [...current, newType]);
    setSelectedNcTypeId(newType.id);
  }

  function updateNcType(key, value) {
    setNcTypes((current) => current.map((type) => (type.id === selectedNcType?.id ? { ...type, [key]: value } : type)));
  }

  function toggleNcIndex(indexId) {
    setNcTypes((current) =>
      current.map((type) => {
        if (type.id !== selectedNcType?.id) return type;
        const active = type.indexIds.includes(indexId);
        return { ...type, indexIds: active ? type.indexIds.filter((id) => id !== indexId) : [...type.indexIds, indexId] };
      })
    );
  }

  function addValueList() {
    const newList = { id: makeId("lista"), label: "nova_lista", values: ["Valor 1"] };
    setValueLists((current) => [...current, newList]);
    setSelectedListId(newList.id);
  }

  function updateValueList(listId, key, value) {
    setValueLists((current) => current.map((list) => (list.id === listId ? { ...list, [key]: value } : list)));
  }

  function updateValueListValues(listId, value) {
    const values = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    updateValueList(listId, "values", values);
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

  if (guidedMode) {
    return <GuidedRgBuilder lines={lines} loggedUser={loggedUser} onCancel={() => setGuidedMode(false)} onCreate={createGuidedRg} />;
  }

  return (
    <section className="rounded-[20px] border border-gray-200/80 bg-[#f5f7fc] p-3 shadow-soft">
      <div className="modern-panel mb-3 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cicopal-blue">Workspace de configuração</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950">Configurador visual de RG</h2>
          <p className="text-sm font-semibold text-gray-500">Crie documentos, processos e regras sem precisar programar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md border border-cicopal-blue bg-blue-50 px-4 font-bold text-cicopal-blue" onClick={() => setGuidedMode(true)}>
            <Plus size={20} />
            Criar RG guiado
          </button>
          <button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white">
            <LayoutTemplate size={20} />
            Salvar modelo
          </button>
        </div>
      </div>

      <div className="modern-panel mb-3 grid grid-cols-2 gap-2 p-1.5 md:grid-cols-4">
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
              onClick={() => {
                setActiveStep(step.id);
                if (step.id === "componente") setComponentMode("biblioteca");
              }}
            >
              <Icon size={20} />
              {step.label}
            </button>
          );
        })}
      </div>

      {activeStep === "rg" ? (
        <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">RGs disponíveis</h3>
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cicopal-blue px-3 font-bold text-white" onClick={addRg}>
                <Plus size={18} />
                Novo RG
              </button>
            </div>
            <div className="grid gap-2">
              {rgs.map((rg) => (
                <button
                  key={rg.id}
                  type="button"
                  className={`rounded-md border p-3 text-left ${rg.id === selectedRg.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-white"}`}
                  onClick={() => {
                    setSelectedRgId(rg.id);
                    setSelectedProcessId(rg.processes[0]?.id ?? "");
                    setSelectedFieldId(rg.processes[0]?.fields[0]?.id ?? "");
                  }}
                >
                  <span className="block text-lg font-bold text-gray-950">{rg.code}</span>
                  <span className="block text-sm font-semibold text-gray-500">{rg.title}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-gray-950">Configuração do RG</h3>
                <p className="text-sm font-semibold text-gray-500">Defina o documento e onde ele estará disponível.</p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white"
                onClick={() => setActiveStep("processo")}
              >
                Abrir processos
                <ClipboardList size={20} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <FieldLabel>Código</FieldLabel>
                <ConfigInput value={selectedRg.code} onChange={(event) => updateRg("code", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Título</FieldLabel>
                <ConfigInput value={selectedRg.title} onChange={(event) => updateRg("title", event.target.value)} />
              </label>
              <label>
                <FieldLabel>Revisão</FieldLabel>
                <ConfigInput value={selectedRg.revision} onChange={(event) => updateRg("revision", event.target.value)} />
              </label>
            </div>

            <div className="mt-4">
              <FieldLabel>Linhas vinculadas</FieldLabel>
              <div className="grid gap-2 md:grid-cols-3">
                {lines.map((line) => {
                  const active = selectedRg.linkedLines.includes(line.id);
                  return (
                    <button
                      key={line.id}
                      type="button"
                      className={`flex min-h-12 items-center justify-between rounded-md border px-3 font-bold ${
                        active ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 bg-white text-gray-700"
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
          </section>
        </div>
      ) : null}

      {activeStep === "processo" ? (
        <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-950">Processos de {selectedRg.code}</h3>
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cicopal-blue px-3 font-bold text-white" onClick={addProcess}>
                <Plus size={18} />
                Novo
              </button>
            </div>
            <div className="grid gap-2">
              {selectedRg.processes.map((process) => (
                <button
                  key={process.id}
                  type="button"
                  className={`rounded-md border p-3 text-left ${process.id === selectedProcess?.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-white"}`}
                  onClick={() => {
                    setSelectedProcessId(process.id);
                    setSelectedFieldId(process.fields[0]?.id ?? "");
                  }}
                >
                  <span className="block text-lg font-bold text-gray-950">{process.name}</span>
                  <span className="text-xs font-semibold text-gray-500">
                    {getProcessPrefix(process.type)} - {process.frequency} - {process.fields.length} campos
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-3">
            {selectedProcess ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-950">Configuração do processo</h3>
                    <p className="text-sm font-semibold text-gray-500">Defina a regra do processo antes de montar os campos.</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
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
                    <FieldLabel>Frequência</FieldLabel>
                    <ConfigSelect value={selectedProcess.frequency} onChange={(event) => updateProcess(selectedProcess.id, "frequency", event.target.value)}>
                      {frequencies.map((frequency) => (
                        <option key={frequency} value={frequency}>
                          {frequency}
                        </option>
                      ))}
                    </ConfigSelect>
                  </label>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-bold uppercase text-gray-500">Prefixo</p>
                    <p className="text-xl font-bold text-gray-950">{getProcessPrefix(selectedProcess.type)}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-bold uppercase text-gray-500">Campos</p>
                    <p className="text-xl font-bold text-gray-950">{selectedProcess.fields.length}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-20 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 font-bold text-cicopal-red"
                    onClick={() => removeProcess(selectedProcess.id)}
                  >
                    <Trash2 size={18} />
                    Remover processo
                  </button>
                </div>

                <div className="mt-4">
                  <section className="rounded-md border border-gray-200 bg-[#f4f7fb] p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-lg font-bold text-gray-950">Visualizacao do processo</h4>
                        <p className="text-sm font-semibold text-gray-500">Previa do formulario como ele aparece para a operacao.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {Object.entries(fieldsBySection).map(([section, fields]) => (
                        <SectionCard
                          key={section}
                          section={section}
                          fields={fields}
                          collapsed={Boolean(collapsedSections[`${selectedProcess.id}:${section}`])}
                          onToggle={() => toggleSection(section)}
                          onAddComponent={() => setAddComponentSection(section)}
                          ncTypes={ncTypes}
                          linkedNcId={sectionNcLinks[sectionKey(section)] ?? ""}
                          onLinkNc={(ncId) => linkNcToSection(section, ncId)}
                        >
                          {isChecklistSection(fields) ? (
                            <div className="overflow-x-auto rounded-md bg-white">
                              <table className="audit-table min-w-[560px] text-left">
                                <thead>
                                  <tr>
                                    <th className="px-4 py-3">Item</th>
                                    <th className="w-40 px-4 py-3">1 AV</th>
                                    <th className="w-40 px-4 py-3">2 AV</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fields.map((field) => (
                                    <ChecklistRowPreview
                                      key={field.id}
                                      field={field}
                                      selected={field.id === selectedField?.id}
                                      onSelect={() => setSelectedFieldId(field.id)}
                                      draggable={false}
                                      onDragStart={() => {}}
                                      onDrop={(event) => event.preventDefault()}
                                      onDragOver={(event) => event.preventDefault()}
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-12">
                              {fields.map((field) => (
                                <FieldPreview
                                  key={field.id}
                                  field={field}
                                  selected={field.id === selectedField?.id}
                                  onSelect={() => setSelectedFieldId(field.id)}
                                  draggable={false}
                                  onDragStart={() => {}}
                                  onDrop={(event) => event.preventDefault()}
                                  onDragOver={(event) => event.preventDefault()}
                                />
                              ))}
                            </div>
                          )}
                        </SectionCard>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 p-8 text-center font-bold text-gray-500">
                Crie ou selecione um processo.
              </div>
            )}
          </section>
        </div>
      ) : null}
      {activeStep === "componente" ? (
        <div>
          <main className="min-w-0 space-y-4 rounded-md border border-gray-200 bg-[#f8fafc] p-3">
            <section className="rounded-md border border-gray-200 bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-cicopal-blue">Indice</p>
                  <h3 className="text-2xl font-bold text-gray-950">Componentes e listas</h3>
                  <p className="text-sm font-semibold text-gray-500">Cadastre campos, listas e regras reutilizaveis para montar os processos.</p>
                </div>
                <button type="button" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-cicopal-blue px-4 font-bold text-white shadow-soft" onClick={addField}>
                  <Plus size={20} />
                  Novo indice
                </button>
              </div>
            </section>

            <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-gray-950">Filtro por tipo</h4>
                  <p className="text-sm font-semibold text-gray-500">Selecione uma familia para focar a visualizacao.</p>
                </div>
                <button
                  type="button"
                  className={`min-h-11 rounded-md border px-3 font-bold ${indexTypeFilter === "todos" ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 bg-white text-gray-700"}`}
                  onClick={() => setIndexTypeFilter("todos")}
                >
                  Todos
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {fieldTypes.map((type) => {
                  const total = componentsByType[type.id]?.length ?? 0;
                  const active = indexTypeFilter === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={`min-h-20 rounded-md border p-3 text-left transition ${
                        active ? "border-cicopal-blue bg-blue-50 shadow-soft" : "border-gray-200 bg-gray-50 hover:border-cicopal-blue hover:bg-white"
                      }`}
                      onClick={() => setIndexTypeFilter(type.id)}
                    >
                      <span className={`block text-base font-bold ${active ? "text-cicopal-blue" : "text-gray-950"}`}>{type.label}</span>
                      <span className="text-sm font-semibold text-gray-500">{total} indices</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="space-y-4">
              {filteredFieldTypes.map((type) => {
                const components = componentsByType[type.id] ?? [];
                if (!components.length) return null;
                return (
                  <section key={type.id} className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <h4 className="text-xl font-bold text-gray-950">{type.label}</h4>
                        <p className="text-sm font-semibold text-gray-500">Indices cadastrados deste tipo.</p>
                      </div>
                      <span className="audit-badge bg-gray-100 text-gray-700">{components.length} indices</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {components.map((component) => (
                        <article
                          key={component.id}
                          className={`rounded-md border bg-white p-3 text-left transition ${
                            component.id === selectedTemplate?.id ? "border-cicopal-blue shadow-soft" : "border-gray-200 hover:border-cicopal-blue"
                          }`}
                        >
                          <button type="button" className="w-full text-left" onClick={() => setSelectedTemplateId(component.id)}>
                            <span className="block text-base font-bold text-gray-950">{component.name}</span>
                            <span className="text-xs font-semibold text-gray-500">
                              {component.section} - {fieldTypeLabel(component.type)}
                            </span>
                          </button>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {component.defaultMode === "tag" && component.defaultTag ? <span className="audit-badge bg-blue-100 text-cicopal-blue">Tag</span> : null}
                            {component.defaultMode === "lista" && component.valueList ? <span className="audit-badge bg-gray-900 text-white">Lista</span> : null}
                            {component.useLineRules ? <span className="audit-badge bg-yellow-100 text-yellow-800">Por linha</span> : null}
                            {component.type === "c_nc" ? <span className="audit-badge bg-red-100 text-cicopal-red">NC automatica</span> : null}
                          </div>
                          <button
                            type="button"
                            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-cicopal-blue bg-blue-50 px-3 font-bold text-cicopal-blue"
                            onClick={() => openEditIndex(component)}
                          >
                            Alterar indice
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}

              <section className="rounded-md border border-gray-200 bg-white p-3 shadow-soft">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h4 className="text-xl font-bold text-gray-950">Listas de valores</h4>
                    <p className="text-sm font-semibold text-gray-500">Listas tambem sao indices reutilizaveis.</p>
                  </div>
                  <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cicopal-blue px-3 font-bold text-white" onClick={addValueList}>
                    <Plus size={18} />
                    Nova lista
                  </button>
                </div>
                <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="grid gap-2">
                    {valueLists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        className={`rounded-md border p-3 text-left transition ${list.id === selectedList?.id ? "border-cicopal-blue bg-blue-50 shadow-soft" : "border-gray-200 bg-gray-50 hover:border-cicopal-blue hover:bg-white"}`}
                        onClick={() => setSelectedListId(list.id)}
                      >
                        <span className="block font-bold text-gray-950">{list.label}</span>
                        <span className="text-sm font-semibold text-gray-500">{list.values.length} valores</span>
                      </button>
                    ))}
                  </div>
                  {selectedList ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <label>
                        <FieldLabel>Nome da lista</FieldLabel>
                        <ConfigInput value={selectedList.label} onChange={(event) => updateValueList(selectedList.id, "label", event.target.value)} />
                      </label>
                      <label className="mt-3 block">
                        <FieldLabel>Valores, um por linha</FieldLabel>
                        <textarea
                          className="min-h-36 w-full rounded-md border border-gray-300 bg-white p-3 font-semibold"
                          value={selectedList.values.join("\n")}
                          onChange={(event) => updateValueListValues(selectedList.id, event.target.value)}
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedList.values.map((value) => (
                          <span key={value} className="audit-badge bg-white text-gray-700">
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </main>
        </div>
      ) : null}
      {activeStep === "nao_conformidade" ? (
        <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-gray-950">Nao conformidades</h3>
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cicopal-blue px-3 font-bold text-white" onClick={addNcType}>
                <Plus size={18} />
                Nova
              </button>
            </div>
            <div className="grid gap-2">
              {ncTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`rounded-md border p-3 text-left ${type.id === selectedNcType?.id ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                  onClick={() => setSelectedNcTypeId(type.id)}
                >
                  <span className="block font-bold text-gray-950">{type.name}</span>
                  <span className="text-xs font-semibold text-gray-500">{type.indexIds.length} indices vinculados</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-3">
            {selectedNcType ? (
              <div className="space-y-4">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-xl font-bold text-gray-950">Configuracao da NC</h3>
                  <p className="text-sm font-semibold text-gray-500">Defina quais indices compoem essa nao conformidade.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <FieldLabel>Nome da NC</FieldLabel>
                    <ConfigInput value={selectedNcType.name} onChange={(event) => updateNcType("name", event.target.value)} />
                  </label>
                  <label>
                    <FieldLabel>Secao sugerida</FieldLabel>
                    <ConfigInput value={selectedNcType.section} onChange={(event) => updateNcType("section", event.target.value)} />
                  </label>
                </div>

                <section className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-3">
                    <h4 className="text-lg font-bold text-gray-950">Indices C / NC vinculados</h4>
                    <p className="text-sm font-semibold text-gray-500">Somente indices C / NC aparecem aqui, pois eles geram NC automaticamente.</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {cncIndexes.map((index) => (
                      <label key={index.id} className="flex min-h-12 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 font-bold text-gray-700">
                        <input
                          type="checkbox"
                          className="size-6"
                          checked={selectedNcType.indexIds.includes(index.id)}
                          onChange={() => toggleNcIndex(index.id)}
                        />
                        <span>
                          <span className="block">{index.name}</span>
                          <span className="text-xs font-semibold text-gray-500">{index.section}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 p-8 text-center font-bold text-gray-500">
                Crie ou selecione uma NC.
              </div>
            )}
          </section>
        </div>
      ) : null}
      <AddComponentDialog
        open={Boolean(addComponentSection)}
        section={addComponentSection}
        components={componentLibrary}
        onClose={() => setAddComponentSection("")}
        onSelect={addTemplateToSection}
      />
      <IndexDialog
        draft={indexDraft}
        lines={lines}
        lists={valueLists}
        onChange={updateIndexDraft}
        onLineRuleChange={updateIndexDraftLineRule}
        onClose={() => setIndexDraft(null)}
        onSave={saveIndexDraft}
      />
    </section>
  );
}
