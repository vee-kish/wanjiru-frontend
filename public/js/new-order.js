/* ============================================================
   new-order.js — New order form, supplier load, duplicate check
   ============================================================ */

if (!Auth.guard()) {
  // redirected
} else {
  initNewOrder();
}

let SUPPLIERS = [];
let ACTIVE_ORDERS = [];

function initNewOrder() {
  const user = Auth.getUser();
  if (user && user.name) document.getElementById("greeting").textContent = `Hello, ${user.name}`;
  document.getElementById("dateDisplay").textContent = new Date().toLocaleDateString("en-KE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  document.getElementById("hamburger").addEventListener("click", () => {
    sidebar.classList.add("open"); overlay.classList.add("open");
  });
  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open"); overlay.classList.remove("open");
  });

  document.getElementById("clearBtn").addEventListener("click", clearForm);
  document.getElementById("orderForm").addEventListener("submit", submitOrder);

  // Live duplicate detection as the user types/selects.
  document.getElementById("supplier").addEventListener("change", checkDuplicate);
  document.getElementById("item").addEventListener("input", checkDuplicate);

  loadFormData();
}

async function loadFormData() {
  try {
    [SUPPLIERS, ACTIVE_ORDERS] = await Promise.all([SuppliersAPI.list(), OrdersAPI.list()]);
    const select = document.getElementById("supplier");
    select.innerHTML = `<option value="">Select a supplier…</option>` +
      SUPPLIERS.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  } catch (err) {
    showToast(err.message || "Failed to load suppliers/orders.", "error");
  }
}

/* ---------- Duplicate detection ---------- */
function checkDuplicate() {
  const supplierId = document.getElementById("supplier").value;
  const itemRaw = document.getElementById("item").value.trim().toLowerCase();
  const alertEl = document.getElementById("dupAlert");
  const msg = document.getElementById("dupAlertMsg");

  if (!supplierId || !itemRaw) {
    alertEl.classList.add("is-hidden");
    return;
  }

  const supplier = SUPPLIERS.find((s) => String(s.id) === String(supplierId));
  const now = Date.now();
  const WINDOW = 48 * 60 * 60 * 1000; // 48 hours

  const match = ACTIVE_ORDERS.find((o) => {
    const active = o.status === "pending" || o.status === "confirmed";
    const sameSupplier = (o.supplier_id && String(o.supplier_id) === String(supplierId)) ||
      (supplier && o.supplier_name === supplier.name);
    const sameItem = o.item && o.item.toLowerCase().includes(itemRaw);
    let within = false;
    const created = new Date(String(o.created_at || o.expected_date || "").replace(" ", "T"));
    if (!isNaN(created.getTime())) within = (now - created.getTime()) <= WINDOW;
    return active && sameSupplier && sameItem && within;
  });

  if (match) {
    msg.textContent =
      `Notice: A pending order for this item was already recorded on ${formatDate(match.created_at)}. ` +
      `Confirm this is not a duplicate order.`;
    alertEl.classList.remove("is-hidden");
  } else {
    alertEl.classList.add("is-hidden");
  }
}

/* ---------- Validation ---------- */
function validate() {
  const fields = [
    { id: "supplier", test: (v) => !!v },
    { id: "item", test: (v) => v.trim().length > 0 },
    { id: "quantity", test: (v) => Number(v) > 0 },
    { id: "unit", test: (v) => !!v },
    { id: "expected_date", test: (v) => !!v },
    { id: "cost", test: (v) => Number(v) >= 0 }
  ];

  let valid = true;
  fields.forEach((f) => {
    const el = document.getElementById(f.id);
    if (f.test(el.value)) el.classList.remove("is-invalid");
    else { el.classList.add("is-invalid"); valid = false; }
  });
  return valid;
}

/* ---------- Submit ---------- */
async function submitOrder(e) {
  e.preventDefault();
  if (!validate()) {
    showToast("Please complete the required fields.", "warning");
    return;
  }

  const supplierId = document.getElementById("supplier").value;
  const supplier = SUPPLIERS.find((s) => String(s.id) === String(supplierId));
  const payload = {
    supplier_id: Number(supplierId),
    supplier_name: supplier ? supplier.name : "",
    item: document.getElementById("item").value.trim(),
    quantity: Number(document.getElementById("quantity").value),
    unit: document.getElementById("unit").value,
    expected_date: document.getElementById("expected_date").value.replace("T", " ") + ":00",
    cost: Number(document.getElementById("cost").value),
    notes: document.getElementById("notes").value.trim()
  };

  const btn = document.getElementById("submitBtn");
  btn.disabled = true; btn.classList.add("is-loading");
  btn.innerHTML = '<span class="spinner"></span> Submitting…';

  try {
    const created = await OrdersAPI.create(payload);
    // Refresh active orders so duplicate checks stay accurate.
    ACTIVE_ORDERS = await OrdersAPI.list();
    showToast(`Order #${created.id} saved successfully.`, "success");
    clearForm();
  } catch (err) {
    showToast(err.message || "Failed to save order.", "error");
  } finally {
    btn.disabled = false; btn.classList.remove("is-loading");
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Save &amp; Submit Order';
  }
}

function clearForm() {
  ["item", "quantity", "expected_date", "cost", "notes"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("supplier").value = "";
  document.getElementById("unit").value = "";
  document.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  document.getElementById("dupAlert").classList.add("is-hidden");
}

/* ---------- Shared utils ---------- */
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}
