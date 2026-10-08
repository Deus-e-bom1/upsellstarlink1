const plans = {
  "150gb": { label: "Chip Starlink 150 GB", priceInCents: 4998 },
  "450gb": { label: "Chip Starlink 450 GB", priceInCents: 5998 },
  "600gb": { label: "Chip Starlink 600 GB", priceInCents: 7998 },
};

const deliveryFeeInCents = 999;

function formatPrice(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

module.exports = { plans, deliveryFeeInCents, formatPrice };
