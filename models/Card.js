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
    default: ''
  },
  whatsappNumber: {
    type: String,
    trim: true,
    default: ''
  },
  googleReviewsUrl: {
    type: String,
    trim: true,
    default: ''
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

// Helper virtual para generar el link directo a WhatsApp
cardSchema.virtual('whatsappLink').get(function () {
  if (!this.whatsappNumber) return '';
  const cleaned = this.whatsappNumber.replace(/\D/g, '');
  if (!cleaned) return '';
  // Si no tiene código de país y tiene 10 dígitos (Colombia celular ej: 300xxxxxxx), anteponer 57
  if (cleaned.length === 10 && cleaned.startsWith('3')) {
    return `https://wa.me/57${cleaned}?text=${encodeURIComponent('¡Hola! Los vi a través de su tarjeta NFC.')}`;
  }
  return `https://wa.me/${cleaned}`;
});

// Helper virtual para formatear link de Instagram
cardSchema.virtual('instagramLink').get(function () {
  if (!this.instagramUrl) return '';
  let url = this.instagramUrl.trim();
  if (url.startsWith('@')) {
    return `https://instagram.com/${url.substring(1)}`;
  }
  if (!/^https?:\/\//i.test(url)) {
    return `https://instagram.com/${url}`;
  }
  return url;
});

module.exports = mongoose.model('Card', cardSchema);
