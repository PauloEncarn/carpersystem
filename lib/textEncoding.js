const mojibakeMap = new Map([
  ["Ã¡", "á"],
  ["Ã ", "à "],
  ["Ãà", "à"],
  ["Ã¢", "â"],
  ["Ã£", "ã"],
  ["Ã¤", "ä"],
  ["Ã©", "é"],
  ["Ãª", "ê"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ã´", "ô"],
  ["Ãµ", "õ"],
  ["Ãº", "ú"],
  ["Ã¼", "ü"],
  ["Ã§", "ç"],
  ["Ã", "Á"],
  ["Ã€", "À"],
  ["Ã‚", "Â"],
  ["Ãƒ", "Ã"],
  ["Ã‰", "É"],
  ["ÃŠ", "Ê"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ã”", "Ô"],
  ["Ã•", "Õ"],
  ["Ãš", "Ú"],
  ["Ã‡", "Ç"],
  ["Â·", "·"],
  ["Âº", "º"],
  ["Âª", "ª"],
  ["Â ", " "],
  ["â€¢", "•"],
  ["â€“", "–"],
  ["â€”", "—"],
  ["â€œ", "“"],
  ["â€", "”"],
  ["â€˜", "‘"],
  ["â€™", "’"],
  ["â€¦", "…"],
  ["âœ“", "✓"],
  ["â†", "←"],
  ["â†’", "→"],
]);

export function repairText(value) {
  if (typeof value !== "string") return value;
  let repaired = value;
  for (const [broken, correct] of mojibakeMap) {
    repaired = repaired.split(broken).join(correct);
  }
  return repaired;
}

export function repairTextDeep(value) {
  if (typeof value === "string") return repairText(value);
  if (Array.isArray(value)) return value.map(repairTextDeep);
  if (!value || typeof value !== "object" || value instanceof Date)
    return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, repairTextDeep(item)]),
  );
}
