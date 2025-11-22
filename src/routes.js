const express = require("express");
const router = express.Router();
const { users, listings, agreements } = require('@m/models');

router.get("/", (req, res) => {
  res.send("Hello Express!");
});

router.get('/users', async (req, res) => {
  try {
    const allUsers = await users.find().select('-password'); // omit passwords
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const user = await users.findById(req.params.id)
      .select('-password')
      .populate('listings')
      .populate('agreements')
      .populate('savedListings');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
