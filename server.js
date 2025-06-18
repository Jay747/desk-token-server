const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors()); // Enable CORS for all routes

const PORT = process.env.PORT || 3000;

const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_API_BASE = "https://desk.zoho.com/api/v1";

let accessToken = null;
let tokenExpiry = 0;

async function refreshAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60 * 1000) {
    return accessToken;
  }

  const params = new URLSearchParams({
    refresh_token: process.env.REFRESH_TOKEN,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: "refresh_token"
  });

  const res = await fetch(`${TOKEN_URL}?${params.toString()}`, {
    method: "POST"
  });

  const data = await res.json();

  if (data.access_token) {
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    return accessToken;
  } else {
    console.error("Token refresh failed", data);
    throw new Error("Token refresh failed");
  }
}

// GET /token (same as before)
app.get("/token", async (req, res) => {
  try {
    const token = await refreshAccessToken();
    res.send(token);
  } catch (err) {
    res.status(500).send("Token refresh failed");
  }
});

// NEW: GET /tickets → returns open tickets from Zoho Desk
app.get("/tickets", async (req, res) => {
  try {
    const token = await refreshAccessToken();
    const zohoRes = await fetch(`${ZOHO_API_BASE}/tickets?status=open`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`
      }
    });

    const data = await zohoRes.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
