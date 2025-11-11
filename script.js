require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Config uit env
const PORT = process.env.PORT || 3000;
const XSOLLA_PROJECT_ID = process.env.XSOLLA_PROJECT_ID;
const XSOLLA_PROJECT_KEY = process.env.XSOLLA_PROJECT_KEY;
const XSOLLA_PROJECT_SECRET = process.env.XSOLLA_PROJECT_SECRET;

// In-memory orders (demo). Vervang in productie door database.
const orders = new Map();

/**
 * Helper: Maak Xsolla payment token (admin API)
 * Documentatie: gebruik juiste endpoint volgens je Xsolla project instellingen.
 */
async function createXsollaToken({ accountId, productId, gameplayId, price, currency='EUR' }) {
  const url = `https://api.xsolla.com/v3/project/${XSOLLA_PROJECT_ID}/admin/payment/token`;
  const payload = {
    purchase: {
      items: [{
        sku: productId,
        name: productId,
        quantity: 1,
        price: Number(price),
        currency
      }]
    },
    user: { id: { value: accountId } },
    settings: { project_id: XSOLLA_PROJECT_ID },
    // bewaar metadata zodat webhook dit kan terugsturen
    custom_parameters: { productId, gameplayId }
  };
  const auth = { username: XSOLLA_PROJECT_ID, password: XSOLLA_PROJECT_KEY };
  const resp = await axios.post(url, payload, { auth, timeout: 15000 });
  return resp.data; // verwacht o.a. token
}

/**
 * POST /create-payment-token
 * Body: { accountId, productId, gameplayId, price, currency }
 */
app.post('/create-payment-token', async (req, res) => {
  try {
    const { accountId, productId, gameplayId, price, currency } = req.body;
    if (!accountId || !productId || !price) return res.status(400).json({ error: 'accountId, productId en price verplicht' });

    // creëer eigen order id
    const orderId = uuidv4();
    // Sla voorlopige order op (PENDING)
    orders.set(orderId, { orderId, accountId, productId, gameplayId, price, currency, status:'PENDING', createdAt: Date.now() });

    // Vraag Xsolla token aan
    const tokenResp = await createXsollaToken({ accountId, productId, gameplayId, price, currency });
    // Token resp kan token of paystation url bevatten
    // Voeg ons orderId toe als custom param (optioneel)
    const response = {
      orderId,
      token: tokenResp.token,
      paystationUrl: tokenResp.token ? `https://secure.xsolla.com/paystation3/desktop/list/?token=${encodeURIComponent(tokenResp.token)}` : tokenResp.paystationUrl || null
    };
    // Bewaar mapping token -> orderId (optioneel)
    orders.get(orderId).xsollaToken = tokenResp.token || null;
    orders.get(orderId).xsollaRaw = tokenResp;
    return res.json(response);
  } catch (err) {
    console.error('create-payment-token error', err.response?.data || err.message);
    return res.status(500).json({ error: 'Kon Xsolla token niet aanmaken', details: err.response?.data || err.message });
  }
});

/**
 * POST /xsolla-webhook
 * Xsolla stuurt events: valideer via signature: sha1(rawBody + PROJECT_SECRET)
 */
app.post('/xsolla-webhook', bodyParser.raw({ type: '*/*' }), async (req, res) => {
  try {
    const raw = req.body.toString('utf8');
    const signatureHeader = req.headers['x-xsolla-signature'] || req.headers['xsolla-signature'] || '';
    const computed = crypto.createHash('sha1').update(raw + (XSOLLA_PROJECT_SECRET || '')).digest('hex');
    if (!signatureHeader || computed !== signatureHeader) {
      console.warn('Webhook signature mismatch', { computed, signatureHeader });
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(raw);
    console.log('Xsolla webhook event:', event.event || event.type || 'unknown');

    // Extract order id or token from payload (afhankelijk van Xsolla event schema)
    // Hieronder enkele voorbeelden — pas aan op basis van jouw Xsolla instellingen.
    const orderId = event?.order?.order_id || event?.data?.order_id || event?.data?.order?.id || null;
    const token = event?.data?.token || event?.token || null;

    // Zoek matching order
    let order = null;
    if (orderId && orders.has(orderId)) order = orders.get(orderId);
    else if (token) {
      // find by token
      for (const o of orders.values()) {
        if (o.xsollaToken === token) { order = o; break; }
      }
    }

    // Markeer als betaald bij geschikte event
    const eventType = (event.event || event.type || '').toString().toLowerCase();
    if (eventType.includes('paid') || eventType.includes('order.paid') || eventType.includes('payment')) {
      if (!order) {
        console.warn('Betaald maar geen order gevonden in lokale store — log voor handmatige verwerking');
        // bewaar raw event in DB in praktijk
        return res.json({ ok: true });
      }
      // Idempotentie: verwerk alleen als nog niet betaald
      if (order.status === 'PAID') {
        console.log('Order al gemarkeerd als PAID:', order.orderId);
        return res.json({ ok: true });
      }
      // Update order
      order.status = 'PAID';
      order.paidAt = Date.now();
      order.xsollaEvent = event;

      // NU: veilige placeholder om aan Miniclip te koppelen
      try {
        await assignSkinToMiniclip(order);
        order.assigned = true;
        order.assignAt = Date.now();
        console.log('assignSkinToMiniclip succesvol uitgevoerd voor order', order.orderId);
      } catch (err) {
        // placeholder error -> keep order in PAID but not assigned
        order.assigned = false;
        order.assignError = err.message;
        console.warn('assignSkinToMiniclip niet uitgevoerd:', err.message);
        // In echte deployment: houd deze order in DB en laat support / cron jobs retry uitvoeren.
      }

      return res.json({ ok: true });
    }

    // Andere events: ack
    return res.json({ ok: true });
  } catch (err) {
    console.error('Webhook handler fout', err);
    return res.status(500).send('error');
  }
});

/**
 * VEILIGE PLACEHOLDER: assignSkinToMiniclip
 * - Deze functie gooit een fout totdat je Miniclip endpoint en credentials toevoegt.
 * - Pas deze functie alleen aan nadat je schriftelijke toestemming en test-credentials van Miniclip hebt.
 */
async function assignSkinToMiniclip(order) {
  // Veilig weigeren:
  throw new Error('assignSkinToMiniclip is niet geconfigureerd. Voeg Miniclip endpoint + credentials toe nadat je schriftelijke toestemming hebt gekregen.');
  /**
   * Als je wél Miniclip machtiging hebt, implementeer hier:
   * 1) HTTPS POST naar Miniclip partner endpoint met order.accountId, order.productId, order.gameplayId, order.orderId, amount, currency
   * 2) Voeg authentication header (bijv. Bearer MINICLIP_API_KEY) en signature/timestamp/nonce
   * 3) Verwerk respons: indien success -> markeer order.assigned = true; else -> log en retry policy
   * 4) Zorg voor idempotentie: Miniclip endpoint moet ook idempotent zijn of je moet correlation id gebruiken.
   */
}

app.listen(PORT, ()=> console.log(`Server draait op http://localhost:${PORT}`));
