require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Card = require('./models/Card');

const QRCode = require('qrcode');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar que la carpeta de subidas de logos exista
const uploadDir = path.join(__dirname, 'public', 'uploads', 'logos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento Multer para Logos de Negocios
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const cardId = (req.params.cardId || 'card').replace(/[^a-zA-Z0-9_-]/g, '');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `logo-${cardId}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Aceptar formatos comunes de imagen
  const allowed = /jpeg|jpg|png|webp|svg|gif/i;
  const isMime = allowed.test(file.mimetype);
  const isExt = allowed.test(path.extname(file.originalname).toLowerCase());
  if (isMime || isExt) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPG, PNG, WebP, SVG, GIF)'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter
});

const MONGODB_URI = 'mongodb://nithsonbarragan03_db_user:chloe12345@ac-woajqza-shard-00-00.ftjxrxh.mongodb.net:27017,ac-woajqza-shard-00-01.ftjxrxh.mongodb.net:27017,ac-woajqza-shard-00-02.ftjxrxh.mongodb.net:27017/?ssl=true&replicaSet=atlas-m8wmr1-shard-0&authSource=admin';


// Configuración de middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesiones
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'nfcards_secure_session_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 24 horas de sesión
    }
  })
);

// Middleware de autenticación para proteger el panel de administración
function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  return res.redirect('/login');
}

// Configuración de motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Conexión a MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado exitosamente a MongoDB');
  })
  .catch((err) => {
    console.error('❌ Error de conexión a MongoDB:', err.message);
  });

// Ruta raíz: redirige al panel admin (o login si no está autenticado)
app.get('/', (req, res) => {
  res.redirect('/admin');
});

/**
 * GET /login
 * Formulario de autenticación administrativo
 */
app.get('/login', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    return res.redirect('/admin');
  }
  res.render('login', {
    error: req.query.err || null,
    message: req.query.msg || null
  });
});

/**
 * POST /login
 * Valida la contraseña maestra configurada en ADMIN_PASSWORD
 */
app.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin12345').trim();

  if (password && password.trim() === adminPassword) {
    req.session.isAuthenticated = true;
    return res.redirect('/admin');
  } else {
    return res.redirect('/login?err=' + encodeURIComponent('Contraseña administrativa incorrecta'));
  }
});

/**
 * ALL /logout
 * Destruye la sesión activa y redirige al login
 */
app.all('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/login?msg=' + encodeURIComponent('Sesión cerrada correctamente'));
    });
  } else {
    res.redirect('/login');
  }
});

// Proteger todas las rutas del panel y operaciones administrativas
app.use('/admin', requireAuth);

/**
 * GET /admin
 * Panel de administración: lista todas las tarjetas con su QR generado dinámicamente
 */
app.get('/admin', async (req, res) => {
  try {
    let cards;
    try {
      cards = await Card.find().collation({ locale: 'en', numericOrdering: true }).sort({ cardId: 1 });
    } catch (collationError) {
      cards = await Card.find().sort({ cardId: 1 });
    }
    const selectedId = req.query.edit;
    let selectedCard = null;

    // Detectar dinámicamente la URL base del servidor (ej: http://localhost:3000)
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Generar códigos QR para todas las tarjetas
    const cardsWithQr = await Promise.all(
      cards.map(async (card) => {
        const publicUrl = `${baseUrl}/p/${card.cardId}`;
        const qrDataUrl = await QRCode.toDataURL(publicUrl, {
          width: 300,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'H'
        });

        const cardObj = card.toObject({ virtuals: true });
        cardObj.publicUrl = publicUrl;
        cardObj.qrDataUrl = qrDataUrl;
        return cardObj;
      })
    );

    // Ordenamiento numérico ascendente robusto (001, 002, 003... 010, 011)
    cardsWithQr.sort((a, b) => {
      const numA = parseInt(String(a.cardId).replace(/\D/g, ''), 10);
      const numB = parseInt(String(b.cardId).replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return String(a.cardId).localeCompare(String(b.cardId), undefined, { numeric: true, sensitivity: 'base' });
    });

    if (selectedId) {
      selectedCard = cardsWithQr.find((c) => c.cardId === selectedId) || null;
      if (!selectedCard) {
        const dbCard = await Card.findOne({ cardId: selectedId });
        if (dbCard) {
          const publicUrl = `${baseUrl}/p/${dbCard.cardId}`;
          const qrDataUrl = await QRCode.toDataURL(publicUrl, {
            width: 300,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'H'
          });
          selectedCard = { ...dbCard.toObject({ virtuals: true }), publicUrl, qrDataUrl };
        }
      }
    }

    res.render('admin', {
      cards: cardsWithQr,
      selectedCard,
      baseUrl,
      message: req.query.msg || null,
      error: req.query.err || null
    });
  } catch (error) {
    console.error('Error al cargar panel admin:', error);
    res.status(500).send('Error interno del servidor al cargar el panel administrativo.');
  }
});

/**
 * GET /admin/qr/:cardId/download
 * Descarga el código QR en PNG de alta resolución (1024x1024) para impresión física
 */
app.get('/admin/qr/:cardId/download', async (req, res) => {
  try {
    const { cardId } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/p/${cardId.trim()}`;

    // Generar buffer en alta resolución (1024px)
    const qrBuffer = await QRCode.toBuffer(publicUrl, {
      width: 1024,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="QR-Tarjeta-${cardId.trim()}.png"`);
    res.send(qrBuffer);
  } catch (error) {
    console.error('Error al generar descarga de QR:', error);
    res.status(500).send('Error al generar el código QR para descarga.');
  }
});

/**
 * GET /admin/qr/:cardId/print
 * Vista limpia optimizada para imprimir el código QR con su sticker/tarjeta
 */
app.get('/admin/qr/:cardId/print', async (req, res) => {
  try {
    const { cardId } = req.params;
    const card = await Card.findOne({ cardId: cardId.trim() });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/p/${cardId.trim()}`;

    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 600,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H'
    });

    res.render('print-qr', {
      card: card || { cardId: cardId.trim(), businessName: 'Tarjeta Sin Asignar', status: 'available' },
      publicUrl,
      qrDataUrl
    });
  } catch (error) {
    console.error('Error al generar vista de impresión de QR:', error);
    res.status(500).send('Error al cargar la vista de impresión.');
  }

});

