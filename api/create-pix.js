const { publicStatus, skaleRequest } = require("../lib/skale");
const { plans, deliveryFeeInCents } = require("../lib/pricing");

function safeGatewayMessage(value) {
  return String(value || "")
    .replace(/sk_[A-Za-z0-9_]+/gi, "[chave]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[e-mail]")
    .replace(/\b\d{10,14}\b/g, "[número]")
    .slice(0, 180);
}

function isValidCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11 || /^([0-9])\1{10}$/.test(digits)) return false;
  const digit = length => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(digits[9]) && digit(10) === Number(digits[10]);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const {
    nome,
    cpf,
    email,
    telefone,
    valor,
    descricao,
    external_id_client,
    plan,
    tipo = "virtual",
    shipping,
  } = req.body || {};
  const document = String(cpf || "").replace(/\D/g, "");
  const phoneDigits = String(telefone || "").replace(/\D/g, "");
  const localPhoneDigits = phoneDigits.startsWith("55") && [12, 13].includes(phoneDigits.length)
    ? phoneDigits.slice(2)
    : phoneDigits;
  const selectedPlan = plan ? plans[String(plan)] : null;
  const isPhysical = tipo === "physical";
  const shippingFee = selectedPlan && isPhysical ? deliveryFeeInCents : 0;
  const itemAmount = selectedPlan ? selectedPlan.priceInCents : Math.round(Number(valor) * 100);
  const amount = selectedPlan
    ? itemAmount + shippingFee
    : Math.round(Number(valor) * 100);
  let validationError = null;
  if (String(nome || "").trim().length < 3) validationError = "Informe seu nome completo.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())) validationError = "Informe um e-mail válido.";
  else if (!isValidCpf(cpf)) validationError = "Informe um CPF válido com 11 dígitos.";
  else if (![10, 11].includes(localPhoneDigits.length)) validationError = "Informe um celular com DDD.";
  else if (plan && !selectedPlan) validationError = "Plano não encontrado. Volte e escolha outro plano.";
  else if (plan && !["virtual", "physical"].includes(tipo)) validationError = "Tipo de chip inválido.";
  else if (!Number.isFinite(amount) || amount < 500 || amount > 60000) validationError = "O valor do pedido está fora do limite de pagamento.";
  else if (plan && isPhysical && (!shipping || !shipping.cep || !shipping.logradouro || !shipping.numero || !shipping.cidade || !shipping.estado)) validationError = "Complete o endereço de entrega.";
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const transaction = await skaleRequest("/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount,
        paymentMethod: "pix",
        pix: { expiresInDays: 1 },
        customer: {
          name: String(nome),
          email: String(email),
          phone: String(telefone || ""),
          document: { number: document, type: "cpf" },
        },
        items: [{
          title: String(descricao || selectedPlan?.label || "Pedido").slice(0, 120),
          unitPrice: itemAmount,
          quantity: 1,
          tangible: isPhysical,
          externalRef: String(external_id_client || "").slice(0, 120),
        }],
        ...(isPhysical && shipping ? { shipping: { ...shipping, fee: shippingFee } } : {}),
        metadata: {
          external_id_client: String(external_id_client || "").slice(0, 120),
          ...(selectedPlan ? { plan: String(plan), tipo } : {}),
        },
      }),
    });

    if (!transaction.id || !transaction.pix?.qrcode) {
      return res.status(502).json({ error: "A Skale não retornou os dados do PIX." });
    }
    return res.status(200).json({
      transactionId: transaction.id,
      qrcode: transaction.pix.qrcode,
      qrcodeImage: transaction.pix.qrcodeImage || null,
      status: publicStatus(transaction.status),
    });
  } catch (error) {
    console.error("Skale create transaction failed:", error.status || "server_error", error.code || "no_code");
    const detail = error.status === 400 ? safeGatewayMessage(error.message) : "";
    return res.status(error.status === 400 ? 400 : 502).json({
      error: error.status === 400
        ? detail ? `A Skale recusou os dados: ${detail}` : "A Skale recusou os dados enviados."
        : "Não foi possível gerar o PIX. Tente novamente.",
    });
  }
};
