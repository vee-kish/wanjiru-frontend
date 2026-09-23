/* ============================================================
   dashboard.js — Metric calculations & dashboard DOM updates
   ============================================================ */

if (!Auth.guard()) {
  // guard() already redirected; stop further execution.
} else {
  initDashboard();
}

function initDashboard() {
  /* ---------- User greeting & date ---------- */
  const user = Auth.getUser();
  if (user && user.name) {
    document.getElementById("greeting").textContent = `Hello, ${user.name}`;
  }

  const now = new Date();
  document.getElementById("dateDisplay").textContent =
    now.toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  /* ---------- Mobile drawer ---------- */
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const hamburger = document.getElementById("hamburger");
  hamburger.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  });

  /* ---------- Print / export summary ---------- */
  document.getElementById("printSummary").addEventListener("click", () => {
    showToast("Preparing daily summary for print…", "info");
    setTimeout(() => window.print(), 500);
  });

  loadDashboard();
}

async function loadDashboard() {
  try {
    const orders = await OrdersAPI.list();
    renderMetrics(orders);
    renderRecent(orders);
  } catch (err) {
    showToast(err.message || "Failed to load dashboard data.", "error");
    document.getElementById("recentBody").innerHTML =
      `<tr><td colspan="6" class="text-muted">Could not load orders.</td></tr>`;
  }
}

function renderMetrics(orders) {
  const today = new Date().toISOString().slice(0, 10);
  const total = orders.length;
  const pending = orders.filter((o) => o.status === "pending").length;
  const confirmed = orders.filter((o) => o.status === "confirmed").length;
  const deliveredToday = orders.filter(
    (o) => o.status === "delivered" && String(o.created_at || o.expected_date || "").slice(0, 10) === today
  ).length;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiPending").textContent = pending;
  document.getElementById("kpiConfirmed").textContent = confirmed;
  document.getElementById("kpiDeliveredToday").textContent = deliveredToday;
}

function renderRecent(orders) {
  const body = document.getElementById("recentBody");
  const latest = orders.slice(0, 5);

  if (!latest.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
            <h3>No orders yet</h3>
            <p>Place your first supplier order to see it here.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  body.innerHTML = latest
    .map(
      (o) => `
      <tr data-status="${o.status}">
        <td class="cell-mono">#ORD-${o.id}</td>
        <td>${escapeHtml(o.supplier_name || "—")}</td>
        <td>${escapeHtml(o.item)} <span class="text-muted">(${o.quantity} ${escapeHtml(o.unit || "")})</span></td>
        <td class="nowrap">${formatDate(o.expected_date)}</td>
        <td class="cell-cost">${money(o.cost)}</td>
        <td>${statusBadge(o.status)}</td>
      </tr>`
    )
    .join("");
}

/* ---------- Shared utils ---------- */
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}
