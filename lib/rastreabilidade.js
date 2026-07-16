export const rgCatalog = [
  {
    id: "RG.QUA.005",
    nome: "RG.QUA.005",
    descricao: "Controle de liberacao de produto",
    linkedLines: ["PUR"]
  },
  {
    id: "RG.QUA.BA.004",
    nome: "RG.QUA.BA.004",
    descricao: "Controle de liberacao de produto - Milho",
    linkedLines: ["SAL"]
  },
  {
    id: "RG.QUA.BA.003",
    nome: "RG.QUA.BA.003",
    descricao: "Controle de liberacao de produto - Rosca",
    linkedLines: ["ROS"]
  },
  {
    id: "RG.QUA.012",
    nome: "RG.QUA.012",
    descricao: "Liberacao de linha",
    linkedLines: ["PUR", "SAL", "ROS"]
  },
  {
    id: "RG.PRD.BA.004",
    nome: "RG.PRD.BA.004",
    descricao: "Parametros de processo extrusados - linha Clextral",
    linkedLines: ["SAL"],
    processos: ["extrusora_clextral"]
  },
  {
    id: "RG.PRD.BA.003",
    nome: "RG.PRD.BA.003",
    descricao: "Controle de batelada do milho",
    linkedLines: ["SAL"],
    processos: ["batelada_milho"]
  }
];

const processTemplates = {
  higienizacao: {
    id: "higienizacao",
    nome: "Higienizacao",
    frequencia: "Por setup"
  },
  produto_liberacao: {
    id: "produto_liberacao",
    nome: "Liberacao do Produto",
    frequencia: "Por horario liberado"
  },
  produto_avaliacao: {
    id: "produto_avaliacao",
    nome: "Avaliacao do Produto",
    frequencia: "Hora em hora"
  },
  processo: {
    id: "processo",
    nome: "RG - Processo",
    frequencia: "Hora em hora"
  },
  fotografico: {
    id: "fotografico",
    nome: "Registro Fotografico",
    frequencia: "Hora em hora"
  },
  extrusora_clextral: {
    id: "extrusora_clextral",
    nome: "Parametros Extrusora Clextral",
    frequencia: "Hora em hora"
  },
  batelada_milho: {
    id: "batelada_milho",
    nome: "Controle de Batelada do Milho",
    frequencia: "Por batelada"
  }
};

function makeProcesso(id, overrides = {}) {
  return {
    ...processTemplates[id],
    status: "Novo",
    avaliacoes: [],
    apontamentos: [],
    ncs: [],
    assinaturas: {
      operador: null,
      qualidade: null,
      supervisor: null
    },
    ...overrides
  };
}

function makeDraftRegistro(selection) {
  const processoId = selection.subregistroId || "higienizacao";

  return {
    id: selection.registroId,
    processoId,
    tipo: "Novo Registro",
    motivo: "Novo Registro",
    produto: "Produto informado no registro",
    marca: "",
    sabor: "",
    gramatura: "",
    setupDe: "",
    setupPara: "",
    turno: "A",
    operador: "",
    dataRegistro: "Novo registro",
    matriz: "Novo preenchimento",
    status: "Novo",
    subregistros: [makeProcesso(processoId)]
  };
}

export const rastreabilidadeTree = [
  {
    id: "PUR",
    nome: "PURURUCA",
    datas: []
  },
  {
    id: "SAL",
    nome: "SALGADINHO",
    datas: []
  },
  {
    id: "ROS",
    nome: "ROSCA",
    datas: []
  }
];

export function getInitialSelection(tree = rastreabilidadeTree) {
  const linha = tree[0];

  return {
    linhaId: linha?.id ?? "",
    dataId: "",
    documentoId: "",
    loteId: "",
    registroId: "",
    subregistroId: ""
  };
}

export function findSelection(selection, tree = rastreabilidadeTree) {
  const linha = tree.find((item) => item.id === selection.linhaId) ?? tree[0];
  const data = linha?.datas.find((item) => item.id === selection.dataId);
  const documentoPreenchido = data?.documentos.find((item) => item.id === selection.documentoId);
  const documentoCatalogo = rgCatalog.find((item) => item.id === selection.documentoId);
  const documento = documentoPreenchido ?? documentoCatalogo;
  const lotePreenchido = documentoPreenchido?.lotes.find((item) => item.id === selection.loteId);
  const lote =
    lotePreenchido ??
    (selection.loteId
      ? {
          id: selection.loteId,
          produto: "Lote do dia",
          registros: selection.registroId ? [makeDraftRegistro(selection)] : []
        }
      : undefined);
  const registroPreenchido = lotePreenchido?.registros.find((item) => item.id === selection.registroId);
  const registro =
    registroPreenchido ??
    lote?.registros.find((item) => item.id === selection.registroId) ??
    (selection.registroId ? makeDraftRegistro(selection) : undefined);
  const subregistro =
    registro?.subregistros?.find((item) => item.id === selection.subregistroId) ??
    (selection.subregistroId ? makeProcesso(selection.subregistroId) : undefined);

  return { linha, data, documento, lote, registro, subregistro };
}

export function formatDateLabel(dateId) {
  if (!dateId) return "";
  const [year, month, day] = dateId.split("-");
  return `${day}/${month}/${year}`;
}
