export function CicopalLogo({
  className = "h-11 w-auto",
  priority = false,
  light = false,
}) {
  return (
    <img
      src={
        light ? "/images/logo-cicopal-white.png" : "/images/logo-cicopal.png"
      }
      alt="Cicopal"
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
