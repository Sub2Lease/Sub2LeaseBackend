const express = require("express");
const router = express.Router();
const { users, listings, agreements, messages, images } = require('./mongo/models');
const mongoose = require('mongoose');
const { geocodeAddress } = require('./geocoding');
const multer = require("multer");
const { generateContract } = require("../fill_contract");
const { convertDocxToPdf } = require("./docxToPdf");
const path = require("node:path");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const debugError = (err) => ({
  error: err.message,
  stack: err.stack,
  name: err.name,
  code: err.code,
});

//////////////////////////
// GET
//////////////////////////

router.get('/users', async (req, res) => {
  try {
    const { query } = req;
    const dbQuery = {};
    if (query.userId) dbQuery._id = query.userId;

    const usersRes = await users.find(dbQuery);
    res.json(usersRes);
  } catch (err) {
    res.status(500).json(debugError(err));
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
    res.status(500).json(debugError(err));
  }
});

router.get('/listings/saved/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await users.findById(userId).select('savedListings').populate('savedListings');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.savedListings);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.get('/agreements', async (req, res) => {
  try {
    let populate = '';
    const { query } = req;
    const dbQuery = {};
    if (query.agreementId) dbQuery._id = query.agreementId;
    else {
      if (query.ownerId) dbQuery.owner = query.ownerId;
      if (query.tenantId) dbQuery.tenant = query.tenantId;
      if (query.populateListing) populate += ' listing';
      if (query.populateOwner) populate += ' owner';
      if (query.populateTenant) populate += ' tenant';
    }

    const agreementsRes = await agreements.find(dbQuery).populate(populate.trim());
    res.json(agreementsRes);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.get('/messages', async (req, res) => {
  try {
    const dbQuery = {}
    const { user, user2 } = req.query;
    if (user) {
      dbQuery.users = user2 ? { $all: [user, user2] } : user;
    }
    const messagesRes = await messages.find(dbQuery);
    res.json(messagesRes);
  } catch (err) {
    res.status(500).json(debugError(err));
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
    const listing = await listings.findById(listingId).select('startDate endDate');
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);
    const listingStart = new Date(listing.startDate);
    const listingEnd = new Date(listing.endDate);

    if (startDate > endDate || startDate < listingStart || endDate > listingEnd) return respond(false);

    const overlappingAgreements = await agreements.find({
      listing: listingId,
      $or: [
        { startDate: { $lte: endDate, $gte: startDate } },
        { endDate: { $lte: endDate, $gte: startDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    });

    respond(overlappingAgreements.length === 0);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.get('/images/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const image = await images.findById(imageId);
    if (!image) return res.status(404).json({ error: 'Image does not exist' });
    res.set('Content-Type', image.imageType);
    res.send(image.data);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.get('/agreements/:agreementId/contract', async (req, res) => {
  try {
    const { agreementId } = req.params;
    const agreement = await agreements.findById(agreementId).populate('listing owner tenant');
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
    
    const now = new Date().toLocaleDateString('en-US');

    const docFilepath = path.resolve('./temp.docx');
    const pdfFilepath = path.resolve('./temp.pdf');
    const templatePath = './templates/Sublease-Agreement-Template.docx';
    const downloadName = `contract-${now.replaceAll('/', '-')}-${agreementId}.pdf`;
    console.log("CWD:", process.cwd());
  
    const contractData = {
      OWNER_NAME: agreement.owner.name || "aaa",
      TENANT_NAME: agreement.tenant.name || "aaa",
      ADDRESS: agreement.listing.address || "aaa",
      DATE: now || "aaa",
      START_DATE: new Date(agreement.startDate).toLocaleDateString('en-US') || "aaa",
      END_DATE: new Date(agreement.endDate).toLocaleDateString('en-US') || "aaa",
      RENT: agreement.rent || "aaa",
      DEPOSIT: agreement.securityDeposit || "aaa",
      OWNER_SIGNATURE: agreement.ownerSigned ? agreement.owner.name : "{OWNER_SIGNATURE}" || "aaa",
      OWNER_SIGN_DATE: agreement.ownerSigned ? new Date(agreement.ownerSignDate).toLocaleDateString('en-US') : "{OWNER_SIGN_DATE}",
      TENANT_SIGNATURE: agreement.tenantSigned ? agreement.tenant.name : "{TENANT_SIGNATURE}" || "aaa",
      TENANT_SIGN_DATE: agreement.tenantSigned ? new Date(agreement.tenantSignDate).toLocaleDateString('en-US') : "{TENANT_SIGN_DATE}",
    };

    generateContract(templatePath, docFilepath, contractData);
    await convertDocxToPdf(docFilepath, pdfFilepath);

    res.download(pdfFilepath, downloadName, (err) => {
      if (err) throw err;
    });
  } catch (err) {
    res.status(500).json(debugError(err));
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
    res.status(500).json(debugError(err));
  }
});

router.post('/listings', async (req, res) => {
  try {
    const { images: imageFiles } = req.body;

    const imageIds = await Promise.allSettled(imageFiles.map(async (img) => {
      const imageDoc = new images({
        data: Buffer.from(await img.arrayBuffer()),
        imageType: img.type,
        filename: img.name
      });
      return imageDoc.save();
    })).then(results => results.filter(r => r.status === 'fulfilled').map(r => r.value._id));

    const newListing = new listings({...req.body, images: imageIds });
    const savedListing = await newListing.save();
    res.status(201).json(savedListing);
  } catch (err) {
    res.status(500).json(debugError(err));
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
    res.status(500).json(debugError(err));
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
    res.status(500).json(debugError(err));
  }
});

router.post('/listings/:listingId/save', async (req, res) => {
  try {
    const { userId } = req.body; 
    const { listingId } = req.params;
    const savedUser = await users.findByIdAndUpdate(userId, { $addToSet: { savedListings: listingId } }, { new: true });
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.post('/message', async (req, res) => {
  try {
    const { from, to, content } = req.body;

    const newMessage = new messages({ sender: from, users: [from, to], content });
    
    const savedMessage = await newMessage.save();
    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.post('/agreements/:agreementId/sign', async (req, res) => {
  try {
    const { userId } = req.body;
    const { agreementId } = req.params;
    const agreement = await agreements.findById(agreementId).select('owner tenant ownerSignDate tenantSignDate');
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    const now = new Date();
    if (agreement.owner.toString() === userId) agreement.ownerSignDate = now;
    else if (agreement.tenant.toString() === userId) agreement.tenantSignDate = now;
    else return res.status(403).json({ error: 'User not part of this agreement' });

    const savedAgreement = await agreement.save();
    res.json(savedAgreement);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.post('/users/:userId/uploadPFP', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;

    const user = await users
      .findById(userId)
      .session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "User not found" });
    }

    const imageDoc = new images({
      data: req.file.buffer,
      imageType: req.file.mimetype,
      filename: req.file.originalname,
    });

    const uploadedImage = await imageDoc.save({ session });

    if (user.profileImage) {
      await images.findByIdAndDelete(user.profileImage).session(session);
    }

    user.profileImage = uploadedImage._id;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json(uploadedImage);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json(debugError(err));
  }
});

router.post('/listings/:listingId/uploadImage', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const { listingId } = req.params;
    const listing = await listings.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const imageDoc = new images({
      data: req.file.buffer,
      imageType: req.file.mimetype,
      filename: req.file.originalname
    });

    const uploadedImage = await imageDoc.save();
    listing.images.push(uploadedImage._id);
    await listing.save();

    res.json(uploadedImage);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
})

//////////////////////////
// PATCH
//////////////////////////

router.patch("/fillEmptyGeocodes", async (req, res) => {
  const docs = await listings.find({ latitude: { $exists: false } });

  const results = await Promise.allSettled(
    docs.map(async doc => {
      const geo = await geocodeAddress(doc.address);
      if (!geo) return;

      doc.latitude = geo.lat;
      doc.longitude = geo.lng;
      await doc.save();
    })
  );

  res.json({ results });
});

//////////////////////////
// DELETE
//////////////////////////

router.delete('/listings/:listingId/save', async (req, res) => {
  try {
    const { userId } = req.body; 
    const { listingId } = req.params;
    const savedUser = await users.findByIdAndUpdate(userId, { $pull: { savedListings: listingId } }, { new: true });
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.delete('/agreements/:agreementId', async (req, res) => {
  try {
    const { agreementId } = req.params;
    const deletedAgreement = await agreements.findByIdAndDelete(agreementId);
    if (!deletedAgreement) return res.status(404).json({ error: 'Agreement not found' });
    res.json(deletedAgreement);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.delete('/listings/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    const deletedListing = await listings.findByIdAndDelete(listingId);
    if (!deletedListing) return res.status(404).json({ error: 'Listing not found' });
    res.json(deletedListing);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedUser = await users.findByIdAndDelete(userId);
    if (!deletedUser) return res.status(404).json({ error: 'User not found' });
    res.json(deletedUser);
  } catch (err) {
    res.status(500).json(debugError(err));
  }
});

router.all("*catch", (_, res) => {
  res.status(404).json({ error: "Resource Not Found" });
});

module.exports = router;