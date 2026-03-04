const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const http = require('http');

// Safe load tiktok-live-connector
let WebcastPushConnection;
try {
  WebcastPushConnection = require('tiktok-live-connector').WebcastPushConnection;
  console.log('✅ tiktok-live-connector loaded');
} catch(e) {
  console.error('❌ tiktok-live-connector failed to load:', e.message);
  WebcastPushConnection = null;
}

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── State ──
let tiktokConnection = null;
let connectedClients = new Set();
let currentUsername = null;
let isConnected = false;

// ── Data Wilayah ──
const worldRegions = {
  ID: {
    name: 'Indonesia', flag: '🇮🇩',
    cities: [
      { name: 'Jakarta',    lat: -6.2088,  lng: 106.8456 },
      { name: 'Surabaya',   lat: -7.2575,  lng: 112.7521 },
      { name: 'Bandung',    lat: -6.9175,  lng: 107.6191 },
      { name: 'Medan',      lat: 3.5952,   lng: 98.6722  },
      { name: 'Makassar',   lat: -5.1477,  lng: 119.4327 },
      { name: 'Palembang',  lat: -2.9761,  lng: 104.7754 },
      { name: 'Semarang',   lat: -6.9932,  lng: 110.4203 },
      { name: 'Yogyakarta', lat: -7.7956,  lng: 110.3695 },
      { name: 'Denpasar',   lat: -8.6705,  lng: 115.2126 },
      { name: 'Malang',     lat: -7.9797,  lng: 112.6304 },
      { name: 'Tangerang',  lat: -6.1783,  lng: 106.6319 },
      { name: 'Depok',      lat: -6.4025,  lng: 106.7942 },
      { name: 'Bekasi',     lat: -6.2383,  lng: 106.9756 },
      { name: 'Bogor',      lat: -6.5971,  lng: 106.8060 },
      { name: 'Pekanbaru',  lat: 0.5071,   lng: 101.4478 },
      { name: 'Batam',      lat: 1.0457,   lng: 104.0305 },
      { name: 'Balikpapan', lat: -1.2675,  lng: 116.8289 },
      { name: 'Samarinda',  lat: -0.5022,  lng: 117.1536 },
      { name: 'Banjarmasin',lat: -3.3194,  lng: 114.5908 },
      { name: 'Pontianak',  lat: -0.0263,  lng: 109.3425 },
      { name: 'Manado',     lat: 1.4748,   lng: 124.8421 },
      { name: 'Padang',     lat: -0.9471,  lng: 100.4172 },
      { name: 'Aceh',       lat: 5.5483,   lng: 95.3238  },
      { name: 'Jayapura',   lat: -2.5916,  lng: 140.6690 },
      { name: 'Kupang',     lat: -10.1772, lng: 123.6070 },
    ]
  },
  MY: { name: 'Malaysia',     flag: '🇲🇾', cities: [{ name: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869 }, { name: 'Penang', lat: 5.4141, lng: 100.3288 }, { name: 'Johor Bahru', lat: 1.4927, lng: 103.7414 }] },
  SG: { name: 'Singapore',    flag: '🇸🇬', cities: [{ name: 'Singapore', lat: 1.3521, lng: 103.8198 }] },
  TH: { name: 'Thailand',     flag: '🇹🇭', cities: [{ name: 'Bangkok', lat: 13.7563, lng: 100.5018 }, { name: 'Chiang Mai', lat: 18.7883, lng: 98.9853 }] },
  PH: { name: 'Philippines',  flag: '🇵🇭', cities: [{ name: 'Manila', lat: 14.5995, lng: 120.9842 }, { name: 'Cebu', lat: 10.3157, lng: 123.8854 }] },
  VN: { name: 'Vietnam',      flag: '🇻🇳', cities: [{ name: 'Ho Chi Minh City', lat: 10.8231, lng: 106.6297 }, { name: 'Hanoi', lat: 21.0285, lng: 105.8542 }] },
  JP: { name: 'Japan',        flag: '🇯🇵', cities: [{ name: 'Tokyo', lat: 35.6762, lng: 139.6503 }, { name: 'Osaka', lat: 34.6937, lng: 135.5023 }] },
  KR: { name: 'South Korea',  flag: '🇰🇷', cities: [{ name: 'Seoul', lat: 37.5665, lng: 126.9780 }, { name: 'Busan', lat: 35.1796, lng: 129.0756 }] },
  US: { name: 'United States',flag: '🇺🇸', cities: [{ name: 'New York', lat: 40.7128, lng: -74.0060 }, { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 }] },
  GB: { name: 'United Kingdom',flag:'🇬🇧', cities: [{ name: 'London', lat: 51.5074, lng: -0.1278 }] },
  AU: { name: 'Australia',    flag: '🇦🇺', cities: [{ name: 'Sydney', lat: -33.8688, lng: 151.2093 }, { name: 'Melbourne', lat: -37.8136, lng: 144.9631 }] },
  SA: { name: 'Saudi Arabia', flag: '🇸🇦', cities: [{ name: 'Riyadh', lat: 24.7136, lng: 46.6753 }, { name: 'Jeddah', lat: 21.4858, lng: 39.1925 }] },
  IN: { name: 'India',        flag: '🇮🇳', cities: [{ name: 'Mumbai', lat: 19.0760, lng: 72.8777 }, { name: 'Delhi', lat: 28.6139, lng: 77.2090 }] },
  EG: { name: 'Egypt',        flag: '🇪🇬', cities: [{ name: 'Cairo', lat: 30.0444, lng: 31.2357 }] },
  TR: { name: 'Turkey',       flag: '🇹🇷', cities: [{ name: 'Istanbul', lat: 41.0082, lng: 28.9784 }] },
  BR: { name: 'Brazil',       flag: '🇧🇷', cities: [{ name: 'São Paulo', lat: -23.5505, lng: -46.6333 }] },
};

