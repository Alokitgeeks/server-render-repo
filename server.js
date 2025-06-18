// const express = require('express');
// const axios = require('axios');
// require('dotenv').config();

// const app = express();
// app.use(express.json());

// const PORT = process.env.PORT || 3000;

// app.get('/api/orders/check', async (req, res) => {
//   try {
//     const sinceTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
//     const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?created_at_min=${sinceTime}`;

//     const response = await axios.get(url, {
//       headers: {
//         'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
//         'Content-Type': 'application/json'
//       }
//     });

//     const orders = response.data.orders;
//     const orderCount = orders.length;

//     if (orderCount >= 10) {
//       return res.json({
//         allowed: false,
//         reason: "limit",
//         message: "⚠️ 10 orders already placed in the last 2 hours."
//       });
//     }

//     res.json({
//       allowed: true,
//       orderCount,
//       message: "✅ You're allowed to checkout."
//     });

//   } catch (error) {
//     console.error("Error checking orders:", error.message);
//     res.status(500).json({
//       allowed: false,
//       reason: "server_error",
//       message: "⚠️ Error while checking order status"
//     });
//   }
// });

// app.get("/", (req, res) => {
//   res.send("🟢 Order check service is running.");
// });

// app.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });


// const express = require('express');
// const axios = require('axios');
// const cors = require('cors');  // 👈 add this
// require('dotenv').config();

// const app = express();
// app.use(express.json());
// app.use(cors());  // 👈 enable CORS for all origins

// const PORT = process.env.PORT || 3000;

// app.get('/api/orders/all', async (req, res) => {
//   try {
//     const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json`;

//     const response = await axios.get(url, {
//       headers: {
//         'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
//         'Content-Type': 'application/json'
//       }
//     });

//     const orders = response.data.orders.map(order => ({
//       name: order.name,
//       email: order.email,
//       total_price: order.total_price,
//       created_at: order.created_at
//     }));

//     res.json({ orders });

//   } catch (error) {
//     console.error("Error fetching all orders:", error.message);
//     res.status(500).json({
//       error: "❌ Failed to fetch orders"
//     });
//   }
// });


// app.get("/", (req, res) => {
//   res.send("🟢 Order check service is running.");
// });

// app.listen(PORT, () => {
//   console.log(`✅ Server running on port ${PORT}`);
// });

// app.get('/api/orders/check', async (req, res) => {
//   try {
//     const { limit = 5, hours = 2 } = req.query;

//     const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
//     const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?created_at_min=${sinceTime}`;

//     const response = await axios.get(url, {
//       headers: {
//         'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
//         'Content-Type': 'application/json'
//       }
//     });

//     const orders = response.data.orders;
//     const orderCount = orders.length;

//     if (orderCount >= Number(limit)) {
//       const oldestOrder = new Date(orders[0].created_at).getTime();
//       const nextAllowedTime = oldestOrder + hours * 60 * 60 * 1000;
//       const now = Date.now();
//       const waitSeconds = Math.max(0, Math.floor((nextAllowedTime - now) / 1000));

//       return res.json({
//         allowed: false,
//         wait_seconds: waitSeconds,
//         message: `⚠️ Limit reached. Please try again in ${Math.floor(waitSeconds / 60)} min.`
//       });
//     }

//     res.json({
//       allowed: true,
//       orderCount,
//       message: "✅ You're allowed to checkout."
//     });

//   } catch (err) {
//     console.error("Fetch Error:", err.message);
//     res.status(500).json({ allowed: false, reason: "server_error" });
//   }
// });


const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const SHOPIFY_WEBHOOK_SECRET = 'e1eef09943ca60fa3aedb04f76569ab7b15bd105de4b9080e4fef7291985d6ca';

// Middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json({ type: 'application/json' }));


// 🔐 Verify environment variables
const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN } = process.env;

if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
  console.error("❌ Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in .env");
  process.exit(1); // Stop server if not configured
}

// 🧠 Helper to verify Shopify signature
function verifyShopifyWebhook(req, res, buf) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(buf, 'utf8')
    .digest('base64');

  if (generatedHmac !== hmacHeader) {
    console.log("❌ Invalid webhook signature");
    return false;
  }
  return true;
}

// 🎯 Webhook endpoint for order creation
app.post('/webhook/order-created', express.raw({ type: 'application/json' }), (req, res) => {
  const isValid = verifyShopifyWebhook(req, res, req.body);

  if (!isValid) return res.status(401).send('Unauthorized');

  const rawBody = req.body.toString('utf8');
  const orderData = JSON.parse(rawBody);

  console.log("✅ Order received:", orderData.id);

  // 🔁 Broadcast to all connected WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event: 'orderCreated', orderId: orderData.id }));
    }
  });

  res.status(200).send('Webhook received');
});

// 🌐 WebSocket connection
wss.on('connection', (socket) => {
  console.log('🔌 New WebSocket connection');

  socket.send(JSON.stringify({ event: 'connected' }));

  socket.on('close', () => {
    console.log('❌ WebSocket client disconnected');
  });
});



// ✅ Ping route for frontend check
app.get('/api/ping', (req, res) => {
  console.log("📶 /api/ping route called");
  res.json({ success: true, message: "🟢 Server is running from Node.js Alok patel" });
});

