// backend/models/Otp.js
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  purpose: { type: String, enum: ["register", "forgot_password"], default: "register" },
  expiresAt: { type: Date, required: true },
});

// Unique index per email + purpose combination
otpSchema.index({ email: 1, purpose: 1 }, { unique: true });

// TTL index - documents expire automatically
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Otp || mongoose.model("Otp", otpSchema);

