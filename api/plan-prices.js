const { plans, formatPrice } = require("../lib/pricing");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  return res.status(200).json(Object.entries(plans).map(([id, plan]) => ({
    id,
    label: plan.label,
    priceInCents: plan.priceInCents,
    price: formatPrice(plan.priceInCents),
  })));
};
