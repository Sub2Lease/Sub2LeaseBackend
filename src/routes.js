const express = require("express");
const router = express.Router();
const { users, listings, agreements } = require('./mongo/models');

//////////////////////////
// GET
//////////////////////////

router.get('/users', async (req, res) => {
  try {
    const query = {};
    if (req.query.userId) query._id = req.query.userId;

    const usersRes = await users.find(query).select('-password'); // omit passwords
    res.json(usersRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const query = {};
    if (req.query.listingId) query._id = req.query.listingId;
    else if (req.query.sublessorId) query.sublessor = req.query.sublessorId;

    const listingsRes = await listings.find(query);
    res.json(listingsRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/listings/saved/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await users.findById(userId).select('savedListings').populate('savedListings');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.savedListings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/agreements', async (req, res) => {
  try {
    const query = {};
    if (req.query.agreementId) query._id = req.query.agreementId;
    else {
      if (req.query.sublessorId) query.sublessor = req.query.sublessorId;
      if (req.query.sublesseeId) query.sublessee = req.query.sublesseeId;
    }

    const agreementsRes = await agreements.find(query);
    res.json(agreementsRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("*", (_, res) => {
  res.send("Yo this is the fallback ur lowk cooked");
});

//////////////////////////
// POST
//////////////////////////

router.post('/signup', async (req, res) => {
  try {
    const newUser = new users(req.body);
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/listings', async (req, res) => {
  try {
    const newListing = new listings(req.body);
    const savedListing = await newListing.save();
    res.status(201).json(savedListing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/listings/:id/accept', async (req, res) => {
  try {
    const listingId = req.params.id;
    const { startDate, endDate, sublessee, sublessor, payTerm, rent, securityDeposit, numPeople } = req.body;

    if (!startDate || !endDate || !sublessee || !sublessor || !numPeople)
      return res.status(400).json({ error: 'Missing some required fields (startDate, endDate, sublessee, sublessor, numPeople)' });

    const listing = await listings.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (!securityDeposit && !listing.securityDeposit) return res.status(400).json({ error: 'Must specify securityDeposit for this listing' });

    const newAgreement = new agreements({
      startDate,
      endDate,
      rent: rent || listing.rent,
      securityDeposit: securityDeposit || listing.securityDeposit,
      numPeople,
      payTerm,
      listing: listingId,
      sublessor,
      sublessee
    });

    const savedAgreement = await newAgreement.save();
    res.status(201).json(savedAgreement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;