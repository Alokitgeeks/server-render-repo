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
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Get all orders
app.get('/api/orders/all', async (req, res) => {
  try {
    const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const orders = response.data.orders.map(order => ({
      name: order.name,
      email: order.email,
      total_price: order.total_price,
      created_at: order.created_at
    }));

    res.json({ orders });

  } catch (error) {
    console.error("Error fetching all orders:", error.message);
    res.status(500).json({ error: "❌ Failed to fetch orders" });
  }
});

// Check order limit
app.get('/api/orders/check', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 5);
    const hours = Number(req.query.hours || 2);

    const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?created_at_min=${sinceTime}`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const orders = response.data.orders;
    const orderCount = orders.length;

    if (orderCount >= limit) {
      const oldestOrder = new Date(orders[0].created_at).getTime();
      const nextAllowedTime = oldestOrder + hours * 60 * 60 * 1000;
      const now = Date.now();
      const waitSeconds = Math.max(0, Math.floor((nextAllowedTime - now) / 1000));

      return res.json({
        allowed: false,
        wait_seconds: waitSeconds,
        message: `⚠️ Limit reached. Try again in ${Math.floor(waitSeconds / 60)} min.`
      });
    }

    res.json({
      allowed: true,
      orderCount,
      message: "✅ You're allowed to checkout."
    });

  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).json({ allowed: false, reason: "server_error" });
  }
});


app.get('/api/check-scope', async (req, res) => {
  try {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ Scope Test Success:", response.data.shop);
    res.json({
      success: true,
      shopName: response.data.shop.name,
      email: response.data.shop.email,
      domain: response.data.shop.domain,
      message: "✅ Admin API credentials are working!"
    });
  } catch (error) {
    console.error("❌ Admin API Scope Error:", error.message);
    res.status(500).json({
      success: false,
      message: "❌ Admin API credentials or scope may be incorrect.",
      error: error.message
    });
  }
});

app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: "🟢 Server is running from Node.js" });
});

app.get("/", (req, res) => {
  res.send("🟢 Order service is running.");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
