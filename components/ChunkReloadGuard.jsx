"use client";

import { useEffect } from "react";

export function isChunkLoadFailure(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed")
  );
}

export function recoverFromChunkFailure(error) {
  if (!isChunkLoadFailure(error) || typeof window === "undefined") return false;

  const key = "carper_chunk_reload_attempted_at";
  const lastAttempt = Number(sessionStorage.getItem(key) ?? 0);
  const now = Date.now();
  if (now - lastAttempt < 30_000) return false;

  sessionStorage.setItem(key, String(now));
  const url = new URL(window.location.href);
  url.searchParams.set("carper_refresh", String(now));
  window.location.replace(url.toString());
  return true;
}

export function ChunkReloadGuard() {
  useEffect(() => {
    function handleError(event) {
      recoverFromChunkFailure(event.error ?? event.message);
    }

    function handleUnhandledRejection(event) {
      recoverFromChunkFailure(event.reason);
    }

    // Se este componente montou, o JavaScript da versão atual carregou.
    // Retiramos apenas o marcador visual da URL sem provocar outro reload.
    const url = new URL(window.location.href);
    if (url.searchParams.has("carper_refresh")) {
      url.searchParams.delete("carper_refresh");
      window.history.replaceState({}, "", url.toString());
    }
    const clearAttempt = window.setTimeout(
      () => sessionStorage.removeItem("carper_chunk_reload_attempted_at"),
      10_000,
    );

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.clearTimeout(clearAttempt);
    };
  }, []);

  return null;
}
