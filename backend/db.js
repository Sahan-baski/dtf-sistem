const mongoose = require('mongoose');

const baglan = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dtf');
    console.log('✅ MongoDB bağlantısı kuruldu');
  } catch (err) {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  }
};

module.exports = baglan;
