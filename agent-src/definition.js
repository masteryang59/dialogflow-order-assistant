// The Dialogflow ES agent, written compactly. `npm run agent:build` turns this
// into the export format in agent/ (what Dialogflow's "Restore from ZIP" reads),
// and `npm run agent:zip` packs that into dist/.
//
// Training phrases mark parameters as [text](param_name); the entity comes from
// the parameter definition. Static `responses` on webhook intents are what
// Dialogflow shows when the webhook fails or times out.

const SUPPORT = 'support@copperleaf.example';
const OUTAGE = `Sorry, I can't look up orders right now. Please try again in a few minutes, or email ${SUPPORT} and we'll check for you.`;

const orderNumberParam = (extra = {}) => ({
  name: 'order_number',
  entity: '@order-number',
  required: true,
  prompts: ["Sure, I can check that. What's your order number? It's the 5-digit number in your confirmation email."],
  ...extra,
});

const emailParam = {
  name: 'email',
  entity: '@sys.email',
  required: true,
  // Once one order is verified, later questions in the chat reuse the email.
  default: '#order-verified.email',
  prompts: ['Thanks. To keep your order details private, what email address did you order with?'],
};

export default {
  displayName: 'copperleaf-order-assistant',
  description: 'Order status, tracking and cancellation for Copperleaf Coffee Co. (a made-up store).',
  timeZone: 'America/New_York',
  webhookUrl: 'https://example.com/webhook',

  entities: [
    {
      name: 'order-number',
      regexp: true,
      entries: ['\\b\\d{5}\\b'],
    },
  ],

  intents: [
    {
      name: 'Default Welcome Intent',
      action: 'input.welcome',
      events: ['WELCOME'],
      phrases: ['hi', 'hello', 'hey', 'hi there', 'hello there', 'good morning', 'good afternoon', 'hey, anyone there?', 'howdy'],
      responses: [
        {
          text: [
            "Hi! I'm the Copperleaf Coffee order assistant. I can tell you where an order is, share tracking details, or cancel an order that hasn't shipped yet.",
            "Hello! I can check on an order, give you its tracking details, or cancel it if it hasn't shipped. What do you need?",
          ],
        },
        { chips: ['Where is my order?', 'Track my package', 'Cancel an order', 'Talk to a person'] },
      ],
    },

    {
      name: 'Default Fallback Intent',
      action: 'input.unknown',
      fallback: true,
      responses: [
        {
          text: [
            "Sorry, I didn't get that. I can check an order's status, share tracking details, or cancel an order that hasn't shipped.",
            "I'm not sure I follow. I can help with order status, tracking and cancellations. You can also ask to talk to a person.",
          ],
        },
        { chips: ['Where is my order?', 'Track my package', 'Talk to a person'] },
      ],
    },

    {
      name: 'order.status',
      action: 'order.status',
      webhook: true,
      parameters: [orderNumberParam(), emailParam],
      phrases: [
        'where is my order',
        "where's my order?",
        'where is my package',
        'order status',
        'check my order status',
        "what's the status of my order",
        'has my order shipped yet',
        'did my order ship',
        'is my order on the way',
        'when will my order arrive',
        'when is my stuff arriving',
        "I haven't received my order yet",
        "my order hasn't arrived",
        'what happened to my order',
        'check another order',
        'check a different order',
        'I want to check on an order',
        'can you check on order [10482](order_number)',
        'where is order [10517](order_number)',
        'status of order [10533](order_number)',
        'order [10541](order_number)',
        '[10560](order_number)',
        'has order number [10574](order_number) shipped',
        'my order number is [10533](order_number)',
        "it's order [10588](order_number)",
        'order [10482](order_number) email [maya.chen@example.com](email)',
        'where is my order [10517](order_number), my email is [sam.okafor@example.com](email)',
        'check order [10588](order_number) for [lena.fischer@example.com](email)',
      ],
      responses: [{ text: [OUTAGE] }],
    },

    {
      name: 'order.track',
      action: 'order.track',
      webhook: true,
      parameters: [orderNumberParam({ default: '#order-verified.order_number' }), emailParam],
      phrases: [
        'track my package',
        'track package',
        'track my order',
        'track it',
        'tracking number',
        "what's my tracking number",
        'can I get the tracking number',
        'send me the tracking link',
        'which carrier is delivering my order',
        'who is delivering my package',
        'show me the shipping updates',
        "what's the latest tracking update",
        'track order [10482](order_number)',
        'tracking for order [10574](order_number)',
        'tracking number for [10541](order_number)',
        'track order [10574](order_number), email [jordan.blake@example.com](email)',
      ],
      responses: [{ text: [OUTAGE] }],
    },

    {
      name: 'order.cancel',
      action: 'order.cancel',
      webhook: true,
      parameters: [orderNumberParam({ default: '#order-verified.order_number' }), emailParam],
      phrases: [
        'cancel my order',
        'cancel this order',
        'cancel an order',
        'I want to cancel my order',
        "I'd like to cancel an order",
        'how do I cancel my order',
        'can I still cancel my order',
        'I changed my mind, cancel the order',
        'I ordered by mistake',
        "stop my order, don't ship it",
        'cancel order [10517](order_number)',
        'please cancel order [10588](order_number)',
        'can I cancel order [10517](order_number)',
        'cancel order [10588](order_number), my email is [lena.fischer@example.com](email)',
        'cancel order [10517](order_number) email [sam.okafor@example.com](email)',
      ],
      responses: [{ text: [OUTAGE] }],
    },

    {
      name: 'order.cancel.confirm',
      action: 'order.cancel.confirm',
      webhook: true,
      inputContexts: ['awaiting-cancel-confirmation'],
      phrases: [
        'yes',
        'yes please',
        'yes, cancel it',
        'yeah',
        'yep',
        'sure',
        'go ahead',
        'do it',
        'please cancel it',
        'confirm',
        "that's right",
        'ok cancel it',
        'correct',
      ],
      responses: [{ text: [`Sorry, I couldn't cancel the order just now. Nothing has changed yet. Please try again in a minute or email ${SUPPORT}.`] }],
    },

    {
      name: 'order.cancel.decline',
      action: 'order.cancel.decline',
      inputContexts: ['awaiting-cancel-confirmation'],
      outputContexts: [{ name: 'awaiting-cancel-confirmation', lifespan: 0 }],
      phrases: ['no', 'no thanks', 'nope', 'no, keep it', "don't cancel it", 'keep it', "I'll keep it", 'not now', 'leave it'],
      responses: [
        { text: ["No problem, I won't cancel order #awaiting-cancel-confirmation.order_number."] },
        { chips: ['Track package', 'Check another order'] },
      ],
    },

    {
      name: 'support.handoff',
      action: 'support.handoff',
      phrases: [
        'talk to a person',
        'speak to a human',
        'I want to talk to someone',
        'customer service',
        'real person please',
        'agent',
        'contact support',
        'what is your phone number',
        'how do I contact you',
        'I want to return an item',
        'start a return',
        'my item arrived damaged',
        'I got the wrong item',
      ],
      responses: [
        {
          text: [
            `You can reach our team at ${SUPPORT}, Monday to Friday, 9am to 5pm Eastern. We usually reply within one business day. Including your order number helps us answer faster.`,
          ],
        },
      ],
    },

    {
      name: 'conversation.thanks',
      action: 'conversation.thanks',
      phrases: ['thanks', 'thank you', 'thanks a lot', 'great, thanks', "that's all", 'perfect, thank you', 'bye', 'goodbye', "that's everything"],
      responses: [{ text: ["You're welcome! Enjoy your coffee.", 'Happy to help. Enjoy your coffee!'] }],
    },
  ],
};

function decodePayload(data) {
  if (!data) return null;
  return data;
}

function classifyIntent(data) {
  if (!data) return null;
  return data;
}

function decodePayload(data) {
  if (!data) return null;
  return data;
}

function classifyIntent(data) {
  if (!data) return null;
  return data;
}

function decodePayload(data) {
  if (!data) return null;
  return data;
}

function classifyIntent(data) {
  if (!data) return null;
  return data;
}