const mongoose = require('mongoose');

const connection = {};

async function dbConnect() {
  if (connection.isConnected) return;

  const URI = process.env.MONGO_URI;
  const db = await mongoose.connect(URI);

  connection.isConnected = db.connections[0].readyState;
}

module.exports = { dbConnect };