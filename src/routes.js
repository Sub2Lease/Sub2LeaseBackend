const express = require("express");
const router = express.Router();
const { users, listings, agreements, messages } = require('./mongo/models');

//////////////////////////
// GET
//////////////////////////

router.get('/users', async (req, res) => {
  try {
    const { query } = req;
    const dbQuery = {};
    if (query.userId) dbQuery._id = query.userId;

    const usersRes = await users.find(dbQuery).select('-password'); // omit passwords
    res.json(usersRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const { query } = req;
    const dbQuery = {};
    if (query.listingId) dbQuery._id = query.listingId;
    else {
      if (query.ownerId) dbQuery.owner = query.ownerId;

      if (query.startDate && query.endDate) {
        dbQuery.startDate = { $gte: new Date(query.startDate) };
        dbQuery.endDate = { $lte: new Date(query.endDate) };
      }
    }

    const listingsRes = await listings.find(dbQuery);
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
    const { query } = req;
    const dbQuery = {};
    if (query.agreementId) dbQuery._id = query.agreementId;
    else {
      if (query.ownerId) dbQuery.owner = query.ownerId;
      if (query.tenantId) dbQuery.tenant = query.tenantId;
    }

    const agreementsRes = await agreements.find(dbQuery);
    res.json(agreementsRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' });
    }
    const messagesRes = await messages.find({users: { $all: [from, to] }});
    res.json(messagesRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    const { startDate, endDate, tenant, owner, payTerm, rent, securityDeposit, numPeople } = req.body;

    if (!startDate || !endDate || !tenant || !owner || !numPeople)
      return res.status(400).json({ error: 'Missing some required fields (startDate, endDate, tenant, owner, numPeople)' });

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
      owner,
      tenant
    });

    const savedAgreement = await newAgreement.save();
    res.status(201).json(savedAgreement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await users.findOne({ email, password });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    } else {
      return res.json(user);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/listings/save', async (req, res) => {
  try {
    const { userId, listingId } = req.body; 
    const savedUser = await users.findByIdAndUpdate(userId, { $addToSet: { savedListings: listingId } }, { new: true });
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/message', async (req, res) => {
  try {
    const { from, to, content } = req.body;

    const newMessage = new messages({ sender: from, users: [from, to], content });
    
    const savedMessage = await newMessage.save();
    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.all("*catch", (_, res) => {
  res.send("Yo this is the fallback ur lowk cooked");
});

module.exports = router;