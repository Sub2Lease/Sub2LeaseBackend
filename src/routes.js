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

    const usersRes = await users.find(dbQuery).lean(); // omit passwords
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

    const listingsRes = await listings.find(dbQuery).lean();
    res.json(listingsRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/listings/saved/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await users.findById(userId).select('savedListings').populate('savedListings').lean();
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

    const agreementsRes = await agreements.find(dbQuery).lean();
    res.json(agreementsRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/messages', async (req, res) => {
  try {
    const dbQuery = {}
    const { user, user2 } = req.query;
    if (user) {
      dbQuery.users = user2 ? { $all: [user, user2] } : user;
    }
    const messagesRes = await messages.find(dbQuery).lean();
    res.json(messagesRes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/listings/availability/:id', async (req, res) => {
  const respond = (available) => res.json({ available });
  try {
    const listingId = req.params.id;
    const { startDate: startDateRaw, endDate: endDateRaw } = req.query;
    if (!startDateRaw || !endDateRaw) {
      return res.status(400).json({ error: 'Please provide both startDate and endDate query parameters' });
    }
    const listing = await listings.findById(listingId).select('startDate endDate').lean();
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);
    const listingStart = new Date(listing.startDate);
    const listingEnd = new Date(listing.endDate);

    if (startDate > endDate) return res.status(400).json({ error: 'startDate must be before endDate' });
    if (startDate < listingStart || endDate > listingEnd) return respond(false);

    const overlappingAgreements = await agreements.find({
      listing: listingId,
      $or: [
        { startDate: { $lte: endDate, $gte: startDate } },
        { endDate: { $lte: endDate, $gte: startDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    }).lean();

    respond(overlappingAgreements.length === 0);
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

router.post('/listings/:listingId/makeAgreement', async (req, res) => {
  try {
    const listingId = req.params.listingId;
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

router.post('/listings/:listingId/save', async (req, res) => {
  try {
    const { userId } = req.body; 
    const { listingId } = req.params;
    const savedUser = await users.findByIdAndUpdate(userId, { $addToSet: { savedListings: listingId } }, { new: true });
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/listings/:listingId/save', async (req, res) => {
  try {
    const { userId } = req.body; 
    const { listingId } = req.params;
    const savedUser = await users.findByIdAndUpdate(userId, { $pull: { savedListings: listingId } }, { new: true });
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

router.post('/agreements/:agreementId/sign', async (req, res) => {
  try {
    const { userId } = req.body;
    const { agreementId } = req.params;
    const agreement = await agreements.findById(agreementId).select('owner tenant ownerSigned tenantSigned');
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    if (agreement.owner === userId) agreement.ownerSigned = true;
    else if (agreement.tenant === userId) agreement.tenantSigned = true;
    else return res.status(403).json({ error: 'User not part of this agreement' });

    const savedAgreement = await agreement.save();
    res.json(savedAgreement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//////////////////////////
// PATCH
//////////////////////////

router.patch("/fillEmptyGeocodes", async (req, res) => {
  const docs = await listings.find({ latitude: { $exists: false } });

  await Promise.all(
    docs.map(async doc => {
      const geo = await geocodeAddress(doc.address);
      if (!geo) return;

      doc.latitude = geo.lat;
      doc.longitude = geo.lng;
      await doc.save();
    })
  );

  res.json({ updated: docs.length });;
})

router.all("*catch", (_, res) => {
  res.status(404).send("Yo this is the fallback ur lowk cooked");
});

module.exports = router;