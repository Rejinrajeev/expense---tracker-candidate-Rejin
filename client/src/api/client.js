/* =========================================================
   api/client.js — the only place that talks to the API.

   Every call returns parsed JSON or throws an ApiError carrying
   the server's message and its per-field errors, so a component
   can show either a toast or inline field errors without caring
   about fetch or status codes.
   ========================================================= */

const BASE = "/api";

export class ApiError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors || null;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;

  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects on a network-level failure, which here means the
    // Express server is not running.
    throw new ApiError("Can't reach the server. Is the API running on port 5000?");
  }

  // 204 and other empty responses have no JSON body to parse.
  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(payload?.message || `Request failed (${response.status})`, {
      status: response.status,
      errors: payload?.errors,
    });
  }

  return payload;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  /* Transactions */
  listTransactions: () => request("/transactions"),
  createTransaction: (data) => request("/transactions", { method: "POST", body: data }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: "PUT", body: data }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),
  restoreTransaction: (data) => request("/transactions/restore", { method: "POST", body: data }),
  importTransactions: (transactions) =>
    request("/transactions/import", { method: "POST", body: { transactions } }),
  clearTransactions: () => request("/transactions", { method: "DELETE" }),

  /* Budget */
  getBudget: () => request("/budget"),
  setBudget: (limit) => request("/budget", { method: "PUT", body: { limit } }),
  clearBudget: () => request("/budget", { method: "DELETE" }),

  /* Misc */
  health: () => request("/health"),
};
