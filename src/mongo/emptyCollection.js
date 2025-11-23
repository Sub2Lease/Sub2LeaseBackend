const { dbConnect, dbDisconnect } = require('./init');
require('dotenv').config();
const models = require('./models');

const modelName = process.argv[2]; // Grab the model name from CLI args

if (!modelName) {
  console.error('Please provide a model name: node emptyCollection.js <modelName>');
  process.exit(1);
}

const Model = models[modelName];

if (!Model) {
  console.error(`Model "${modelName}" not found in models.js.`);
  process.exit(1);
}

async function emptyCollection() {
  try {
    await dbConnect();

    const result = await Model.deleteMany({});
    console.log(`Emptied "${modelName}" collection. ${result.deletedCount} documents removed.`);
  } catch (error) {
    console.error('Error emptying collection:', error);
  } finally {
    // await dbDisconnect();
  }
}

emptyCollection();