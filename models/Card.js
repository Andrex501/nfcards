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
  facebookUrl: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  whatsappNumber: {
    type: String,
    trim: true,
    default: '',
    required: false
  },
  whatsappNumber2: {
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
  logoUrl: {
    type: String,
    trim: true,
    default: '',
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

module.exports = mongoose.model('Card', cardSchema);
