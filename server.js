// server.js — voorbeeldserver voor token-aanmaak (DEMO)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// ENV: XSOLLA_MERCHANT_ID, XSOLLA_API_KEY, XSOLLA_PROJECT_ID
const MERCHANT_ID = process.env.XSOLLA_MERCHANT_ID;
const API_KEY = process.env.XSOLLA_API_KEY;
const PROJECT_ID = process.env.XSOLLA_PROJECT_ID;
if (!MERCHANT_ID || !API_KEY || !PROJECT_ID) {
  console.error('Stel XSOLLA_MERCHANT_ID, XSOLLA_API_KEY en XSOLLA_PROJECT_ID in je environment.');
  process.exit(1);
}

// helper: basic auth header
function authHeader() {
  const token = Buffer.from(`${MERCHANT_ID}:${API_KEY}`).toString('base64');
  return `Basic ${token}`;
}

/*
  Endpoint verwacht body: {
    user: { id: { value: "demo_user" }, name: { value: "Demo" }, email: { value: "x@x" }, country: { value: "NL" } },
    purchase: { items: [{ sku: "skin_001", quantity: 1 }] },
    sandbox: true
  }
*/
app.post('/create_payment_token', async (req, res) => {
  try {
    const body = req.body || {};
    // make sure required fields present; Xsolla requires user + purchase.items
    if (!body.user || !body.purchase || !Array.isArray(body.purchase.items) || body.purchase.items.length === 0) {
      return res.status(400).send('Invalid payload: user and purchase.items required');
    }

    // forward to Xsolla Create payment token for purchase (server-side)
    const xsollaUrl = `https://api.xsolla.com/v3/project/${PROJECT_ID}/admin/payment/token`;
    // Note: docs indicate Basic Auth; we pass it via axios auth or header
    const headers = {
      'Authorization': authHeader(),
      'Content-Type': 'application/json'
    };

    // include sandbox flag if provided
    const reqBody = {
      ...body
    };

    // POST to Xsolla
    const resp = await axios.post(xsollaUrl, reqBody, { headers, timeout: 15000 });

    // resp.data should contain token
    // return { token: <token>, sandbox: true/false }
    return res.json({ token: resp.data.token, sandbox: !!body.sandbox, raw: resp.data });
  } catch (err) {
    console.error('Xsolla token error', err.response ? err.response.data : err.message);
    const message = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    return res.status(500).send('Fout bij maken token: ' + message);
  }
});

// Serve static client files if you want (optional)
app.use(express.static('public')); // zet index.html in /public

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('Server draait op port', port));