// Map TikTok locale → country code
const localeToCountry = {
  'id': 'ID', 'id-ID': 'ID',
  'ms': 'MY', 'ms-MY': 'MY',
  'en-SG': 'SG',
  'th': 'TH', 'th-TH': 'TH',
  'tl': 'PH', 'fil': 'PH',
  'vi': 'VN', 'vi-VN': 'VN',
  'ja': 'JP', 'ja-JP': 'JP',
  'ko': 'KR', 'ko-KR': 'KR',
  'en-US': 'US', 'en': 'US',
  'en-GB': 'GB',
  'en-AU': 'AU',
  'ar': 'SA', 'ar-SA': 'SA',
  'hi': 'IN', 'hi-IN': 'IN',
  'ar-EG': 'EG',
  'tr': 'TR', 'tr-TR': 'TR',
  'pt': 'BR', 'pt-BR': 'BR',
};

// Weight: Indonesia 60%
const countryWeights = [
  ...Array(60).fill('ID'),
  ...Array(8).fill('MY'),
  ...Array(4).fill('SG'),
  ...Array(4).fill('TH'),
  ...Array(4).fill('PH'),
  ...Array(3).fill('VN'),
  ...Array(3).fill('JP'),
  ...Array(3).fill('KR'),
  ...Array(3).fill('US'),
  ...Array(2).fill('GB'),
  ...Array(2).fill('AU'),
  ...Array(2).fill('SA'),
  ...Array(2).fill('IN'),
];

function getLocation(user) {
  // Coba deteksi dari locale/region user TikTok
  let code = null;
  if (user.locale) code = localeToCountry[user.locale] || localeToCountry[user.locale.split('-')[0]];
  if (!code && user.region) code = user.region.toUpperCase();
  if (!code || !worldRegions[code]) {
    // Fallback ke random weighted
    code = countryWeights[Math.floor(Math.random() * countryWeights.length)];
  }

  const region = worldRegions[code];
  const city = region.cities[Math.floor(Math.random() * region.cities.length)];
  const jitter = () => (Math.random() - 0.5) * 0.4;

  return {
    countryCode: code,
    countryName: region.name,
    flag: region.flag,
    city: city.name,
    lat: city.lat + jitter(),
    lng: city.lng + jitter(),
  };
}

