const mongoose = require('mongoose');
const { geocodeAddress } = require('../geocoding');

const options = {
  strict: true,
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true, versionKey: false },
};

const finds = ['find', 'findOne', 'findAndUpdate', 'findOneAndUpdate', 'findById', 'findByIdAndUpdate', 'findByIdAndDelete'];
function stripSensitiveFields(docs) {
  if (!docs) return;
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      delete doc.password;
      delete doc.__v;
    });
  } else {
    delete docs.password;
    delete docs.__v;
  }
}

const userSchema = new mongoose.Schema({
  name: { type: String, index: true, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true, select: false },
  walletAddress: String,
  zipcode: String,
  // listings: { type: [mongoose.Schema.Types.ObjectId], ref: 'listings', default: () => [] },
  // agreements: { type: [mongoose.Schema.Types.ObjectId], ref: 'agreements', default: () => [] },
  savedListings: { type: [mongoose.Schema.Types.ObjectId], ref: 'listings', default: () => [] },
  profileImage: { type: mongoose.Schema.Types.ObjectId, ref: 'images' },
}, options);

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  address: { type: String, required: true },
  longitude: Number,
  latitude: Number,
  rent: { type: Number, required: true },
  securityDeposit: Number,
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  website: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  agreements: { type: [mongoose.Schema.Types.ObjectId], ref: 'agreements', default: () => [] },
  images: { type: [mongoose.Schema.Types.ObjectId], ref: 'images', default: () => [] },
  capacity: { type: Number, required: true },
}, options);
listingSchema.path('endDate').validate(function(value) {
  if (!this.startDate || !value) return false;
  return value > this.startDate;
}, 'End date must be after start');
listingSchema.pre('save', async function() {
  if (!this.isNew) return;
  const geo = await geocodeAddress(this.address);
  if (!geo) return;
  this.longitude = geo.lng;
  this.latitude = geo.lat;
});
listingSchema.index({ startDate: 1, endDate: 1 });
listingSchema.index({ owner: 1 });

const agreementSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  rent: { type: Number, required: true },
  securityDeposit: { type: Number, required: true },
  numPeople: { type: Number, default: () => 1 },
  payTerm: { type: String, default: () => 'monthly' },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'listings', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  ownerSignDate: { type: Date, default: () => null },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  tenantSignDate: { type: Date, default: () => null },
}, options);
agreementSchema.path('endDate').validate(function(value) {
  if (!this.startDate || !value) return false;
  return value > this.startDate;
}, 'End date must be after start');
agreementSchema.index({ listing: 1, startDate: 1, endDate: 1 });
agreementSchema.index({ owner: 1 });
agreementSchema.index({ startDate: 1, endDate: 1 });
agreementSchema.virtual('ownerSigned').get(function () {
  return !!this.ownerSignDate;
});
agreementSchema.virtual('tenantSigned').get(function () {
  return !!this.tenantSignDate;
});

const imageSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  imageType: { type: String, required: true },
  filename: String,
}, options);

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  users: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'users',
    required: true,
    validate: [v => v.length === 2, 'A message must be between two users']
  },
  content: { type: String, required: true },
}, {...options, timestamps: { createdAt: 'timestamp', updatedAt: false } });
messageSchema.index({ users: 1, timestamp: -1 });

const globalSchema = new mongoose.Schema({}, { strict: false });

[userSchema, listingSchema, agreementSchema, imageSchema, messageSchema].forEach((schema) => {
  finds.forEach((find) => {
    schema.post(find, function(docs) {
      if (this.options.keepSensitive) return;
      stripSensitiveFields(docs);
    });
  });
});

const User = mongoose.models.User || mongoose.model('users', userSchema);
const Listing = mongoose.models.Listing || mongoose.model('listings', listingSchema);
const Agreement = mongoose.models.Agreement || mongoose.model('agreements', agreementSchema);
const Image = mongoose.models.Image || mongoose.model('images', imageSchema);
const Message = mongoose.models.Message || mongoose.model('messages', messageSchema);
const Global = mongoose.models.Global || mongoose.model('globals', globalSchema);

module.exports = {
  users: User,
  listings: Listing,
  agreements: Agreement,
  images: Image,
  messages: Message,
  global: Global
};