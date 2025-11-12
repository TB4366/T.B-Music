require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// --- Environment variables ---
const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const XSOLLA_MERCHANT_ID = process.env.XSOLLA_MERCHANT_ID;
const XSOLLA_API_KEY = process.env.XSOLLA_API_KEY;
const XSOLLA_PROJECT_ID = process.env.XSOLLA_PROJECT_ID;

if(!FB_APP_ID || !FB_APP_SECRET || !XSOLLA_MERCHANT_ID || !XSOLLA_API_KEY || !XSOLLA_PROJECT_ID){
  console.error('Zorg dat FB_APP_ID, FB_APP_SECRET, XSOLLA_MERCHANT_ID, XSOLLA_API_KEY en XSOLLA_PROJECT_ID in env staan.');
  process.exit(1);
}

// --- Helper: Xsolla auth header ---
function xsollaAuthHeader(){
  const token = Buffer.from(`${XSOLLA_MERCHANT_ID}:${XSOLLA_API_KEY}`).toString('base64');
  return `Basic ${token}`;
}

// --- Verifieer Facebook token server-side ---
async function verifyFacebookToken(userAccessToken){
  const appAccessToken = `${FB_APP_ID}|${FB_APP_SECRET}`;
  const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
  const resp = await axios.get(debugUrl, {timeout:10000});
  return resp.data && resp.data.data;
}

// --- Endpoint: create Xsolla payment token ---
app.post('/create_payment_token', async (req,res)=>{
  try{
    const { fb_user_id, fb_access_token, purchase, sandbox } = req.body;
    if(!fb_user_id || !fb_access_token || !purchase || !Array.isArray(purchase.items) || purchase.items.length===0){
      return res.status(400).send('fb_user_id, fb_access_token en purchase.items vereist');
    }

    // 1) Verifieer Facebook token
    const fbDebug = await verifyFacebookToken(fb_access_token);
    if(!fbDebug || !fbDebug.is_valid) return res.status(401).send('Facebook token ongeldig');
    if(String(fbDebug.user_id)!==String(fb_user_id)) return res.status(401).send('FB user_id komt niet overeen met token');
    if(String(fbDebug.app_id)!==String(FB_APP_ID)) return res.status(401).send('FB token is niet voor deze app');

    // 2) Bouw Xsolla request body
    const xsollaBody = {
      user: { id: { value: String(fb_user_id) } },
      purchase: { items: purchase.items.map(it=>({sku:String(it.sku), quantity: it.quantity||1})) }
    };
    if(sandbox) xsollaBody.sandbox = true;

    // 3) Maak token bij Xsolla
    const xsollaUrl = `https://api.xsolla.com/v3/project/${XSOLLA_PROJECT_ID}/admin/payment/token`;
    const xsollaResp = await axios.post(xsollaUrl, xsollaBody, {
      headers: {
        'Content-Type':'application/json',
        'Authorization': xsollaAuthHeader()
      },
      timeout:15000
    });

    return res.json({ token: xsollaResp.data.token, sandbox: !!sandbox, raw: xsollaResp.data });

  }catch(err){
    console.error('create_payment_token error', err.response?err.response.data:err.message);
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    return res.status(500).send('Server error: '+msg);
  }
});

// --- Serve static frontend files ---
app.use(express.static(path.join(__dirname,'public'))); // zet index.html in /public

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`Server draait op port ${PORT}`));