// ── Broadcast ke semua WS clients ──
function broadcast(data) {
  const msg = JSON.stringify(data);
  connectedClients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

// ── WebSocket ──
wss.on('connection', (ws) => {
  connectedClients.add(ws);
  console.log('Client connected, total:', connectedClients.size);

  // Kirim status saat ini
  ws.send(JSON.stringify({
    type: 'status',
    connected: isConnected,
    username: currentUsername
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log('Client disconnected, total:', connectedClients.size);
  });
});

// ── Gift handler ──
const TARGET_GIFT_NAME = 'rosa';  // nama gift (case-insensitive)
const TARGET_GIFT_COINS = 10;     // nilai koin ROSA = 10

function handleGift(data) {
  try {
    const giftName = (data.giftName || data.gift?.name || '').trim();
    const coins = data.diamondCount ?? data.giftDetails?.diamondCount ?? null;

    const user = data.user || {};
    const username = user.uniqueId || user.nickname || 'viewer';

    // Validasi 1: nama gift harus ROSA (case-insensitive)
    const isRosaName = giftName.toLowerCase() === TARGET_GIFT_NAME;

    // Validasi 2: nilai koin harus 10 (null = tidak diketahui, tetap lolos)
    const isRosaCoins = coins === null || coins === TARGET_GIFT_COINS;

    // Jika gift bukan ROSA atau koin salah → kirim peringatan ke frontend
    if (!isRosaName || !isRosaCoins) {
      console.log(`⚠️ Gift bukan ROSA dari @${username}: "${giftName}" (${coins} koin)`);
      broadcast({
        type: 'wrong_gift',
        username,
        giftName: giftName || '?',
        giftCoins: coins ?? '?',
      });
      return;
    }

    const location = getLocation(user);
    console.log(`🌹 Gift ROSA (10 koin) dari @${username} → ${location.city}, ${location.countryName}`);

    broadcast({
      type: 'gift',
      username,
      nickname: user.nickname || username,
      giftName: giftName,
      giftEmoji: '🌹',
      giftCoins: TARGET_GIFT_COINS,
      location,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('handleGift error:', e);
  }
}

// ── REST API: Connect TikTok ──
app.post('/connect', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  // Disconnect dulu kalau sudah ada
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
    tiktokConnection = null;
    isConnected = false;
  }

  try {
    if (!WebcastPushConnection) {
      return res.status(500).json({ error: 'tiktok-live-connector not available. Check server logs.' });
    }
    console.log(`Connecting to @${username}...`);
    tiktokConnection = new WebcastPushConnection(username, {
      processInitialData: false,
      enableExtendedGiftInfo: true,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 2000,
    });

    tiktokConnection.on('gift', handleGift);

    tiktokConnection.on('connected', (state) => {
      isConnected = true;
      currentUsername = username;
      console.log(`✅ Connected to @${username}`);
      broadcast({ type: 'tiktok_connected', username });
    });

    tiktokConnection.on('disconnected', () => {
      isConnected = false;
      console.log(`❌ Disconnected from @${username}`);
      broadcast({ type: 'tiktok_disconnected' });
      // Auto reconnect setelah 10 detik
      setTimeout(() => {
        if (!isConnected && tiktokConnection) {
          console.log(`🔄 Auto reconnecting to @${username}...`);
          tiktokConnection.connect().catch(e => console.error('Reconnect failed:', e.message));
        }
      }, 10000);
    });

    tiktokConnection.on('error', (err) => {
      const msg = (err && (err.message || err.info || JSON.stringify(err))) || 'Connection error';
      console.error('TikTok error:', msg);
      broadcast({ type: 'error', message: msg });
    });

    // Connect dengan timeout 15 detik
    const connectPromise = tiktokConnection.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout - pastikan kamu sedang LIVE')), 15000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    currentUsername = username;
    isConnected = true;

    res.json({ success: true, message: `Connected to @${username}` });
  } catch (err) {
    const errMsg = (err && err.message) || 'Failed to connect';
    console.error('Connect error:', errMsg);
    // Tetap kirim response agar frontend tidak hang
    if (!res.headersSent) {
      res.status(500).json({ error: errMsg });
    }
    broadcast({ type: 'error', message: errMsg });
  }
});

// ── REST API: Disconnect ──
app.post('/disconnect', (req, res) => {
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
    tiktokConnection = null;
  }
  isConnected = false;
  currentUsername = null;
  broadcast({ type: 'tiktok_disconnected' });
  res.json({ success: true });
});

// ── REST API: Status ──
app.get('/status', (req, res) => {
  res.json({ connected: isConnected, username: currentUsername });
});

// ── Serve frontend ──
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
