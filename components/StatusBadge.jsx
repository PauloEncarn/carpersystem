export function StatusBadge({ tone = "blue", children }) {
  const tones = {
    blue: "bg-cicopal-blue text-white",
    green: "bg-cicopal-green text-white",
    red: "bg-cicopal-red text-white",
    gray: "bg-gray-200 text-gray-800"
  };

  return (
    <span className={`inline-flex min-h-8 items-center rounded-md px-3 text-sm font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}
