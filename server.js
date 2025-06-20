const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_API = "https://desk.zoho.com/api/v1";

let accessToken = null;
let tokenExpiry = 0;

async function refreshAccessToken() {
  if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;

  const params = new URLSearchParams({
    refresh_token: process.env.REFRESH_TOKEN,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: "refresh_token"
  });

  const res = await fetch(`${TOKEN_URL}?${params.toString()}`, { method: "POST" });
  const data = await res.json();

  if (data.access_token) {
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    return accessToken;
  } else {
    throw new Error("Token refresh failed");
  }
}

function isoDate(date) {
  return date.toISOString().split(".")[0] + "Z";
}

function getMonthRanges() {
  const now = new Date();
  const ranges = [];

  for (let i = 2; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    ranges.push({
      label: from.toLocaleString("default", { month: "short" }),
      from: isoDate(from),
      to: isoDate(to)
    });
  }

  return ranges;
}

// 🔥 Tickets endpoint for dashboard
app.get("/tickets", async (req, res) => {
  try {
    const token = await refreshAccessToken();
    const headers = { Authorization: `Zoho-oauthtoken ${token}` };
    const monthRanges = getMonthRanges();
    const fromDate = monthRanges[0].from;

    const allTickets = [];
    let page = 1;
    const limit = 200;

    while (true) {
      const url = `${ZOHO_API}/tickets?limit=${limit}&page=${page}&sortBy=createdTime&sortOrder=desc&fromDateTime=${fromDate}`;
      console.log(`Fetching page ${page}`);
      const result = await fetch(url, { headers });
      const data = await result.json();

      if (!data.data || data.data.length === 0) break;

      allTickets.push(...data.data);
      if (data.data.length < limit) break;
      page++;
    }

    const monthlyCreated = [0, 0, 0];
    const monthlyClosed = [0, 0, 0];
    const statusCounts = {
      Open: 0,
      Closed: 0,
      "Agent Responded": 0,
      "Waiting on Customer": 0
    };

    allTickets.forEach(t => {
      const created = new Date(t.createdTime);
      const status = t.status;

      // Count status (for current month only)
      if (created >= new Date(monthRanges[2].from)) {
        if (statusCounts[status] !== undefined) statusCounts[status]++;
      }

      // Group by month
      monthRanges.forEach((range, i) => {
        if (created >= new Date(range.from) && created < new Date(range.to)) {
          monthlyCreated[i]++;
          if (status === "Closed") monthlyClosed[i]++;
        }
      });
    });

    res.json({
      statusCounts,
      months: monthRanges.map(r => r.label),
      createdCounts: monthlyCreated,
      closedCounts: monthlyClosed
    });

  } catch (err) {
    console.error("Error in /tickets:", err);
    res.status(500).json({ error: "Failed to fetch ticket data" });
  }
});


// 🧪 Optional: for testing token manually
app.get("/token", async (req, res) => {
  try {
    const token = await refreshAccessToken();
    res.send(token);
  } catch {
    res.status(500).send("Token refresh failed");
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

