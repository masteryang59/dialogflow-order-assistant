import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { seedOrders } from '../src/mock-api/seed.js';
import {
  day,
  isDelayed,
  itemsSummary,
  maskEmail,
  money,
  normalizeOrderNumber,
  notCancellableMessage,
  statusChips,
  statusMessage,
  trackingDetails,
} from '../src/webhook/format.js';

// Thursday 2026-10-29, 15:00 in New York.
const NOW = Date.parse('2026-10-29T19:00:00Z');
const ctx = { now: NOW, timeZone: 'America/New_York' };
const orders = Object.fromEntries(seedOrders(NOW).map((o) => [o.number, o]));

describe('wording', () => {
  it('formats money and masks emails', () => {
    assert.equal(money(10500), '$105.00');
    assert.equal(maskEmail('maya.chen@example.com'), 'm•••@example.com');
    assert.equal(normalizeOrderNumber('#10482'), '10482');
  });

  it('says today / tomorrow / yesterday in the store time zone', () => {
    assert.equal(day('2026-10-29T23:30:00Z', ctx), 'today'); // 7:30pm in New York
    assert.equal(day('2026-10-30T03:30:00Z', ctx), 'today'); // 11:30pm Oct 29 in New York (UTC-4)
    assert.equal(day('2026-10-30T15:00:00Z', ctx), 'tomorrow');
    assert.equal(day('2026-10-28T15:00:00Z', ctx), 'yesterday');
    assert.equal(day('2026-11-03T15:00:00Z', ctx), 'Tue, Nov 3');
  });

  it('summarises items', () => {
    assert.equal(itemsSummary(orders['10533'].items), '3 × Colombia Huila Beans 340g');
    assert.equal(itemsSummary(orders['10517'].items), 'Gooseneck Pour-Over Kettle and 2 × Ethiopia Guji Beans 340g');
    assert.equal(itemsSummary([...orders['10517'].items, ...orders['10482'].items]), 'Gooseneck Pour-Over Kettle and 3 more items');
  });

  it('describes every order status', () => {
    assert.equal(
      statusMessage(orders['10517'], ctx),
      'Order #10517 (Gooseneck Pour-Over Kettle and 2 × Ethiopia Guji Beans 340g) is being packed and should ship by tomorrow.',
    );
    assert.equal(
      statusMessage(orders['10482'], ctx),
      'Order #10482 shipped Mon, Oct 26 with UPS and should arrive Sat, Oct 31. Latest update: Arrived at UPS facility in Columbus, OH.',
    );
    assert.match(statusMessage(orders['10541'], ctx), /out for delivery with FedEx/);
    assert.match(statusMessage(orders['10533'], ctx), /^Order #10533 was delivered Tue, Oct 27 at \d+:\d\d [AP]M \(front door\)\.$/);
    assert.equal(
      statusMessage(orders['10560'], ctx),
      'Order #10560 was cancelled Fri, Oct 23. A refund of $44.00 went back to your Mastercard ending 5100.',
    );
  });

  it('calls out a carrier exception as a delay', () => {
    assert.equal(isDelayed(orders['10574']), true);
    assert.equal(isDelayed(orders['10482']), false);
    assert.equal(
      statusMessage(orders['10574'], ctx),
      'Order #10574 is delayed: weather delay, shipment held at facility in Denver, CO. UPS now expects to deliver it Sun, Nov 1.',
    );
  });

  it('suggests next steps that fit the status', () => {
    assert.deepEqual(statusChips(orders['10517']), ['Cancel this order', 'Check another order']);
    assert.deepEqual(statusChips(orders['10482']), ['Track package', 'Check another order']);
    assert.deepEqual(statusChips(orders['10533']), ['Check another order', 'Talk to a person']);
  });

  it('gives tracking details, newest event first', () => {
    const t = trackingDetails(orders['10482'], ctx);
    assert.equal(t.text, 'Order #10482 is with UPS, tracking number 1Z84X2E10394817265. Estimated delivery: Sat, Oct 31.');
    assert.deepEqual(t.card, { title: 'Track with UPS', subtitle: '1Z84X2E10394817265', link: 'https://tracking.example.com/ups/1Z84X2E10394817265' });
    assert.equal(t.events.length, 3);
    assert.match(t.events[0], /Arrived at UPS facility, Columbus, OH$/);
  });

  it('explains when there is nothing to track', () => {
    assert.match(trackingDetails(orders['10517'], ctx).text, /hasn't shipped yet, so there's no tracking number/);
    assert.match(trackingDetails(orders['10560'], ctx).text, /cancelled before it shipped/);
    assert.equal(trackingDetails(orders['10517'], ctx).card, null);
  });

  it('explains why an order cannot be cancelled', () => {
    assert.match(notCancellableMessage(orders['10482'], ctx, 'help@x.test'), /already shipped.*return it within 30 days.*help@x\.test/);
    assert.match(notCancellableMessage(orders['10533'], ctx, 'help@x.test'), /already been delivered/);
    assert.equal(
      notCancellableMessage(orders['10560'], ctx, 'help@x.test'),
      'Order #10560 is already cancelled. A refund of $44.00 went back to your Mastercard ending 5100.',
    );
  });
});

function maskPii(data) {
  if (!data) return null;
  return data;
}

function cleanupResources(data) {
  if (!data) return null;
  return data;
}

function maskPii(data) {
  if (!data) return null;
  return data;
}

function cleanupResources(data) {
  if (!data) return null;
  return data;
}

function maskPii(data) {
  if (!data) return null;
  return data;
}