// 🧪 Scope Check: test Admin API permissions
app.get('/api/check-scope', async (req, res) => {
  try {
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/shop.json`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    console.log("✅ Scope Test Success:", response.data.shop);
    res.json({
      success: true,
      shopName: response.data.shop.name,
      email: response.data.shop.email,
      domain: response.data.shop.domain,
      message: "✅ Admin API credentials are working!",
    });
  } catch (error) {
    console.error("❌ Admin API Scope Error:", error.message);
    res.status(500).json({
      success: false,
      message: "❌ Admin API credentials or scope may be incorrect.",
      error: error.message,
    });
  }
});

// 📦 Fetch all orders
app.get('/api/orders/all', async (req, res) => {
  try {
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const orders = response.data.orders.map(order => ({
      name: order.name,
      email: order.email,
      total_price: order.total_price,
      created_at: order.created_at,
      note_attributes: order.note_attributes || [], 
    }));

    console.log(`📦 Retrieved ${orders.length} orders`);
    res.json({ orders });
  } catch (error) {
    console.error("❌ Error fetching all orders:", error.message);
    res.status(500).json({ error: "❌ Failed to fetch orders" });
  }
});

// ⏳ Order limit logic
app.get('/api/orders/check', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 5);
    const hours = Number(req.query.hours || 2);
    const sinceTime = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?created_at_min=${sinceTime}`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const orders = response.data.orders || [];
    const orderCount = orders.length;

    if (orderCount >= limit) {
      const oldestOrder = new Date(orders[0].created_at).getTime();
      const nextAllowedTime = oldestOrder + hours * 3600 * 1000;
      const now = Date.now();
      const waitSeconds = Math.max(0, Math.floor((nextAllowedTime - now) / 1000));

      return res.json({
        allowed: false,
        wait_seconds: waitSeconds,
        message: `⚠️ Limit reached. Try again in ${Math.floor(waitSeconds / 60)} min.`,
      });
    }

    res.json({
      allowed: true,
      orderCount,
      message: "✅ You're allowed to checkout.",
    });
  } catch (error) {
    console.error("❌ Error in /api/orders/check:", error.message);
    res.status(500).json({ allowed: false, reason: "server_error" });
  }
});


app.get('/api/slots/available', async (req, res) => {
  try {
    const { date, limit, gap } = req.query;
    const maxOrder = Number(limit || 10);
    const slotGapMinutes = Number(gap || 60);

    if (!date) return res.status(400).json({ error: 'Date is required' });

    const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?created_at_min=${date}T00:00:00Z&created_at_max=${date}T23:59:59Z`;
    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    const orders = response.data.orders;
    const slotMap = {};

    for (let order of orders) {
      const deliveryTime = order.note_attributes.find(attr => attr.name === 'Delivery Time')?.value;
      const deliveryDate = order.note_attributes.find(attr => attr.name === 'Delivery Date')?.value;

      if (deliveryDate === date && deliveryTime) {
        slotMap[deliveryTime] = (slotMap[deliveryTime] || 0) + 1;
      }
    }

    const startHour = 9;
    const endHour = 21;

    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

    const availableSlots = [];

    for (let mins = startHour * 60; mins + slotGapMinutes <= endHour * 60; mins += slotGapMinutes) {
      const startHourSlot = Math.floor(mins / 60);
      const startMinSlot = mins % 60;
      const endMins = mins + slotGapMinutes;
      const endHourSlot = Math.floor(endMins / 60);
      const endMinSlot = endMins % 60;

      const slotStartStr = `${String(startHourSlot).padStart(2, '0')}:${String(startMinSlot).padStart(2, '0')}`;
      const slotEndStr = `${String(endHourSlot).padStart(2, '0')}:${String(endMinSlot).padStart(2, '0')}`;

      const hour12Start = startHourSlot % 12 || 12;
      const ampmStart = startHourSlot < 12 ? 'AM' : 'PM';
      const hour12End = endHourSlot % 12 || 12;
      const ampmEnd = endHourSlot < 12 ? 'AM' : 'PM';

      const timeStr12 = `${hour12Start}:${String(startMinSlot).padStart(2, '0')} ${ampmStart} - ${hour12End}:${String(endMinSlot).padStart(2, '0')} ${ampmEnd}`;

      // ✅ SKIP if slot has already ended and date is today
      if (date === currentDateStr && currentTimeMinutes >= endMins) {
        continue;
      }

      // ✅ SKIP if slot is already full
      const slotIsFull = Object.keys(slotMap).some(time => {
        const [h, m] = time.split(':');
        const timeMins = parseInt(h) * 60 + parseInt(m);
        return timeMins >= mins && timeMins < endMins && slotMap[time] >= maxOrder;
      });

      if (!slotIsFull) {
        availableSlots.push({
          value: `${slotStartStr} - ${slotEndStr}`,
          label: timeStr12
        });
      }
    }

    res.json({ availableSlots });

  } catch (err) {
    console.error('Slot API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// GET /api/slots/available
app.get('/api/slots-new/available', async (req, res) => {
  try {
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];

    const url = `https://${storeDomain}/admin/api/2024-01/orders.json?created_at_min=${currentDateStr}T00:00:00Z&created_at_max=${currentDateStr}T23:59:59Z`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    });

    const orders = response.data.orders;
    const slotCounts = {};

    for (const order of orders) {
      const deliveryTime = order.note_attributes.find(attr => attr.name === 'Delivery Time')?.value;
      if (deliveryTime) {
        slotCounts[deliveryTime] = (slotCounts[deliveryTime] || 0) + 1;
      }
    }

    res.json({ slotCounts });

  } catch (err) {
    console.error('Slot API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});





app.get('/slots/available', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'Missing date parameter' });

  const exampleSlots = ['10:00', '11:00', '12:00'];
  return res.json({ availableSlots: exampleSlots });
});

// Default route
app.get("/", (req, res) => {
  res.send("🟢 Order service is running.");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