/**
 * POST /admin/create
 * Crea una nueva tarjeta física en el sistema con estado 'available'
 */
app.post('/admin/create', async (req, res) => {
  try {
    const { cardId } = req.body;
    if (!cardId || !cardId.trim()) {
      return res.redirect('/admin?err=' + encodeURIComponent('El ID de tarjeta es requerido'));
    }

    const cleanId = cardId.trim();
    const existing = await Card.findOne({ cardId: cleanId });
    if (existing) {
      return res.redirect('/admin?err=' + encodeURIComponent(`La tarjeta "${cleanId}" ya existe`));
    }

    await Card.create({
      cardId: cleanId,
      status: 'available'
    });

    res.redirect('/admin?msg=' + encodeURIComponent(`Tarjeta ${cleanId} registrada como disponible`));
  } catch (error) {
    console.error('Error al crear tarjeta:', error);
    res.redirect('/admin?err=' + encodeURIComponent('No se pudo crear la tarjeta: ' + error.message));
  }
});

/**
 * POST /admin/update/:cardId
 * Actualiza los datos del negocio y cambia el estado a 'assigned'
 * Permite subir archivo de logo o vincular una URL
 */
app.post('/admin/update/:cardId', (req, res, next) => {
  upload.single('logoFile')(req, res, (err) => {
    if (err) {
      console.error('Error al procesar subida de logo:', err);
      return res.redirect(`/admin?err=${encodeURIComponent('Error de imagen: ' + err.message)}&edit=${encodeURIComponent(req.params.cardId ? req.params.cardId.trim() : '')}`);
    }
    next();
  });
}, async (req, res) => {
  try {
    const { cardId } = req.params;
    const {
      businessName,
      location,
      whatsappNumber,
      whatsappNumber2,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      googleReviewsUrl,
      logoUrlCustom,
      removeLogo,
      status
    } = req.body;

    const newStatus = status || 'assigned';
    const cleanBusinessName = businessName ? businessName.trim() : '';

    // El único campo obligatorio para guardar si el estado es 'assigned' es el Nombre del Negocio
    if (newStatus === 'assigned' && !cleanBusinessName) {
      return res.redirect(`/admin?err=${encodeURIComponent('El nombre del negocio es obligatorio para asignar la tarjeta')}&edit=${encodeURIComponent(cardId.trim())}`);
    }

    // Buscar tarjeta actual para mantener el logo si no se sube uno nuevo ni se borra
    const currentCard = await Card.findOne({ cardId: cardId.trim() });
    let finalLogoUrl = currentCard ? (currentCard.logoUrl || '') : '';

    if (removeLogo === 'true' || removeLogo === '1') {
      finalLogoUrl = '';
    } else if (req.file) {
      // Se subió un archivo físico nuevo
      finalLogoUrl = `/uploads/logos/${req.file.filename}`;
    } else if (typeof logoUrlCustom === 'string' && logoUrlCustom.trim() !== '') {
      // Se especificó una URL personalizada
      finalLogoUrl = logoUrlCustom.trim();
    }

    // Buscar y actualizar o crear si no existiese
    const updatedCard = await Card.findOneAndUpdate(
      { cardId: cardId.trim() },
      {
        businessName: cleanBusinessName,
        location: location ? location.trim() : '',
        whatsappNumber: whatsappNumber ? whatsappNumber.trim() : '',
        whatsappNumber2: whatsappNumber2 ? whatsappNumber2.trim() : '',
        instagramUrl: instagramUrl ? instagramUrl.trim() : '',
        facebookUrl: facebookUrl ? facebookUrl.trim() : '',
        tiktokUrl: tiktokUrl ? tiktokUrl.trim() : '',
        googleReviewsUrl: googleReviewsUrl ? googleReviewsUrl.trim() : '',
        logoUrl: finalLogoUrl,
        status: newStatus,
        updatedAt: new Date()
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.redirect(`/admin?msg=${encodeURIComponent(`Tarjeta ${cardId} actualizada con éxito`)}&edit=${encodeURIComponent(cardId.trim())}`);
  } catch (error) {
    console.error('Error al actualizar tarjeta:', error);
    res.redirect(`/admin?err=${encodeURIComponent('Error al guardar datos: ' + error.message)}&edit=${encodeURIComponent(req.params.cardId || '')}`);
  }
});

/**
 * POST /admin/reset/:cardId
 * Restablece una tarjeta al estado 'available'
 */
app.post('/admin/reset/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    await Card.findOneAndUpdate(
      { cardId: cardId.trim() },
      {
        businessName: '',
        location: '',
        whatsappNumber: '',
        whatsappNumber2: '',
        instagramUrl: '',
        facebookUrl: '',
        tiktokUrl: '',
        googleReviewsUrl: '',
        logoUrl: '',
        status: 'available',
        scanCount: 0,
        updatedAt: new Date()
      }
    );
    res.redirect(`/admin?msg=${encodeURIComponent(`Tarjeta ${cardId} restablecida a disponible`)}`);
  } catch (error) {
    console.error('Error al restablecer tarjeta:', error);
    res.redirect(`/admin?err=${encodeURIComponent('Error al restablecer tarjeta')}`);
  }
});

/**
 * GET /p/:cardId
 * Ruta pública escaneada desde el NFC / Código QR
 * Incrementa automáticamente el contador de escaneos en cada lectura
 */
app.get('/p/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const cleanId = cardId.trim();

    // Buscar e incrementar atómicamente el contador de escaneos/visitas
    const card = await Card.findOneAndUpdate(
      { cardId: cleanId },
      { $inc: { scanCount: 1 } },
      { new: true }
    );

    // Si no existe la tarjeta en la BD o su estado es 'available'
    if (!card || card.status === 'available') {
      return res.render('available', {
        cardId: cleanId,
        cardExists: !!card
      });
    }

    // Si está 'assigned', renderizar la landing page móvil
    res.render('profile', {
      card
    });
  } catch (error) {
    console.error('Error al procesar lectura de tarjeta:', error);
    res.status(500).send('Error al procesar la tarjeta.');
  }
});

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`👉 Panel Admin: http://localhost:${PORT}/admin`);
  console.log(`👉 Ejemplo NFC: http://localhost:${PORT}/p/001`);
});
