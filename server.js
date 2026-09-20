const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const menuRoutes = require('./src/routes/menu.routes');
const orderRoutes = require('./src/routes/order.routes');
const tableRoutes = require('./src/routes/table.routes');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.set('io', io);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/qr-codes', express.static(path.join(__dirname, 'qr-codes')));

app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Default landing page -> table selector / admin & kitchen shortcuts
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

server.listen(PORT, () => {
  console.log(`\nRestaurant QR Ordering System running`);
  console.log(`  Landing page:   http://localhost:${PORT}`);
  console.log(`  Customer menu:  http://localhost:${PORT}/customer.html?table=1`);
  console.log(`  Kitchen screen: http://localhost:${PORT}/kitchen.html`);
  console.log(`  Admin panel:    http://localhost:${PORT}/admin.html\n`);
});
