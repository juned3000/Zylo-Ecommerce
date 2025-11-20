const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  label: { 
    type: String, 
    default: 'Home',
    enum: ['Home', 'Work', 'Other']
  },
  firstName: { 
    type: String, 
    required: true 
  },
  lastName: { 
    type: String 
  },
  country: { 
    type: String, 
    default: 'India' 
  },
  line: { 
    type: String, 
    required: true 
  },
  area: { 
    type: String 
  },
  landmark: { 
    type: String 
  },
  city: { 
    type: String, 
    required: true 
  },
  state: { 
    type: String, 
    required: true 
  },
  zip: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Phone number must be 10 digits'
    }
  },
  isDefault: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Ensure only one default address per user
AddressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  this.updatedAt = Date.now();
  next();
});

// Static method to get all addresses for a user
AddressSchema.statics.getUserAddresses = function(userId) {
  return this.find({ user: userId }).sort('-isDefault -createdAt');
};

// Instance method to make this address default
AddressSchema.methods.makeDefault = async function() {
  await this.constructor.updateMany(
    { user: this.user, _id: { $ne: this._id } },
    { isDefault: false }
  );
  this.isDefault = true;
  return this.save();
};

module.exports = mongoose.model('Address', AddressSchema);