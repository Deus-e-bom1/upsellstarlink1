const { publicStatus, skaleRequest } = require("../lib/skale");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const transactionId = String(req.body?.transactionId || "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(transactionId)) {
    return res.status(400).json({ error: "Identificador de transação inválido." });
  }

  try {
    const transaction = await skaleRequest(`/transactions/${encodeURIComponent(transactionId)}`);
    return res.status(200).json({ status: publicStatus(transaction.status) });
  } catch (error) {
    console.error("Skale transaction lookup failed:", error.status || "server_error");
    return res.status(error.status === 404 ? 404 : 502).json({
      error: error.status === 404 ? "Transação não encontrada." : "Não foi possível consultar o pagamento.",
      status: error.status === 404 ? "NOT_FOUND" : undefined,
    });
  }
};
