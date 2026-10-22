import mongoose from 'mongoose';

const deliverySettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global_delivery_settings',
      unique: true,
    },
    // Emails that receive real-time notifications for each order placed
    notificationEmails: {
      type: [String],
      default: [],
    },
    // Enable or disable order email alerts to delivery team
    emailAlertsEnabled: {
      type: Boolean,
      default: true,
    },
    // Send customer order confirmation copy
    notifyCustomer: {
      type: Boolean,
      default: true,
    },
    lastUpdatedBy: {
      type: String,
      default: 'Admin',
    },
  },
  { timestamps: true }
);

export default mongoose.models.DeliverySettings ||
  mongoose.model('DeliverySettings', deliverySettingsSchema);
