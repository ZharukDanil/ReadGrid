import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin' | 'superadmin';
  favorites: mongoose.Types.ObjectId[];
  createdAt: Date;
  lastLogin?: Date;
  isPremium: boolean;
  isBlocked: boolean;
  premiumUntil?: Date;
  preferredGenres?: string[];
  lastProcessedOrderReference?: string;
  resetPasswordToken?: string | null;
  resetPasswordExpires?: Date | null;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user'
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    isPremium: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    premiumUntil: { type: Date },
    preferredGenres: { type: [String], default: [] },
    lastProcessedOrderReference: { type: String, default: null },
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  { versionKey: false, timestamps: true }
);

const User = (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>('User', UserSchema);

export default User;