/* ============================================================
   pwa.js — Service Worker registration, install prompt,
   and online/offline toasts.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Service Worker Registration ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed:", err);
      });
    });
  }

  /* ---------- Install Prompt ---------- */
  let deferredPrompt = null;
  const installBtn = document.getElementById("installBtn");

  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent the mini-infobar from appearing on mobile.
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = "";
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          showPWAToast("App installed. Thank you!", "success");
        }
      } catch (_) {}
      deferredPrompt = null;
      installBtn.style.display = "none";
    });
  }

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (installBtn) installBtn.style.display = "none";
    showPWAToast("Wanjiru Orders installed successfully.", "success");
  });

  /* ---------- Online / Offline Toasts ---------- */
  window.addEventListener("offline", () => {
    showPWAToast("You are now offline. Some features may be limited.", "warning");
  });
  window.addEventListener("online", () => {
    showPWAToast("Back online. Syncing supplier orders…", "success");
  });

  /* ---------- Helpers ---------- */
  function showPWAToast(message, type) {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const icon =
      type === "warning" ? "fa-triangle-exclamation" : "fa-circle-check";
    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML =
      `<i class="fa-solid ${icon} toast-icon"></i><span class="toast-msg">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
})();
