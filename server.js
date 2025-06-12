const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/api/orders/check', async (req, res) => {
  try {
    const sinceTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
    const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?created_at_min=${sinceTime}`;

    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const orders = response.data.orders;
    const orderCount = orders.length;

    if (orderCount >= 10) {
      return res.json({
        allowed: false,
        reason: "limit",
        message: "⚠️ 10 orders already placed in the last 2 hours."
      });
    }

    res.json({
      allowed: true,
      orderCount,
      message: "✅ You're allowed to checkout."
    });

  } catch (error) {
    console.error("Error checking orders:", error.message);
    res.status(500).json({
      allowed: false,
      reason: "server_error",
      message: "⚠️ Error while checking order status"
    });
  }
});

app.get("/", (req, res) => {
  res.send("🟢 Order check service is running.");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
