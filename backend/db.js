const mongoose = require('mongoose');
module.exports = async function baglan() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dtf';
  await mongoose.connect(uri);
  console.log('✅ MongoDB bağlandı');
};
