const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'operational', service: 'Haras AI', version: '1.0' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️  حارس يعمل على المنفذ ${PORT}`);
});