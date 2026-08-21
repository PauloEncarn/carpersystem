export const PROFILE_ACCESS = {
  operador: { operation: true, qualityRg: false, productionRg: true, supervision: false, reports: false },
  tecnico: { operation: true, qualityRg: true, productionRg: false, supervision: false, reports: false },
  qualidade: { operation: true, qualityRg: true, productionRg: false, supervision: false, reports: false },
  supervisao: { operation: true, qualityRg: true, productionRg: true, supervision: true, reports: true },
  supervisor: { operation: true, qualityRg: true, productionRg: true, supervision: true, reports: true },
  configurador: { operation: true, qualityRg: true, productionRg: true, supervision: false, reports: false },
  admin: { operation: true, qualityRg: true, productionRg: true, supervision: true, reports: true },
};

export function accessFor(user) {
  const code = user?.perfil?.codigo ?? "operador";
  const base = PROFILE_ACCESS[code] ?? PROFILE_ACCESS.operador;
  const permissions = new Set(user?.permissoes ?? []);
  return {
    ...base,
    supervision: base.supervision || permissions.has("supervisao:acessar") || permissions.has("admin:acessar"),
    reports: base.reports || permissions.has("relatorios:acessar") || permissions.has("admin:acessar"),
  };
}

export function documentsForProfile(profileCode, documents) {
  const access = PROFILE_ACCESS[profileCode] ?? PROFILE_ACCESS.operador;
  return documents.filter((document) => {
    const production = document.id.startsWith("RG.PROD.");
    return production ? access.productionRg : access.qualityRg;
  });
}
