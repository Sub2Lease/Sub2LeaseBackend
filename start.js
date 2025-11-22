require('dotenv').config();
const { dbConnect } = require('./src/mongo/init');
const app = require("./src/app");

const PORT = process.env.PORT || 3000;
dbConnect();
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));