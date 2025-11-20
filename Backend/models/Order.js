const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  brand: { type: String },
  image: { type: String },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  size: { type: String },
}, { _id: false });

const AddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  addressText: { type: String, required: true },
  // Optional detailed fields for better address management
  firstName: { type: String },
  lastName: { type: String },
  line: { type: String },
  area: { type: String },
  city: { type: String },
  state: { type: String },
  zip: { type: String },
  phone: { type: String },
  landmark: { type: String }
}, { _id: false });

const TotalsSchema = new mongoose.Schema({
  subtotal: Number,
  tax: Number,
  shipping: Number,
  codCharges: Number,
  couponDiscount: { type: Number, default: 0 },
  total: Number
}, { _id: false });

const TrackingUpdateSchema = new mongoose.Schema({
  status: { type: String, required: true },
  message: { type: String, required: true },
  location: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const TrackingSchema = new mongoose.Schema({
  trackingNumber: { type: String },
  carrier: { type: String, default: 'BlueDart Express' },
  estimatedDelivery: { type: Date },
  actualDelivery: { type: Date },
  updates: [TrackingUpdateSchema],
  currentLocation: { type: String }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // ZYxxxxxx
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  paymentMethod: { type: String, enum: ['card', 'wallet', 'upi', 'netbanking', 'cod'], required: true },
  paymentStatus: { type: String, enum: ['initiated', 'paid', 'failed', 'cod'], default: 'initiated' },
  orderStatus: { type: String, enum: ['pending_payment', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'], default: 'pending_payment' },
  items: [OrderItemSchema],
  totals: TotalsSchema,
  appliedCoupon: {
    code: { type: String },
    discountAmount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['percentage', 'fixed'] },
    originalTotal: { type: Number },
    finalTotal: { type: Number }
  },
  shippingAddress: AddressSchema,
  tracking: TrackingSchema,
  methodDetails: {},
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);

