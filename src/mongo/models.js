const mongoose = require('mongoose');

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
  description: String,
  address: { type: String, required: true },
  title: { type: String, required: true },
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

const agreementSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  rent: { type: Number, required: true },
  securityDeposit: { type: Number, required: true },
  numPeople: { type: Number, default: () => 1 },
  payTerm: { type: String, default: () => 'monthly' },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'listings', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
}, options);

const globalSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.models.User || mongoose.model('users', userSchema);
const Listing = mongoose.models.Listing || mongoose.model('listings', listingSchema);
const Agreement = mongoose.models.Agreement || mongoose.model('agreements', agreementSchema);
const Global = mongoose.models.Global || mongoose.model('globals', globalSchema);

module.exports = {
  users: User,
  listings: Listing,
  agreements: Agreement,
  global: Global
}