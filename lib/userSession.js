import { repairTextDeep } from "@/lib/textEncoding";

const SESSION_KEY = "carper_rg_logged_user";

export function loadUserSession() {
  if (typeof window === "undefined") return null;
  try {
    return repairTextDeep(
      JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null"),
    );
  } catch {
    return null;
  }
}

export function saveUserSession(user) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearUserSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}
