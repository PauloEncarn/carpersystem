"use client";

import { useEffect } from "react";

function isChunkLoadFailure(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed")
  );
}

export function ChunkReloadGuard() {
  useEffect(() => {
    function reloadOnce(error) {
      if (!isChunkLoadFailure(error)) return;

      const key = "carper_chunk_reload_attempted";
      if (sessionStorage.getItem(key) === "1") return;

      sessionStorage.setItem(key, "1");
      window.location.reload();
    }

    function handleError(event) {
      reloadOnce(event.error ?? event.message);
    }

    function handleUnhandledRejection(event) {
      reloadOnce(event.reason);
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}

