type ReservedDownloadTarget = {
  popup: Window | null;
  fileName: string;
};

const SAFARI_RE = /^((?!chrome|android|crios|fxios|edgios).)*safari/i;

export function reserveDownloadTarget(fileName: string): ReservedDownloadTarget {
  const shouldReservePopup = isSafariBrowser();
  if (!shouldReservePopup) return { popup: null, fileName };

  const popup = window.open("", "_blank");
  if (!popup) return { popup: null, fileName };

  try {
    popup.document.title = `Baixar ${fileName}`;
    popup.document.body.innerHTML = `<main style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #232323;"><h1 style="font-size: 18px; margin: 0 0 8px;">Preparando download...</h1><p style="font-size: 14px; margin: 0;">Aguarde alguns segundos.</p></main>`;
    popup.opener = null;
  } catch {
    // If Safari blocks document access, the reserved tab can still be navigated later.
  }

  return { popup, fileName };
}

export async function downloadFileFromUrl(url: string, fileName: string, target?: ReservedDownloadTarget) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Não foi possível baixar o arquivo.");

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, fileName, target);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    openDownloadFallback(url, fileName, target);
  }
}

function triggerDownload(url: string, fileName: string, target?: ReservedDownloadTarget) {
  const popup = target?.popup;
  if (popup && !popup.closed) {
    try {
      popup.document.title = `Baixar ${fileName}`;
      popup.document.body.innerHTML = `<main style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #232323;"><h1 style="font-size: 18px; margin: 0 0 12px;">Download pronto</h1><p style="font-size: 14px; margin: 0 0 16px;">Se o download não começar automaticamente, toque no botão abaixo.</p></main>`;
      const link = popup.document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.textContent = "Baixar arquivo";
      link.style.cssText = "display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:8px;background:#628A4C;color:#fff;text-decoration:none;font:600 14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
      popup.document.querySelector("main")?.appendChild(link);
      link.click();
      return;
    } catch {
      popup.location.href = url;
      return;
    }
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openDownloadFallback(url: string, fileName: string, target?: ReservedDownloadTarget) {
  const popup = target?.popup;
  if (popup && !popup.closed) {
    try {
      popup.document.title = `Baixar ${fileName}`;
      popup.document.body.innerHTML = `<main style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #232323;"><h1 style="font-size: 18px; margin: 0 0 12px;">Abrir arquivo</h1><p style="font-size: 14px; margin: 0 0 16px;">Toque no botão abaixo para abrir ou salvar o arquivo.</p></main>`;
      const link = popup.document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.textContent = "Abrir arquivo";
      link.style.cssText = "display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:8px;background:#628A4C;color:#fff;text-decoration:none;font:600 14px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
      popup.document.querySelector("main")?.appendChild(link);
      link.click();
      return;
    } catch {
      popup.location.href = url;
      return;
    }
  }

  window.open(url, "_blank", "noopener");
}

function isSafariBrowser() {
  const ua = navigator.userAgent;
  return SAFARI_RE.test(ua) || /iPad|iPhone|iPod/.test(ua);
}