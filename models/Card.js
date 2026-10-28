const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  cardId: {
    type: String,
    required: [true, 'El cardId es obligatorio'],
    unique: true,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['available', 'assigned'],
    default: 'available'
  },
  businessName: {
    type: String,
    trim: true,
    default: ''
  },
  instagramUrl: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  instagramTitle: {
    type: String,
    trim: true,
    default: 'Síguenos en Instagram',
    required: false
  },
  instagramSubtitle: {
    type: String,
    trim: true,
    default: 'Novedades, fotos y catálogo',
    required: false
  },
  facebookUrl: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  facebookTitle: {
    type: String,
    trim: true,
    default: 'Síguenos en Facebook',
    required: false
  },
  facebookSubtitle: {
    type: String,
    trim: true,
    default: 'Comunidad, noticias y eventos',
    required: false
  },
  whatsappNumber: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  whatsappTitle: {
    type: String,
    trim: true,
    default: 'WhatsApp Principal',
    required: false
  },
  whatsappSubtitle: {
    type: String,
    trim: true,
    default: 'Atención inmediata por chat',
    required: false
  },
  whatsappNumber2: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  whatsapp2Title: {
    type: String,
    trim: true,
    default: 'Segundo WhatsApp',
    required: false
  },
  whatsapp2Subtitle: {
    type: String,
    trim: true,
    default: 'Línea secundaria de atención',
    required: false
  },
  contactPhone: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  tiktokUrl: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  tiktokTitle: {
    type: String,
    trim: true,
    default: 'Síguenos en TikTok',
    required: false
  },
  tiktokSubtitle: {
    type: String,
    trim: true,
    default: 'Videos y contenido exclusivo',
    required: false
  },
  logoUrl: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  websiteUrl: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  websiteTitle: {
    type: String,
    trim: true,
    default: 'Visita Nuestro Sitio Web',
    required: false
  },
  websiteSubtitle: {
    type: String,
    trim: true,
    default: 'Tienda virtual y catálogo oficial',
    required: false
  },
  location: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  googleReviewsUrl: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  googleReviewsTitle: {
    type: String,
    trim: true,
    default: 'Ubicación del Local',
    required: false
  },
  googleReviewsSubtitle: {
    type: String,
    trim: true,
    default: 'Ver en Google Maps • Cómo llegar',
    required: false
  },
  scanCount: {
    type: Number,
    default: 0,
    min: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pre-save para actualizar timestamp
cardSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Helper virtual para generar el link directo a WhatsApp principal
cardSchema.virtual('whatsappLink').get(function () {
  if (!this.whatsappNumber || !this.whatsappNumber.trim()) return '';
  const cleaned = this.whatsappNumber.replace(/\D/g, '');
  if (!cleaned) return '';
  const defaultMessage = encodeURIComponent('¡Hola! Los vi a través de su tarjeta QR.');
  // Si no tiene código de país y tiene 10 dígitos (Colombia celular ej: 300xxxxxxx), anteponer 57
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    return `https://wa.me/57${cleaned}?text=${defaultMessage}`;
  }
  return `https://wa.me/${cleaned}?text=${defaultMessage}`;
});

// Helper virtual para generar el link directo al segundo WhatsApp (opcional)
cardSchema.virtual('whatsappLink2').get(function () {
  if (!this.whatsappNumber2 || !this.whatsappNumber2.trim()) return '';
  const cleaned = this.whatsappNumber2.replace(/\D/g, '');
  if (!cleaned) return '';
  const defaultMessage = encodeURIComponent('¡Hola! Los vi a través de su tarjeta QR.');
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    return `https://wa.me/57${cleaned}?text=${defaultMessage}`;
  }
  return `https://wa.me/${cleaned}?text=${defaultMessage}`;
});

// Helper virtual para formatear link de Instagram
cardSchema.virtual('instagramLink').get(function () {
  if (!this.instagramUrl || !this.instagramUrl.trim()) return '';
  let url = this.instagramUrl.trim();
  if (url.startsWith('@')) {
    return `https://instagram.com/${url.substring(1)}`;
  }
  if (!/^https?:\/\//i.test(url)) {
    return `https://instagram.com/${url}`;
  }
  return url;
});

// Helper virtual para formatear link de TikTok
cardSchema.virtual('tiktokLink').get(function () {
  if (!this.tiktokUrl || !this.tiktokUrl.trim()) return '';
  let url = this.tiktokUrl.trim();
  if (url.startsWith('@')) {
    return `https://www.tiktok.com/${url}`;
  }
  if (!/^https?:\/\//i.test(url)) {
    return `https://www.tiktok.com/@${url.replace(/^@/, '')}`;
  }
  return url;
});

// Helper virtual para formatear link de Facebook
cardSchema.virtual('facebookLink').get(function () {
  if (!this.facebookUrl || !this.facebookUrl.trim()) return '';
  let url = this.facebookUrl.trim();
  if (url.startsWith('@')) {
    return `https://facebook.com/${url.substring(1)}`;
  }
  if (!/^https?:\/\//i.test(url)) {
    return `https://facebook.com/${url}`;
  }
  return url;
});

// Helper virtual para formatear link de Sitio Web
cardSchema.virtual('websiteLink').get(function () {
  if (!this.websiteUrl || !this.websiteUrl.trim()) return '';
  let url = this.websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
});

module.exports = mongoose.model('Card', cardSchema);
