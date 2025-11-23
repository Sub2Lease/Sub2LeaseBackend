const mongoose = require('mongoose');
const { geocodeAddress } = require('./geocoding');

const options = {
  strict: true,
  toJSON: {
    transform(_, ret, options) {
      if (!options.keepVersion) {
        delete ret.__v;
      }
      if (!options.keepPassword) {
        delete ret.password;
      }
      return ret;
    }
  },
  toObject: {
    transform(_, ret, options) {
      if (!options.keepVersion) {
        delete ret.__v;
      }
      if (!options.keepPassword) {
        delete ret.password;
      }
      return ret;
    }
  }
};

const userSchema = new mongoose.Schema({
  name: { type: String, index: true, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  walletAddress: String,
  zipcode: String,
  // listings: { type: [mongoose.Schema.Types.ObjectId], ref: 'listings', default: () => [] },
  // agreements: { type: [mongoose.Schema.Types.ObjectId], ref: 'agreements', default: () => [] },
  savedListings: { type: [mongoose.Schema.Types.ObjectId], ref: 'listings', default: () => [] },
  profileImg: Buffer
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
  images: { type: [Buffer], default: () => [] },
  capacity: { type: Number, required: true },
}, options);
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
  ownerSigned: { type: Boolean, default: () => false },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  tenantSigned: { type: Boolean, default: () => false },
}, options);
agreementSchema.index({ listing: 1, startDate: 1, endDate: 1 });
agreementSchema.index({ owner: 1 });
agreementSchema.index({ startDate: 1, endDate: 1 });

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

const User = mongoose.models.User || mongoose.model('users', userSchema);
const Listing = mongoose.models.Listing || mongoose.model('listings', listingSchema);
const Agreement = mongoose.models.Agreement || mongoose.model('agreements', agreementSchema);
const Message = mongoose.models.Message || mongoose.model('messages', messageSchema);
const Global = mongoose.models.Global || mongoose.model('globals', globalSchema);

module.exports = {
  users: User,
  listings: Listing,
  agreements: Agreement,
  messages: Message,
  global: Global
};