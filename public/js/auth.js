/* ============================================================
   auth.js — Token/session storage, login, logout, route guard
   ============================================================ */

const TOKEN_KEY = "wb_token";
const USER_KEY = "wb_user";

const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (_) {
      return null;
    }
  },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  isAuthenticated() {
    return !!this.getToken();
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "index.html";
  },
  /* Redirect to login if no valid session (used by protected pages). */
  guard() {
    if (!this.isAuthenticated()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  }
};

/* ---------- Toast helper (shared) ---------- */
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const icon =
    type === "error" ? "fa-circle-exclamation" :
    type === "warning" ? "fa-triangle-exclamation" :
    type === "info" ? "fa-circle-info" : "fa-circle-check";

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${icon} toast-icon"></i><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---------- Modal helper (shared) ---------- */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}
function closeAllModals() {
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => m.classList.remove("open"));
}
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) closeAllModals();
  if (e.target.classList.contains("modal-close") || e.target.hasAttribute("data-close-modal")) {
    const backdrop = e.target.closest(".modal-backdrop");
    if (backdrop) backdrop.classList.remove("open");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllModals();
});
