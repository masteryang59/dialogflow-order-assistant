import { OrdersApiError } from '../orders/client.js';
import { Reply } from './dialogflow.js';
import {
  itemsSummary,
  maskEmail,
  money,
  normalizeOrderNumber,
  notCancellableMessage,
  statusChips,
  statusMessage,
  trackingDetails,
} from './format.js';

// Context names must match the agent (agent-src/definition.js).
export const CONTEXTS = {
  verified: 'order-verified',
  awaitingCancel: 'awaiting-cancel-confirmation',
};
const VERIFIED_LIFESPAN = 10;
const AWAITING_CANCEL_LIFESPAN = 2;

/**
 * Counts failed number + email checks per Dialogflow session, so a chat can't
 * be used to guess which emails go with which order numbers.
 */
export function createVerificationGuard({ maxFailures, windowMs, now = Date.now }) {
  const failures = new Map(); // sessionId -> timestamps

  const recent = (sessionId) => {
    const cutoff = now() - windowMs;
    const list = (failures.get(sessionId) ?? []).filter((t) => t > cutoff);
    if (list.length) failures.set(sessionId, list);
    else failures.delete(sessionId);
    return list;
  };

  return {
    isLocked: (sessionId) => recent(sessionId).length >= maxFailures,
    recordFailure(sessionId) {
      failures.set(sessionId, [...recent(sessionId), now()]);
      // Keep memory bounded on a long-running instance.
      if (failures.size > 10_000) failures.delete(failures.keys().next().value);
    },
  };
}

/**
 * One handler per Dialogflow intent that has "Enable webhook call" switched on.
 * Each gets the parsed request and returns a Reply. `reply.outcome` is only
 * for logs.
 */
