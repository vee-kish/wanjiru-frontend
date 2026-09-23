/* ============================================================
   api.js — Centralized fetch wrapper & base URL config
   Provides a reusable request() helper plus domain-specific
   functions for auth, orders, and suppliers.
   Falls back to mock data when the backend is unreachable so
   the UI works standalone during development/testing.
   ============================================================ */

const API_BASE = "http://localhost:5000/api";

/* ---------- Mock data store (standalone mode) ---------- */
const MOCK = {
  orders: [
    { id: 1042, supplier_name: "Unga Millers", item: "Baking Flour 50kg", quantity: 10, unit: "Bags", expected_date: "2026-08-28 09:00", status: "confirmed", cost: 18500, created_at: "2026-08-27 08:12", notes: "Deliver to back gate" },
    { id: 1041, supplier_name: "Mumias Sugar Distributor", item: "White Sugar 2kg", quantity: 5, unit: "Bales", expected_date: "2026-08-28 11:00", status: "pending", cost: 9400, created_at: "2026-08-27 07:48", notes: "" },
    { id: 1040, supplier_name: "Kencore Yeast Ltd", item: "Instant Yeast 500g", quantity: 20, unit: "Packets", expected_date: "2026-08-27 14:00", status: "delivered", cost: 6200, created_at: "2026-08-26 16:20", notes: "Invoice KY-882" },
    { id: 1039, supplier_name: "Bidco Oil", item: "Cooking Fat 20L", quantity: 8, unit: "Tins", expected_date: "2026-08-27 10:30", status: "pending", cost: 15600, created_at: "2026-08-27 06:55", notes: "" },
    { id: 1038, supplier_name: "Unga Millers", item: "Baking Flour 50kg", quantity: 6, unit: "Bags", expected_date: "2026-08-25 09:00", status: "delivered", cost: 11100, created_at: "2026-08-24 08:00", notes: "Invoice UM-5521" }
  ],
  suppliers: [
    { id: 1, name: "Unga Millers", phone: "+254722123001", email: "orders@ungamillers.co.ke", category: "Flour & Grains" },
    { id: 2, name: "Mumias Sugar Distributor", phone: "+254733445566", email: "sales@mumiasugar.co.ke", category: "Sugar" },
    { id: 3, name: "Kencore Yeast Ltd", phone: "+254711998877", email: "info@kencore.co.ke", category: "Yeast & Additives" },
    { id: 4, name: "Bidco Oil", phone: "+254720556677", email: "supply@bidco.co.ke", category: "Cooking Fat & Oil" }
  ]
};

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/* ---------- Core request wrapper ---------- */
async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };

  if (auth) {
    const token = localStorage.getItem("wb_token");
    if (token) headers["Authorization"] = "Bearer " + token;
  }

  try {
    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
      let message = "Request failed";
      try {
        const err = await res.json();
        message = err.message || message;
      } catch (_) {}
      throw new Error(message);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch (err) {
    /* When backend is offline, attempt mock fallback. */
    const mock = mockFallback(path, { method, body });
    if (mock !== undefined) return mock;
    throw err;
  }
}

/* ---------- Mock fallback router ---------- */
function mockFallback(path, { method, body }) {
  if (path === "/auth/login" && method === "POST") {
    const { email } = body || {};
    const role = /owner|admin/i.test(email || "") ? "Owner" : "Staff";
    const name = role === "Owner" ? "Mama Wanjiru" : "Bakery Staff";
    return { token: "mock-jwt-token", user: { id: 1, name, role } };
  }

  if (path === "/orders") {
    if (method === "GET") return MOCK.orders.slice();
    if (method === "POST") {
      const nextId = (MOCK.orders[0]?.id || 1042) + 1;
      const created = {
        id: nextId,
        supplier_name: body.supplier_name || "Unknown Supplier",
        item: body.item,
        quantity: body.quantity,
        unit: body.unit,
        expected_date: body.expected_date,
        status: "pending",
        cost: body.cost,
        created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
        notes: body.notes || ""
      };
      MOCK.orders.unshift(created);
      return created;
    }
  }

  const statusMatch = path.match(/^\/orders\/(\d+)\/status$/);
  if (statusMatch && method === "PUT") {
    const id = Number(statusMatch[1]);
    const o = MOCK.orders.find((x) => x.id === id);
    if (o) o.status = body.status;
    return o || {};
  }

  const delMatch = path.match(/^\/orders\/(\d+)$/);
  if (delMatch && method === "DELETE") {
    const id = Number(delMatch[1]);
    MOCK.orders = MOCK.orders.filter((x) => x.id !== id);
    return { success: true };
  }

  if (path === "/suppliers") {
    if (method === "GET") return MOCK.suppliers.slice();
    if (method === "POST") {
      const created = { id: Date.now(), ...body };
      MOCK.suppliers.push(created);
      return created;
    }
  }

  const supMatch = path.match(/^\/suppliers\/(\d+)$/);
  if (supMatch) {
    const id = Number(supMatch[1]);
    if (method === "PUT") {
      const s = MOCK.suppliers.find((x) => x.id === id);
      if (s) Object.assign(s, body);
      return s || {};
    }
    if (method === "DELETE") {
      MOCK.suppliers = MOCK.suppliers.filter((x) => x.id !== id);
      return { success: true };
    }
  }

  return undefined;
}

/* ---------- Auth API ---------- */
const AuthAPI = {
  login: (credentials) => request("/auth/login", { method: "POST", body: credentials, auth: false })
};

/* ---------- Orders API ---------- */
const OrdersAPI = {
  list: () => request("/orders"),
  create: (payload) => request("/orders", { method: "POST", body: payload }),
  updateStatus: (id, status, deliveryNotes) =>
    request(`/orders/${id}/status`, { method: "PUT", body: { status, deliveryNotes } }),
  remove: (id) => request(`/orders/${id}`, { method: "DELETE" })
};

/* ---------- Suppliers API ---------- */
const SuppliersAPI = {
  list: () => request("/suppliers"),
  create: (payload) => request("/suppliers", { method: "POST", body: payload }),
  update: (id, payload) => request(`/suppliers/${id}`, { method: "PUT", body: payload }),
  remove: (id) => request(`/suppliers/${id}`, { method: "DELETE" })
};

/* ---------- Helpers ---------- */
function money(n) {
  const num = Number(n) || 0;
  return "Ksh " + num.toLocaleString("en-KE");
}

function statusBadge(status) {
  const cls = "badge badge-" + (status || "pending");
  const label = (status || "pending").charAt(0).toUpperCase() + (status || "pending").slice(1);
  return `<span class="${cls}">${label}</span>`;
}
