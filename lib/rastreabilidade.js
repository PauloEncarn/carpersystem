export const rgCatalog = [
  {
    id: "RG.QUA.005",
    nome: "RG.QUA.005",
    descricao: "Controle de liberacao de produto - Pururuca"
  },
  {
    id: "RG.QUA.012",
    nome: "RG.QUA.012",
    descricao: "Liberacao de linha"
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
  }
};

function makeProcesso(id, overrides = {}) {
  return {
    ...processTemplates[id],
    status: "Novo",
    avaliacoes: [],
    apontamentos: [],
    ncs: [],
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
    operador: "Operador logado",
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
    datas: [
      {
        id: "2026-04-14",
        label: "14/04/2026",
        documentos: [
          {
            id: "RG.QUA.005",
            nome: "RG.QUA.005",
            descricao: "Controle de liberacao de produto - Pururuca",
            lotes: [
              {
                id: "PUR-14042026",
                produto: "Lote do dia",
                registros: [
                  {
                    id: "RG005-PUR-14042026-HG001",
                    processoId: "higienizacao",
                    tipo: "Troca de Sabor",
                    motivo: "Troca de sabor/produto",
                    produto: "Cebola para Churrasco",
                    setupDe: "Cebola",
                    setupPara: "Bacon",
                    turno: "A",
                    operador: "Marcos Silva",
                    dataRegistro: "2026-04-14 08:12",
                    matriz: "De Cebola para Bacon",
                    status: "Rascunho",
                    subregistros: [
                      makeProcesso("higienizacao", {
                        status: "NC",
                        avaliacoes: [
                          { item: "Silo vibratorio", av1: "C", av2: "" },
                          { item: "Fritador", av1: "C", av2: "" },
                          { item: "Tambor fritador", av1: "NC", av2: "C" },
                          { item: "Empacotadora 1", av1: "C", av2: "" }
                        ],
                        ncs: [
                          {
                            id: "NC-018",
                            item: "Tambor fritador",
                            horario: "08:22",
                            produto: "Cebola para Churrasco",
                            quantidade: "1 equipamento",
                            descricao: "Residuo visual encontrado apos higienizacao inicial.",
                            causa: "Tempo insuficiente de limpeza no setup",
                            acao: "Rehigienizacao e reinspecao do equipamento",
                            disposicaoImediata: "Bloqueado",
                            disposicaoFinal: "Liberado apos 2 AV conforme",
                            fotoPath: "/uploads/nc-018.jpg",
                            operador: "Marcos Silva",
                            status: "Pendente",
                            assinaturaSupervisorAt: null,
                            assinaturaSupervisorUserId: null
                          }
                        ]
                      })
                    ]
                  },
                  {
                    id: "RG005-PUR-14042026-HG002",
                    processoId: "higienizacao",
                    tipo: "Inicio de Semana",
                    motivo: "Inicio de producao semana",
                    produto: "Cebola para Churrasco",
                    setupDe: "",
                    setupPara: "Cebola",
                    turno: "B",
                    operador: "Ana Costa",
                    dataRegistro: "2026-04-14 13:47",
                    matriz: "Linha parada para setup semanal",
                    status: "Conforme",
                    subregistros: [
                      makeProcesso("higienizacao", {
                        status: "Conforme",
                        avaliacoes: [
                          { item: "Sala de preparacao do aroma", av1: "C", av2: "" },
                          { item: "Exaustor", av1: "C", av2: "" },
                          { item: "Piso fritador", av1: "C", av2: "" },
                          { item: "Fritador", av1: "C", av2: "" }
                        ]
                      })
                    ]
                  },
                  {
                    id: "RG005-PUR-14042026-LIBP001",
                    processoId: "produto_liberacao",
                    tipo: "Liberacao do Produto",
                    motivo: "Liberacao do Produto",
                    produto: "Cebola para Churrasco",
                    marca: "Cicopal",
                    sabor: "Cebola",
                    gramatura: "45g",
                    turno: "A",
                    operador: "Marcos Silva",
                    dataRegistro: "2026-04-14 08:00",
                    matriz: "Produto Cebola",
                    status: "Em andamento",
                    subregistros: [
                      makeProcesso("produto_liberacao", {
                        status: "NC",
                        apontamentos: [
                          {
                            horario: "08:00",
                            item: "Liberacao do Produto",
                            operador: "Marcos Silva",
                            saborOdor: "C",
                            textura: "C",
                            aspectoVisual: "C",
                            pesoPacote: "C",
                            selagem: "NC",
                            datador: "C",
                            impressao: "C",
                            microfuroMaquina1: "C",
                            temperaturaOleo: "C",
                            tempoResidencia: "C",
                            resultado: "NC"
                          },
                          {
                            horario: "11:30",
                            item: "Liberacao do Produto",
                            operador: "Ana Costa",
                            saborOdor: "C",
                            textura: "C",
                            aspectoVisual: "C",
                            pesoPacote: "C",
                            selagem: "C",
                            datador: "C",
                            impressao: "C",
                            microfuroMaquina1: "C",
                            temperaturaOleo: "C",
                            tempoResidencia: "C",
                            resultado: "C"
                          }
                        ],
                        ncs: [
                          {
                            id: "NC-033",
                            item: "Selagem",
                            horario: "10:00",
                            produto: "Cebola para Churrasco",
                            quantidade: "12 pacotes",
                            descricao: "Falha de selagem identificada no controle horario.",
                            causa: "Oscilacao de temperatura na empacotadora",
                            acao: "Ajuste de temperatura e segregacao dos pacotes",
                            disposicaoImediata: "Bloqueado",
                            disposicaoFinal: "Reprocesso aprovado pela qualidade",
                            fotoPath: "/uploads/nc-033.jpg",
                            operador: "Ana Costa",
                            status: "Pendente",
                            assinaturaSupervisorAt: null,
                            assinaturaSupervisorUserId: null
                          }
                        ]
                      })
                    ]
                  },
                  {
                    id: "RG005-PUR-14042026-AVP001",
                    processoId: "produto_avaliacao",
                    tipo: "Avaliacao do Produto",
                    motivo: "Avaliacao do Produto",
                    produto: "Cebola para Churrasco",
                    marca: "Cicopal",
                    sabor: "Cebola",
                    gramatura: "45g",
                    turno: "A",
                    operador: "Marcos Silva",
                    dataRegistro: "2026-04-14 08:00",
                    matriz: "Produto Cebola",
                    status: "Em andamento",
                    subregistros: [
                      makeProcesso("produto_avaliacao", {
                        status: "NC",
                        apontamentos: [
                          { horario: "08:00", item: "Avaliacao do produto", operador: "Marcos Silva", umidadeProdutoFinal: "C", sal: "C", temperaturaEnvase: "C", resultado: "C" },
                          { horario: "09:00", item: "Avaliacao do produto", operador: "Marcos Silva", umidadeProdutoFinal: "C", sal: "C", temperaturaEnvase: "C", resultado: "C" },
                          { horario: "10:00", item: "Avaliacao do produto", operador: "Ana Costa", umidadeProdutoFinal: "C", sal: "NC", temperaturaEnvase: "C", resultado: "NC" }
                        ],
                        ncs: [
                          {
                            id: "NC-034",
                            item: "Sal",
                            horario: "10:00",
                            produto: "Cebola para Churrasco",
                            quantidade: "Amostra horaria",
                            descricao: "Sal fora do padrao na avaliacao horaria.",
                            causa: "Dosagem de tempero instavel",
                            acao: "Ajuste de dosagem e nova coleta",
                            disposicaoImediata: "Bloqueado",
                            disposicaoFinal: "Liberado apos nova avaliacao",
                            fotoPath: "/uploads/nc-034.jpg",
                            operador: "Ana Costa",
                            status: "Pendente",
                            assinaturaSupervisorAt: null,
                            assinaturaSupervisorUserId: null
                          }
                        ]
                      })
                    ]
                  },
                  {
                    id: "RG005-PUR-14042026-RGP001",
                    processoId: "processo",
                    tipo: "Liberacao de Processo",
                    motivo: "Inicio de producao",
                    produto: "Cebola para Churrasco",
                    turno: "A",
                    operador: "Adrisia Souza",
                    dataRegistro: "2026-04-14 07:30",
                    matriz: "Inicio de producao",
                    status: "Conforme",
                    subregistros: [
                      makeProcesso("processo", {
                        status: "Conforme",
                        apontamentos: [
                          { horario: "08:00", item: "Controle de processo", operador: "Adrisia Souza", resultado: "C" },
                          { horario: "09:00", item: "Controle de processo", operador: "Adrisia Souza", resultado: "C" },
                          { horario: "10:00", item: "Controle de processo", operador: "Marcos Silva", resultado: "C" }
                        ]
                      })
                    ]
                  },
                  {
                    id: "RG005-PUR-14042026-REGF001",
                    processoId: "fotografico",
                    tipo: "Registro Fotografico",
                    motivo: "Registro visual hora a hora",
                    produto: "Cebola para Churrasco",
                    turno: "A",
                    operador: "Marcos Silva",
                    dataRegistro: "2026-04-14 08:00",
                    matriz: "Produto Cebola",
                    status: "Pendente",
                    subregistros: [
                      makeProcesso("fotografico", {
                        status: "Pendente",
                        apontamentos: [
                          { horario: "08:00", operador: "Marcos Silva", fotoPath: "/uploads/foto-0800.jpg" },
                          { horario: "09:00", operador: "Marcos Silva", fotoPath: "/uploads/foto-0900.jpg" },
                          { horario: "10:00", operador: "Ana Costa", fotoPath: null }
                        ]
                      })
                    ]
                  },
                  {
                    id: "RG005-PUR-14042026-HG003",
                    processoId: "higienizacao",
                    tipo: "Troca de Sabor",
                    motivo: "Troca de sabor/produto",
                    produto: "Churrasco para Bacon",
                    setupDe: "Churrasco",
                    setupPara: "Bacon",
                    turno: "B",
                    operador: "Ana Costa",
                    dataRegistro: "2026-04-14 15:20",
                    matriz: "De Churrasco para Bacon",
                    status: "Conforme",
                    subregistros: [
                      makeProcesso("higienizacao", {
                        status: "Conforme",
                        avaliacoes: [
                          { item: "Silo vibratorio", av1: "C", av2: "" },
                          { item: "Fritador", av1: "C", av2: "" }
                        ]
                      })
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: "RG.QUA.012",
            nome: "RG.QUA.012",
            descricao: "Liberacao de linha",
            lotes: [
              {
                id: "PUR-14042026",
                produto: "Lote do dia",
                registros: [
                  {
                    id: "RG012-PUR-14042026-RGP001",
                    processoId: "processo",
                    tipo: "Liberacao de Linha",
                    motivo: "Liberacao de Linha",
                    produto: "Linha liberada",
                    turno: "A",
                    operador: "Adrisia Souza",
                    dataRegistro: "2026-04-14 09:10",
                    matriz: "Linha liberada",
                    status: "Conforme",
                    subregistros: [makeProcesso("processo", { status: "Conforme" })]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "2026-04-15",
        label: "15/04/2026",
        documentos: [
          {
            id: "RG.QUA.005",
            nome: "RG.QUA.005",
            descricao: "Controle de liberacao de produto - Pururuca",
            lotes: [
              {
                id: "PUR-15042026",
                produto: "Lote do dia",
                registros: [
                  {
                    id: "RG005-PUR-15042026-HG001",
                    processoId: "higienizacao",
                    tipo: "Troca de Sabor",
                    motivo: "Troca de sabor/produto",
                    produto: "Bacon para Cebola",
                    setupDe: "Bacon",
                    setupPara: "Cebola",
                    turno: "C",
                    operador: "Jonathas Nascimento",
                    dataRegistro: "2026-04-15 22:05",
                    matriz: "De Bacon para Cebola",
                    status: "Em aberto",
                    subregistros: [makeProcesso("higienizacao", { status: "Em aberto" })]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "SAL",
    nome: "SALGADINHO",
    datas: [
      {
        id: "2026-04-14",
        label: "14/04/2026",
        documentos: [
          {
            id: "RG.QUA.005",
            nome: "RG.QUA.005",
            descricao: "Controle de liberacao de produto",
            lotes: [
              {
                id: "SAL-14042026",
                produto: "Lote do dia",
                registros: [
                  {
                    id: "RG005-SAL-14042026-HG001",
                    processoId: "higienizacao",
                    tipo: "Troca de Sabor",
                    motivo: "Troca de sabor/produto",
                    produto: "Queijo para Presunto",
                    setupDe: "Queijo",
                    setupPara: "Presunto",
                    turno: "B",
                    operador: "Priscila Martins",
                    dataRegistro: "2026-04-14 14:20",
                    matriz: "De Queijo para Presunto",
                    status: "Conforme",
                    subregistros: [makeProcesso("higienizacao", { status: "Conforme" })]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "ROS",
    nome: "ROSCA",
    datas: [
      {
        id: "2026-04-13",
        label: "13/04/2026",
        documentos: [
          {
            id: "RG.QUA.005",
            nome: "RG.QUA.005",
            descricao: "Controle de liberacao de produto",
            lotes: [
              {
                id: "ROS-13042026",
                produto: "Lote do dia",
                registros: [
                  {
                    id: "RG005-ROS-13042026-HG001",
                    processoId: "higienizacao",
                    tipo: "Troca de Sabor",
                    motivo: "Troca de sabor/produto",
                    produto: "Natural para Picante",
                    setupDe: "Natural",
                    setupPara: "Picante",
                    turno: "A",
                    operador: "Rafael Lima",
                    dataRegistro: "2026-04-13 07:58",
                    matriz: "De Natural para Picante",
                    status: "NC",
                    subregistros: [
                      makeProcesso("higienizacao", {
                        status: "NC",
                        avaliacoes: [{ item: "Esteira saida da calha", av1: "NC", av2: "C" }],
                        ncs: [
                          {
                            id: "NC-027",
                            item: "Esteira saida da calha",
                            horario: "08:05",
                            produto: "Natural para Picante",
                            quantidade: "Area isolada",
                            descricao: "Ponto com residuo antes da liberacao final.",
                            causa: "Falha de alcance na higienizacao",
                            acao: "Nova limpeza localizada e treinamento do operador",
                            disposicaoImediata: "Bloqueado",
                            disposicaoFinal: "Tratada",
                            fotoPath: "/uploads/nc-027.jpg",
                            operador: "Rafael Lima",
                            status: "Tratada",
                            assinaturaSupervisorAt: "2026-04-13 09:20",
                            assinaturaSupervisorUserId: "SUP-001"
                          }
                        ]
                      })
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

export function getInitialSelection(tree = rastreabilidadeTree) {
  const linha = tree[0];
  const data = linha?.datas[0];
  const documento = data?.documentos[0];
  const lote = documento?.lotes[0];
  const registro = lote?.registros[0];
  const subregistro = registro?.subregistros[0];

  return {
    linhaId: linha?.id ?? "",
    dataId: data?.id ?? "",
    documentoId: documento?.id ?? "",
    loteId: lote?.id ?? "",
    registroId: registro?.id ?? "",
    subregistroId: subregistro?.id ?? ""
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
  const registro = registroPreenchido ?? lote?.registros.find((item) => item.id === selection.registroId) ?? (selection.registroId ? makeDraftRegistro(selection) : undefined);
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
