export const checklistGroups = [
  {
    id: "sem-contato",
    title: "SEM CONTATO COM O PRODUTO",
    items: [
      "Sala de preparacao do aroma",
      "Exaustor",
      "Piso fritador",
      "Coifa exaustor fritador",
      "Tanque de oleo 01",
      "Tanque de oleo 02",
      "Paineis eletricos externo",
      "Calhas eletricas",
      "Tubulacoes de agua, ar e gas",
      "Container de residuos",
      "Piso area",
      "Utensilios",
      "Paredes",
      "Selador de fardos",
      "DML",
      "Paletes limpos",
      "Escada da plataforma"
    ]
  },
  {
    id: "zona-produto",
    title: "EM CONTATO COM O PRODUTO",
    items: [
      "Silo vibratorio",
      "Esteira de Elevacao",
      "Fritador",
      "Tambor fritador",
      "Escorredor vibratorio",
      "Tambor de aromatizacao",
      "Esteira saida do tambor",
      "Calha de inspecao",
      "Esteira saida da calha",
      "Empacotadora 1",
      "Empacotadora 2",
      "Prato cacamba e balanca empacotadora 01",
      "Prato cacamba e balanca empacotadora 02",
      "Esteira"
    ]
  }
];

export function generateLoteId(line, date) {
  const parsedDate = date ? new Date(`${date}T00:00:00`) : new Date();
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const year = parsedDate.getFullYear();

  return `${line}-${day}${month}${year}`;
}