export function createDispatcher({ orders, guard, config, logger, now = Date.now }) {
  const fmt = () => ({ now: now(), timeZone: config.timeZone });

  const outage = () => {
    const reply = new Reply().text(
      `Sorry, I can't reach our order system right now. Please try again in a minute, or email ${config.supportEmail} and we'll check for you.`,
    );
    reply.outcome = 'orders_api_unavailable';
    return reply;
  };

  /** Looks the order up and checks the email. Returns { order } or { reply } to send instead. */
  async function verifiedOrder(req, { deadline }) {
    const number = normalizeOrderNumber(req.param('order_number', CONTEXTS.awaitingCancel, CONTEXTS.verified));
    const email = String(req.param('email', CONTEXTS.verified)).trim().toLowerCase();

    if (guard.isLocked(req.sessionId)) {
      const reply = new Reply()
        .text(`For your security I can't look up more orders in this chat. Please email ${config.supportEmail} from the address you ordered with and we'll help you there.`)
        .clearContext(CONTEXTS.verified);
      reply.outcome = 'locked';
      return { reply };
    }
    if (!number || !email) {
      const reply = new Reply().text("I need your order number and the email you ordered with. What's your order number?");
      reply.outcome = 'missing_params';
      return { reply };
    }

    const order = await orders.getOrder(number, { deadline });
    // Same answer whether the order doesn't exist or the email is wrong, so
    // the reply never confirms that an order number is real.
    if (!order || order.email.toLowerCase() !== email) {
      guard.recordFailure(req.sessionId);
      const reply = new Reply()
        .text(
          `I couldn't find order #${number} for ${maskEmail(email)}.`,
          "Please check the number in your confirmation email. If you ordered with a different email, tell me the order number and that email together.",
        )
        .chips('Talk to a person')
        .clearContext(CONTEXTS.verified)
        .clearContext(CONTEXTS.awaitingCancel);
      reply.outcome = 'not_verified';
      return { reply };
    }
    return { order, email };
  }

  const remember = (reply, order, email) =>
    reply.setContext(CONTEXTS.verified, VERIFIED_LIFESPAN, { order_number: order.number, email });

  const intents = {
    async 'order.status'(req, opts) {
      const { order, email, reply } = await verifiedOrder(req, opts);
      if (reply) return reply;
      const out = remember(new Reply().text(statusMessage(order, fmt())).chips(...statusChips(order)), order, email);
      out.outcome = `status:${order.status}`;
      return out;
    },

    async 'order.track'(req, opts) {
      const { order, email, reply } = await verifiedOrder(req, opts);
      if (reply) return reply;
      const { text, card, events } = trackingDetails(order, fmt());
      const out = remember(new Reply().text(text), order, email);
      if (card) out.info(card);
      if (events.length) out.list('Latest updates', events);
      out.chips(...(order.status === 'processing' ? ['Cancel this order'] : []), 'Check another order');
      out.outcome = card ? 'tracking' : `no_tracking:${order.status}`;
      return out;
    },

    async 'order.cancel'(req, opts) {
      const { order, email, reply } = await verifiedOrder(req, opts);
      if (reply) return reply;
      const out = remember(new Reply(), order, email);
      if (order.status !== 'processing') {
        out.text(notCancellableMessage(order, fmt(), config.supportEmail)).chips('Track package', 'Talk to a person');
        out.outcome = `not_cancellable:${order.status}`;
        return out;
      }
      out
        .text(
          `Order #${order.number} (${itemsSummary(order.items)}, ${money(order.total, order.currency)}) hasn't shipped yet.`,
          `Do you want me to cancel it? The full amount goes back to your ${order.payment.brand} ending ${order.payment.last4}.`,
        )
        .chips('Yes, cancel it', 'No, keep it')
        .setContext(CONTEXTS.awaitingCancel, AWAITING_CANCEL_LIFESPAN, { order_number: order.number });
      out.outcome = 'confirm_cancel';
      return out;
    },

    async 'order.cancel.confirm'(req, opts) {
      if (!req.param('order_number', CONTEXTS.awaitingCancel)) {
        const reply = new Reply().text("Sorry, I lost track of which order to cancel. Which order number should I cancel?");
        reply.outcome = 'missing_params';
        return reply;
      }
      // Check again: the confirmation can come minutes later, and the
      // verification context may have been replaced in between.
      const { order, email, reply } = await verifiedOrder(req, opts);
      if (reply) return reply;

      const result = await orders.cancelOrder(order.number, {
        idempotencyKey: `${req.sessionId}:${order.number}`,
        deadline: opts.deadline,
      });
      const out = remember(new Reply(), order, email).clearContext(CONTEXTS.awaitingCancel);
      if (result.outcome === 'cancelled') {
        const refund = result.order.cancellation.refund;
        out
          .text(
            `Done: order #${order.number} is cancelled.`,
            `A refund of ${money(refund.amount, refund.currency)} goes back to your ${order.payment.brand} ending ${order.payment.last4} within 5–10 business days. You'll also get a confirmation email.`,
          )
          .chips('Check another order');
        out.outcome = 'cancelled';
        logger?.info({ order: order.number, sessionId: req.sessionId }, 'order cancelled from chat');
      } else {
        // It shipped between the question and the "yes".
        const status = result.status ?? 'shipped';
        out.text(notCancellableMessage({ ...order, status }, fmt(), config.supportEmail)).chips('Track package');
        out.outcome = `not_cancellable:${status}`;
      }
      return out;
    },
  };

  return {
    intents,
    /** Runs the handler for req.intent and turns order API outages into a friendly answer. */
    async dispatch(req, { deadline }) {
      const handler = intents[req.intent];
      if (!handler) {
        logger?.warn({ intent: req.intent }, 'no handler for intent');
        const reply = new Reply().text("Sorry, I can't help with that one here.");
        reply.outcome = 'unknown_intent';
        return reply;
      }
      try {
        return await handler(req, { deadline });
      } catch (err) {
        if (!(err instanceof OrdersApiError)) throw err;
        logger?.error({ intent: req.intent, err: err.message, status: err.status, attempts: err.attempts }, 'orders api unavailable');
        return outage();
      }
    },
  };
}

function emitEvent(data) {
  if (!data) return null;
  return data;
}

function parseInput(data) {
  if (!data) return null;
  return data;
}

function emitEvent(data) {
  if (!data) return null;
  return data;
}

function parseInput(data) {
  if (!data) return null;
  return data;
}

function emitEvent(data) {
  if (!data) return null;
  return data;
}