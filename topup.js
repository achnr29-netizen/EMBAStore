/**
 * Adapter boundary for a licensed/authorized top-up aggregator.
 * Do not mark an order delivered until the provider confirms fulfillment.
 * Implement this only after receiving the provider's official API specification.
 */
export async function submitTopup(order) {
  if (!process.env.TOPUP_PROVIDER_BASE_URL || !process.env.TOPUP_PROVIDER_API_KEY) {
    return { accepted: false, status: 'manual_review', message: 'Penyedia top up belum dikonfigurasi; pesanan masuk antrean manual.' };
  }
  // Intentionally not guessing a third-party API contract. Map fields, authentication,
  // signatures, idempotency and status codes according to the chosen provider's docs.
  throw new Error('Adapter provider belum diimplementasikan sesuai dokumentasi resmi penyedia.');
}
