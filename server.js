require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Card = require('./models/Card');

const QRCode = require('qrcode');
const session = require('express-session');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = 'mongodb://nithsonbarragan03_db_user:chloe12345@ac-woajqza-shard-00-00.ftjxrxh.mongodb.net:27017,ac-woajqza-shard-00-01.ftjxrxh.mongodb.net:27017,ac-woajqza-shard-00-02.ftjxrxh.mongodb.net:27017/?ssl=true&replicaSet=atlas-m8wmr1-shard-0&authSource=admin';

// Configuración de middlewares con límite ampliado para imágenes Base64
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.json({ limit: '25mb' }));

// Servir archivos estáticos desde ruta absoluta garantizada
const publicDirectory = path.join(__dirname, 'public');
app.use(express.static(publicDirectory));
app.use('/public', express.static(publicDirectory));

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
        if (cardObj.logoUrl && typeof cardObj.logoUrl === 'string') {
          let cleanLogo = cardObj.logoUrl.trim();
          if (cleanLogo && !cleanLogo.startsWith('data:') && !cleanLogo.startsWith('http://') && !cleanLogo.startsWith('https://') && !cleanLogo.startsWith('/')) {
            cleanLogo = '/' + cleanLogo.replace(/\\/g, '/');
          }
          cardObj.logoUrl = cleanLogo;
        }
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
      if (selectedCard && selectedCard.logoUrl && typeof selectedCard.logoUrl === 'string') {
        let cleanLogo = selectedCard.logoUrl.trim();
        if (cleanLogo && !cleanLogo.startsWith('data:') && !cleanLogo.startsWith('http://') && !cleanLogo.startsWith('https://') && !cleanLogo.startsWith('/')) {
          cleanLogo = '/' + cleanLogo.replace(/\\/g, '/');
        }
        selectedCard.logoUrl = cleanLogo;
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
 * Permite guardar logo en formato Base64 o URL directa
 */
app.post('/admin/update/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const {
      businessName,
      location,
      whatsappNumber,
      whatsappTitle,
      whatsappSubtitle,
      whatsappNumber2,
      whatsapp2Title,
      whatsapp2Subtitle,
      contactPhone,
      instagramUrl,
      instagramTitle,
      instagramSubtitle,
      facebookUrl,
      facebookTitle,
      facebookSubtitle,
      tiktokUrl,
      tiktokTitle,
      tiktokSubtitle,
      websiteUrl,
      websiteTitle,
      websiteSubtitle,
      googleReviewsUrl,
      googleReviewsTitle,
      googleReviewsSubtitle,
      logoBase64,
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

    // Asignación de títulos y subtítulos con valores por defecto
    const finalWhatsappTitle = (whatsappTitle && whatsappTitle.trim()) ? whatsappTitle.trim() : 'WhatsApp Principal';
    const finalWhatsappSubtitle = (whatsappSubtitle && whatsappSubtitle.trim()) ? whatsappSubtitle.trim() : 'Atención inmediata por chat';

    const finalWhatsapp2Title = (whatsapp2Title && whatsapp2Title.trim()) ? whatsapp2Title.trim() : 'Segundo WhatsApp';
    const finalWhatsapp2Subtitle = (whatsapp2Subtitle && whatsapp2Subtitle.trim()) ? whatsapp2Subtitle.trim() : 'Línea secundaria de atención';

    const finalInstagramTitle = (instagramTitle && instagramTitle.trim()) ? instagramTitle.trim() : 'Síguenos en Instagram';
    const finalInstagramSubtitle = (instagramSubtitle && instagramSubtitle.trim()) ? instagramSubtitle.trim() : 'Novedades, fotos y catálogo';

    const finalFacebookTitle = (facebookTitle && facebookTitle.trim()) ? facebookTitle.trim() : 'Síguenos en Facebook';
    const finalFacebookSubtitle = (facebookSubtitle && facebookSubtitle.trim()) ? facebookSubtitle.trim() : 'Comunidad, noticias y eventos';

    const finalTiktokTitle = (tiktokTitle && tiktokTitle.trim()) ? tiktokTitle.trim() : 'Síguenos en TikTok';
    const finalTiktokSubtitle = (tiktokSubtitle && tiktokSubtitle.trim()) ? tiktokSubtitle.trim() : 'Videos y contenido exclusivo';

    const finalWebsiteTitle = (websiteTitle && websiteTitle.trim()) ? websiteTitle.trim() : 'Visita Nuestro Sitio Web';
    const finalWebsiteSubtitle = (websiteSubtitle && websiteSubtitle.trim()) ? websiteSubtitle.trim() : 'Tienda virtual y catálogo oficial';

    const finalGoogleReviewsTitle = (googleReviewsTitle && googleReviewsTitle.trim()) ? googleReviewsTitle.trim() : 'Ubicación del Local';
    const finalGoogleReviewsSubtitle = (googleReviewsSubtitle && googleReviewsSubtitle.trim()) ? googleReviewsSubtitle.trim() : 'Ver en Google Maps • Cómo llegar';

    // Teléfono para vCard: únicamente el valor explícitamente ingresado por el usuario
    const finalContactPhone = (contactPhone && contactPhone.trim()) ? contactPhone.trim() : '';

    // Buscar tarjeta actual para mantener el logo si no se sube uno nuevo ni se borra
    const currentCard = await Card.findOne({ cardId: cardId.trim() });
    let finalLogoUrl = currentCard ? (currentCard.logoUrl || '') : '';

    if (removeLogo === 'true' || removeLogo === '1') {
      finalLogoUrl = '';
    } else if (typeof logoBase64 === 'string' && logoBase64.trim().startsWith('data:image/')) {
      // Imagen convertida a Base64 en el cliente (MongoDB Atlas)
      finalLogoUrl = logoBase64.trim();
    } else if (typeof logoUrlCustom === 'string' && logoUrlCustom.trim() !== '') {
      // Se especificó una URL personalizada
      let custom = logoUrlCustom.trim();
      if (!custom.startsWith('data:') && !custom.startsWith('http://') && !custom.startsWith('https://') && !custom.startsWith('/')) {
        custom = '/' + custom.replace(/\\/g, '/');
      }
      finalLogoUrl = custom;
    }

    // Buscar y actualizar o crear si no existiese
    const updatedCard = await Card.findOneAndUpdate(
      { cardId: cardId.trim() },
      {
        businessName: cleanBusinessName,
        location: location ? location.trim() : '',
        whatsappNumber: whatsappNumber ? whatsappNumber.trim() : '',
        whatsappTitle: finalWhatsappTitle,
        whatsappSubtitle: finalWhatsappSubtitle,
        whatsappNumber2: whatsappNumber2 ? whatsappNumber2.trim() : '',
        whatsapp2Title: finalWhatsapp2Title,
        whatsapp2Subtitle: finalWhatsapp2Subtitle,
        contactPhone: finalContactPhone,
        instagramUrl: instagramUrl ? instagramUrl.trim() : '',
        instagramTitle: finalInstagramTitle,
        instagramSubtitle: finalInstagramSubtitle,
        facebookUrl: facebookUrl ? facebookUrl.trim() : '',
        facebookTitle: finalFacebookTitle,
        facebookSubtitle: finalFacebookSubtitle,
        tiktokUrl: tiktokUrl ? tiktokUrl.trim() : '',
        tiktokTitle: finalTiktokTitle,
        tiktokSubtitle: finalTiktokSubtitle,
        websiteUrl: websiteUrl ? websiteUrl.trim() : '',
        websiteTitle: finalWebsiteTitle,
        websiteSubtitle: finalWebsiteSubtitle,
        googleReviewsUrl: googleReviewsUrl ? googleReviewsUrl.trim() : '',
        googleReviewsTitle: finalGoogleReviewsTitle,
        googleReviewsSubtitle: finalGoogleReviewsSubtitle,
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
        whatsappTitle: 'WhatsApp Principal',
        whatsappSubtitle: 'Atención inmediata por chat',
        whatsappNumber2: '',
        whatsapp2Title: 'Segundo WhatsApp',
        whatsapp2Subtitle: 'Línea secundaria de atención',
        contactPhone: '',
        instagramUrl: '',
        instagramTitle: 'Síguenos en Instagram',
        instagramSubtitle: 'Novedades, fotos y catálogo',
        facebookUrl: '',
        facebookTitle: 'Síguenos en Facebook',
        facebookSubtitle: 'Comunidad, noticias y eventos',
        tiktokUrl: '',
        tiktokTitle: 'Síguenos en TikTok',
        tiktokSubtitle: 'Videos y contenido exclusivo',
        websiteUrl: '',
        websiteTitle: 'Visita Nuestro Sitio Web',
        websiteSubtitle: 'Tienda virtual y catálogo oficial',
        googleReviewsUrl: '',
        googleReviewsTitle: 'Ubicación del Local',
        googleReviewsSubtitle: 'Ver en Google Maps • Cómo llegar',
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
 * GET /p/:cardId/save-contact
 * Genera y descarga dinámicamente un archivo de contacto estándar vCard (.vcf)
 * Compatible con iOS (iPhone Contactos) y Android (Google Contactos)
 */
app.get('/p/:cardId/save-contact', async (req, res) => {
  try {
    const { cardId } = req.params;
    const cleanId = cardId.trim();

    const card = await Card.findOne({ cardId: cleanId });

    if (!card || card.status !== 'assigned') {
      return res.redirect(`/p/${encodeURIComponent(cleanId)}`);
    }

    const businessName = (card.businessName || 'Contacto Comercial').trim();
    // Uso 100% exclusivo del campo contactPhone; sin fallbacks ni inclusión de otros números
    const cleanContactPhone = (card.contactPhone || '').replace(/[^\d+]/g, '');
    const location = (card.location || '').trim();
    const website = (card.websiteUrl || '').trim();

    // Construcción estricta de vCard versión 3.0 con soporte UTF-8
    const vcardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN;CHARSET=UTF-8:${businessName}`,
      `ORG;CHARSET=UTF-8:${businessName}`
    ];

    // Solo se incluye la etiqueta TEL si el usuario ingresó un valor en contactPhone
    if (cleanContactPhone) {
      vcardLines.push(`TEL;TYPE=CELL,VOICE:${cleanContactPhone}`);
    }

    if (location) {
      const safeLoc = location.replace(/;/g, '\\;').replace(/,/g, '\\,');
      vcardLines.push(`ADR;TYPE=WORK;CHARSET=UTF-8:;;${safeLoc};;;;`);
    }

    if (website) {
      vcardLines.push(`URL:${website}`);
    }

    vcardLines.push(`NOTE;CHARSET=UTF-8:Contacto verificado de Tarjeta Inteligente NithSoft #${cleanId}`);
    vcardLines.push('END:VCARD');

    const vcfContent = vcardLines.join('\r\n') + '\r\n';

    // Nombre de archivo seguro para descargar
    const cleanFileName = businessName
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_') || `contacto_${cleanId}`;

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}.vcf"`);
    res.send(vcfContent);
  } catch (error) {
    console.error('Error al generar vCard (.vcf):', error);
    res.status(500).send('Error al generar archivo de contacto.');
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
