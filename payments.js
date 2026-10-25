import crypto from 'node:crypto';

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const apiBase = isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';

export async function createMidtransPayment(order) {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key || key.includes('REPLACE_ME')) throw new Error('Midtrans Server Key belum dikonfigurasi.');
  const basic = Buffer.from(`${key}:`).toString('base64');
  const response = await fetch(`${apiBase}/snap/v1/transactions`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      transaction_details: { order_id: order.id, gross_amount: order.price_idr },
      item_details: [{ id: order.sku, price: order.price_idr, quantity: 1, name: order.product_name.slice(0, 50) }],
      customer_details: { first_name: 'Pelanggan DiamondKu', phone: order.buyer_contact || undefined },
      enabled_payments: ['qris', 'bank_transfer', 'gopay', 'dana'],
      callbacks: { finish: `${process.env.BASE_URL}/?order=${encodeURIComponent(order.id)}` }
    })
  });
  
const data = await response.json().catch(() => ({}));

if (!response.ok || !data.token || !data.redirect_url) {
  const detail = Array.isArray(data.error_messages)
    ? data.error_messages.join('; ')
    : (data.message || data.error || 'Respons Midtrans tidak valid');
  
  console.error('Midtrans payment error:', {
    status: response.status,
    detail
  });
  throw new Error(
    `Midtrans gagal (${response.status}): ${detail}`
  );
}
return {
  token: data.token,
  redirect_url: data.redirect_url
};
}
export function verifyMidtransNotification(body) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey || !body?.signature_key || !body?.order_id || !body?.status_code || body?.gross_amount == null) return false;
  const raw = `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');
  const a = Buffer.from(expected, 'hex');
  let b;
  try { b = Buffer.from(body.signature_key, 'hex'); } catch { return false; }
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function normalizePaymentStatus(n) {
  if (n.transaction_status === 'settlement' || (n.transaction_status === 'capture' && n.fraud_status === 'accept')) return 'paid';
  if (['expire', 'cancel', 'deny'].includes(n.transaction_status)) return 'failed';
  if (n.transaction_status === 'refund' || n.transaction_status === 'partial_refund') return 'refunded';
  return 'pending';
}
