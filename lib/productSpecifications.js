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

export function matchSpecification(specifications, label) {
  const normalize = (value) => String(value ?? "").toLocaleLowerCase("pt-BR").replace(/\b(do|da|de)\b/g, "").replace(/\s+/g, " ").trim();
  const normalized = normalize(label);
  return specifications?.find(
    (item) => normalize(item.name) === normalized,
  );
}
