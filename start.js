require('dotenv').config();
const { dbConnect } = require('./src/mongo/init');
const app = require("./src/app");

const PORT = process.env.PORT || 3000;

(async () => {
  await dbConnect();
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
})();
