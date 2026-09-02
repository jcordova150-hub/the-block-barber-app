const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Conexión a MongoDB Atlas ----------

let db;
const SETTINGS_ID = 'main';

async function connectDB() {
  if (!MONGODB_URI) {
    console.error('Falta la variable de entorno MONGODB_URI. Configúrala antes de iniciar el servidor.');
    process.exit(1);
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db('barberApp');
  await ensureDefaults();
  console.log('Conectado a MongoDB correctamente.');
}

async function ensureDefaults() {
  const settingsCol = db.collection('settings');
  const existing = await settingsCol.findOne({ _id: SETTINGS_ID });
  if (!existing) {
    await settingsCol.insertOne({
      _id: SETTINGS_ID,
      name: 'THE BLOCK BARBER',
      tagline: 'Estilo · Precisión · Tradición',
      phone: '5660362095',
      staffPassword: 'BlockBarber2026!',
      stampsNeeded: 8,
      stampsPerRow: 4
    });
  }
  await db.collection('clients').createIndex({ id: 1 }, { unique: true });
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function publicSettings(s) {
  return {
    name: s.name,
    tagline: s.tagline,
    phone: s.phone,
    staffPassword: s.staffPassword,
    stampsNeeded: s.stampsNeeded,
    stampsPerRow: s.stampsPerRow
  };
}

// ---------- Autenticación simple para el personal ----------

async function requireStaff(req, res, next) {
  try {
    const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
    const provided = req.header('x-staff-password') || '';
    if (provided !== settings.staffPassword) {
      return res.status(401).json({ error: 'Contraseña de personal incorrecta.' });
    }
    next();
  } catch (e) {
    res.status(500).json({ error: 'Error de servidor.' });
  }
}

// ---------- Rutas de autenticación ----------

app.post('/api/login', async (req, res) => {
  try {
    const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
    const { password } = req.body || {};
    if (password === settings.staffPassword) {
      return res.json({ ok: true });
    }
    return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
  } catch (e) {
    res.status(500).json({ error: 'Error de servidor.' });
  }
});

// ---------- Configuración del negocio ----------

app.get('/api/settings', requireStaff, async (req, res) => {
  const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
  res.json(publicSettings(settings));
});

app.put('/api/settings', requireStaff, async (req, res) => {
  const { name, tagline, phone, newPassword, stampsNeeded, stampsPerRow } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = String(name).slice(0, 60);
  if (tagline !== undefined) update.tagline = String(tagline).slice(0, 60);
  if (phone !== undefined) update.phone = String(phone).slice(0, 30);
  if (newPassword) update.staffPassword = String(newPassword).slice(0, 60);
  if (stampsNeeded) update.stampsNeeded = Math.max(1, Math.min(30, parseInt(stampsNeeded)));
  if (stampsPerRow) update.stampsPerRow = Math.max(1, Math.min(10, parseInt(stampsPerRow)));

  await db.collection('settings').updateOne({ _id: SETTINGS_ID }, { $set: update });
  const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
  res.json(publicSettings(settings));
});

// ---------- Clientes (protegido: solo personal) ----------

app.get('/api/clients', requireStaff, async (req, res) => {
  const clients = await db.collection('clients').find({}, { projection: { _id: 0 } }).toArray();
  res.json(clients);
});

app.post('/api/clients', requireStaff, async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  }
  const client = {
    id: crypto.randomBytes(6).toString('hex'),
    name: name.trim().slice(0, 60),
    phone: (phone || '').trim().slice(0, 30),
    createdAt: todayStr(),
    stamps: []
  };
  await db.collection('clients').insertOne(client);
  delete client._id;
  res.status(201).json(client);
});

app.delete('/api/clients/:id', requireStaff, async (req, res) => {
  await db.collection('clients').deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

app.post('/api/clients/:id/stamp', requireStaff, async (req, res) => {
  const client = await db.collection('clients').findOne({ id: req.params.id });
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado.' });
  const today = todayStr();
  if (!client.stamps.includes(today)) {
    await db.collection('clients').updateOne({ id: req.params.id }, { $push: { stamps: today } });
  }
  const updated = await db.collection('clients').findOne({ id: req.params.id }, { projection: { _id: 0 } });
  res.json(updated);
});

app.post('/api/clients/:id/reset', requireStaff, async (req, res) => {
  const client = await db.collection('clients').findOne({ id: req.params.id });
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado.' });
  await db.collection('clients').updateOne({ id: req.params.id }, { $set: { stamps: [] } });
  const updated = await db.collection('clients').findOne({ id: req.params.id }, { projection: { _id: 0 } });
  res.json(updated);
});

// ---------- Tarjeta pública del cliente (SIN autenticación) ----------

app.get('/api/card/:id', async (req, res) => {
  const client = await db.collection('clients').findOne({ id: req.params.id });
  if (!client) return res.status(404).json({ error: 'Tarjeta no encontrada.' });
  const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
  res.json({
    client: {
      name: client.name,
      phone: client.phone,
      createdAt: client.createdAt,
      stamps: client.stamps
    },
    business: {
      name: settings.name,
      tagline: settings.tagline,
      phone: settings.phone,
      stampsNeeded: settings.stampsNeeded,
      stampsPerRow: settings.stampsPerRow
    }
  });
});

app.get('/card/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'card.html'));
});

// ---------- Arranque ----------

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('Barbería app corriendo en el puerto ' + PORT);
    });
  })
  .catch(err => {
    console.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  });
