export function classifyProductValue(specification, value) {
  if (value === "NA") return specification?.allowNa ? "gray" : "red";
  if (value === "" || value == null || Number.isNaN(Number(value))) return "gray";
  if (!specification) return "gray";
  const number = Number(value);
  const criticalMin = Number(specification.criticalMin);
  const idealMin = Number(specification.idealMin);
  const idealMax = Number(specification.idealMax);
  const criticalMax = Number(specification.criticalMax);
  if ([criticalMin, idealMin, idealMax, criticalMax].some(Number.isNaN)) return "gray";
  if (number < criticalMin || number > criticalMax) return "red";
  if (number < idealMin || number > idealMax) return "yellow";
  return "green";
}

export const specificationTone = {
  green: { label: "Dentro da especificação", className: "border-green-500 bg-green-50 text-green-800" },
  yellow: { label: "Faixa de atenção", className: "border-amber-400 bg-amber-50 text-amber-900" },
  red: { label: "Fora da especificação", className: "border-red-500 bg-red-50 text-red-800" },
  gray: { label: "Sem classificação", className: "border-gray-300 bg-gray-100 text-gray-600" },
};

const testRanges = {
  "umidade produto final": [1.5, 2, 4, 5],
  "ph biscoito": [6, 6.5, 7.5, 8],
  "temperatura envase": [25, 30, 38, 42],
  "brix acucar invertido": [70, 72, 78, 80],
  "ph acucar invertido": [4, 4.5, 5.5, 6],
  sal: [0.8, 1, 2, 2.4],
  densidade: [80, 90, 120, 130],
};

function normalizedLabel(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\b(do|da|de)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeTestSpecifications(columns = []) {
  return columns.map((column, index) => {
    const name = column.name ?? column.label;
    const range = testRanges[normalizedLabel(name)] ?? [0, 10, 20, 30];
    return {
      id: `${normalizedLabel(name).replace(/\W+/g, "-")}-${index}`,
      name,
      unit: column.unit ?? "",
      criticalMin: String(range[0]),
      idealMin: String(range[1]),
      idealMax: String(range[2]),
      criticalMax: String(range[3]),
      allowNa: true,
      testData: true,
    };
  });
}

export function matchSpecification(specifications, label) {
  const normalized = normalizedLabel(label);
  return specifications?.find(
    (item) => normalizedLabel(item.name) === normalized,
  );
}
