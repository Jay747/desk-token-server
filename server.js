const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

let currentToken = '';
let lastRefresh = 0;

app.use(cors());

app.get('/token', async (req, res) => {
  const now = Date.now();
  if (!currentToken || now - lastRefresh > 3500 * 1000) {
    try {
      const result = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
        params: {
          refresh_token: REFRESH_TOKEN,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'refresh_token'
        }
      });
      currentToken = result.data.access_token;
      lastRefresh = now;
      console.log('Token refreshed');
    } catch (err) {
      console.error('Error refreshing token', err.response?.data || err.message);
      return res.status(500).send('Token refresh failed');
    }
  }
  res.send(currentToken);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/token`);
});
