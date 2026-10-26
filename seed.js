require('dotenv').config();
const mongoose = require('mongoose');
const Card = require('./models/Card');

const MONGODB_URI = 'mongodb://nithsonbarragan03_db_user:chloe12345@ac-woajqza-shard-00-00.ftjxrxh.mongodb.net:27017,ac-woajqza-shard-00-01.ftjxrxh.mongodb.net:27017,ac-woajqza-shard-00-02.ftjxrxh.mongodb.net:27017/?ssl=true&replicaSet=atlas-m8wmr1-shard-0&authSource=admin';

const sampleCards = [
  {
    cardId: '001',
    status: 'assigned',
    businessName: 'Café & Bistro Bogotá',
    instagramUrl: 'https://instagram.com/cafebistrobogota',
    facebookUrl: 'https://facebook.com/cafebistrobogota',
    whatsappNumber: '3157894512',
    googleReviewsUrl: 'https://maps.google.com/?cid=1029384756',
    scanCount: 142,
    updatedAt: new Date()
  },
  {
    cardId: '002',
    status: 'available',
    businessName: '',
    instagramUrl: '',
    facebookUrl: '',
    whatsappNumber: '',
    googleReviewsUrl: '',
    scanCount: 0,
    updatedAt: new Date()
  },
  {
    cardId: '003',
    status: 'assigned',
    businessName: 'Barbería Capital Medellín',
    instagramUrl: '@barberiacapitalmed',
    facebookUrl: '@barberiacapitalmed',
    whatsappNumber: '+57 320 654 3210',
    googleReviewsUrl: 'https://maps.google.com/?cid=9988776655',
    scanCount: 89,
    updatedAt: new Date()
  }
];

async function seedDatabase() {
  try {
    console.log('🔄 Conectando a MongoDB para poblar datos de prueba...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conexión establecida.');

    for (const item of sampleCards) {
      await Card.findOneAndUpdate(
        { cardId: item.cardId },
        item,
        { upsert: true, new: true }
      );
      console.log(`✨ Tarjeta #${item.cardId} (${item.status}) lista.`);
    }

    console.log('\n🎉 ¡Base de datos poblada exitosamente con tarjetas de prueba!');
    console.log('• Tarjeta 001: Asignada (prueba la landing page en /p/001)');
    console.log('• Tarjeta 002: Disponible (prueba la vista de activación en /p/002)');
    console.log('• Tarjeta 003: Asignada (prueba la landing page en /p/003)');
  } catch (err) {
    console.error('❌ Error al poblar la base de datos:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexión cerrada.');
  }
}

seedDatabase();
