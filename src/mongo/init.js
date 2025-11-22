import mongoose from 'mongoose';

const connection = {};

async function dbConnect() {
  if (connection.isConnected) return;

  const URI = process.env.mongoURI;
  const db = await mongoose.connect(URI);

  connection.isConnected = db.connections[0].readyState;
}

export default dbConnect;