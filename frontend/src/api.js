// ─────────────────────────────────────────────────────────────────────────────
//  Walletly API client
//  All requests go through the single `request()` helper which:
//    • attaches the JWT from localStorage
//    • throws an Error with the server's message on non-2xx responses
//    • handles 401 by clearing the token and reloading (forces re-login)
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || "/api";

const TOKEN_KEY = "walletly_token";

export const storage = {
  getToken:    ()      => localStorage.getItem(TOKEN_KEY),
  setToken:    (t)     => localStorage.setItem(TOKEN_KEY, t),
  clearToken:  ()      => localStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = storage.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));

  if (res.status === 401) {
    storage.clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────────
  register: (username, password, displayName) =>
    request("POST", "/auth/register", { username, password, displayName }),

  login: (username, password) =>
    request("POST", "/auth/login", { username, password }),

  // ── Wallets ────────────────────────────────────────────────────────────────
  getWallets: () =>
    request("GET", "/wallets"),

  createWallet: (name) =>
    request("POST", "/wallets", { name }),

  renameWallet: (walletId, name) =>
    request("PATCH", `/wallets/${walletId}`, { name }),

  deleteWallet: (walletId) =>
    request("DELETE", `/wallets/${walletId}`),

  updateSettings: (walletId, settings) =>
    request("PATCH", `/wallets/${walletId}/settings`, settings),

  inviteMember: (walletId, username) =>
    request("POST", `/wallets/${walletId}/members`, { username }),

  removeMember: (walletId, userId) =>
    request("DELETE", `/wallets/${walletId}/members/${userId}`),

  toggleExcludeCombined: (walletId, exclude) =>
    request("PATCH", `/wallets/${walletId}/exclude-combined`, { exclude }),

  // ── Transactions ───────────────────────────────────────────────────────────
  getTransactions: (walletId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/wallets/${walletId}/transactions${qs ? "?" + qs : ""}`);
  },

  createTransaction: (walletId, data) =>
    request("POST", `/wallets/${walletId}/transactions`, data),

  updateTransaction: (walletId, id, data) =>
    request("PATCH", `/wallets/${walletId}/transactions/${id}`, data),

  deleteTransaction: (walletId, id) =>
    request("DELETE", `/wallets/${walletId}/transactions/${id}`),

  // ── Categories ─────────────────────────────────────────────────────────────
  getCategories: (walletId) =>
    request("GET", `/wallets/${walletId}/categories`),

  createCategory: (walletId, data) =>
    request("POST", `/wallets/${walletId}/categories`, data),

  deleteCategory: (walletId, id) =>
    request("DELETE", `/wallets/${walletId}/categories/${id}`),

  // ── Budgets ────────────────────────────────────────────────────────────────
  getBudgets: (walletId, period) =>
    request("GET", `/wallets/${walletId}/budgets?period=${period}`),

  upsertBudget: (walletId, data) =>
    request("PUT", `/wallets/${walletId}/budgets`, data),

  deleteBudget: (walletId, id) =>
    request("DELETE", `/wallets/${walletId}/budgets/${id}`),

  // ── Stats ──────────────────────────────────────────────────────────────────
  getStats: (walletId, from, to) =>
    request("GET", `/wallets/${walletId}/stats?from=${from}&to=${to}`),
};
