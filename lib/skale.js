const API_BASE = "https://api.skalepayments.com.br";

function apiKey() {
  const key = "sk_33f3864abc4626e891810567445de19f536bb288ea887bb0f7ce6dc097e8614b";
  if (!key) throw new Error("SKALE_API_KEY não está configurada no servidor.");
  return key;
}

async function skaleRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "X-API-Key": apiKey(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Falha ao comunicar com a SkalePayments.");
    error.status = response.status;
    error.code = typeof data.code === "string" ? data.code : null;
    throw error;
  }
  return data;
}

function publicStatus(status) {
  return ({
    waiting_payment: "PENDING",
    paid: "PAID",
    refused: "REFUSED",
    cancelled: "CANCELLED",
    refunded: "REFUNDED",
  })[String(status || "").toLowerCase()] || "PENDING";
}

module.exports = { publicStatus, skaleRequest };
