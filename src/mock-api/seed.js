// Sample orders for Copperleaf Coffee Co. (made up). Dates are relative to `now`
// so the demo always reads as "shipped two days ago", never as a stale fixture.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const iso = (now, offsetMs) => new Date(now + offsetMs).toISOString();

const tracking = (carrier, number) => ({
  carrier,
  trackingNumber: number,
  trackingUrl: `https://tracking.example.com/${carrier.toLowerCase()}/${number}`,
});

const item = (sku, name, quantity, unitPrice) => ({ sku, name, quantity, unitPrice });

function total(items, shipping = 0) {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) + shipping;
}

function order({ number, email, status, placedAt, items, shipping = 0, payment = { brand: 'Visa', last4: '4242' }, ...rest }) {
  return {
    number,
    email,
    status,
    placedAt,
    items,
    shipping,
    total: total(items, shipping),
    currency: 'USD',
    payment,
    shipBy: null,
    shipment: null,
    cancellation: null,
    ...rest,
  };
}

export function seedOrders(now = Date.now()) {
  const t = (offsetMs) => iso(now, offsetMs);
  return [
    order({
      number: '10482',
      email: 'maya.chen@example.com',
      status: 'shipped',
      placedAt: t(-4 * DAY),
      items: [item('CL-GRIND-BURR', 'Copperleaf Burr Grinder', 1, 18900), item('CL-FILTER-100', 'Paper Filters (100)', 1, 1200)],
      shipment: {
        ...tracking('UPS', '1Z84X2E10394817265'),
        shippedAt: t(-3 * DAY),
        estimatedDelivery: t(2 * DAY),
        deliveredAt: null,
        events: [
          { at: t(-3 * DAY), location: 'Nashville, TN', description: 'Label created' },
          { at: t(-3 * DAY + 6 * HOUR), location: 'Nashville, TN', description: 'Picked up by UPS' },
          { at: t(-2 * DAY), location: 'Louisville, KY', description: 'Departed UPS facility' },
          { at: t(-20 * HOUR), location: 'Columbus, OH', description: 'Arrived at UPS facility' },
        ],
      },
    }),
    order({
      number: '10517',
      email: 'sam.okafor@example.com',
      status: 'processing',
      placedAt: t(-9 * HOUR),
      shipBy: t(1 * DAY),
      items: [item('CL-KETTLE-GN', 'Gooseneck Pour-Over Kettle', 1, 6400), item('CL-BEAN-ETH', 'Ethiopia Guji Beans 340g', 2, 1800)],
      shipping: 500,
      payment: { brand: 'Mastercard', last4: '5100' },
    }),
    order({
      number: '10533',
      email: 'maya.chen@example.com',
      status: 'delivered',
      placedAt: t(-8 * DAY),
      items: [item('CL-BEAN-COL', 'Colombia Huila Beans 340g', 3, 1700)],
      shipping: 500,
      shipment: {
        ...tracking('USPS', '9400111899223344556677'),
        shippedAt: t(-6 * DAY),
        estimatedDelivery: t(-2 * DAY),
        deliveredAt: t(-2 * DAY + 3 * HOUR),
        events: [
          { at: t(-6 * DAY), location: 'Nashville, TN', description: 'Shipping label created' },
          { at: t(-5 * DAY), location: 'Nashville, TN', description: 'Accepted at USPS origin facility' },
          { at: t(-2 * DAY - 4 * HOUR), location: 'Portland, OR', description: 'Out for delivery' },
          { at: t(-2 * DAY + 3 * HOUR), location: 'Portland, OR', description: 'Delivered, front door' },
        ],
      },
    }),
    order({
      number: '10541',
      email: 'lena.fischer@example.com',
      status: 'out_for_delivery',
      placedAt: t(-3 * DAY),
      items: [item('CL-DRIP-SET', 'Ceramic Dripper Set', 1, 4800)],
      shipment: {
        ...tracking('FedEx', '781234567890'),
        shippedAt: t(-2 * DAY),
        estimatedDelivery: t(6 * HOUR),
        deliveredAt: null,
        events: [
          { at: t(-2 * DAY), location: 'Nashville, TN', description: 'Shipment information sent to FedEx' },
          { at: t(-1 * DAY), location: 'Memphis, TN', description: 'Departed FedEx hub' },
          { at: t(-2 * HOUR), location: 'Austin, TX', description: 'On FedEx vehicle for delivery' },
        ],
      },
    }),
    order({
      number: '10560',
      email: 'sam.okafor@example.com',
      status: 'cancelled',
      placedAt: t(-6 * DAY),
      items: [item('CL-SCALE-01', 'Brew Scale with Timer', 1, 3900)],
      shipping: 500,
      payment: { brand: 'Mastercard', last4: '5100' },
      cancellation: { cancelledAt: t(-6 * DAY + 2 * HOUR), refund: { amount: 4400, currency: 'USD' } },
    }),
    order({
      number: '10574',
      email: 'jordan.blake@example.com',
      status: 'shipped',
      placedAt: t(-5 * DAY),
      items: [item('CL-ESP-TAMP', 'Espresso Tamper 58mm', 1, 3500), item('CL-BEAN-DEC', 'Swiss Water Decaf 340g', 1, 1900)],
      shipping: 500,
      shipment: {
        ...tracking('UPS', '1Z84X2E10394820011'),
        shippedAt: t(-4 * DAY),
        estimatedDelivery: t(3 * DAY),
        deliveredAt: null,
        events: [
          { at: t(-4 * DAY), location: 'Nashville, TN', description: 'Picked up by UPS' },
          { at: t(-3 * DAY), location: 'Kansas City, MO', description: 'Departed UPS facility' },
          { at: t(-1 * DAY), location: 'Denver, CO', description: 'Weather delay, shipment held at facility', exception: true },
        ],
      },
    }),
    order({
      number: '10588',
      email: 'lena.fischer@example.com',
      status: 'processing',
      placedAt: t(-2 * HOUR),
      shipBy: t(2 * DAY),
      items: [item('CL-MUG-SET', 'Stoneware Mug Set (2)', 1, 3200)],
      shipping: 500,
    }),
  ];
}

function cancelJob(data) {
  if (!data) return null;
  return data;
}

function traceRequest(data) {
  if (!data) return null;
  return data;
}

function cancelJob(data) {
  if (!data) return null;
  return data;
}

function traceRequest(data) {
  if (!data) return null;
  return data;
}

function cancelJob(data) {
  if (!data) return null;
  return data;
}

function traceRequest(data) {
  if (!data) return null;
  return data;
}