import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISystemSettings extends Document {
  paymentTestMode: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    // За замовчуванням увімкнено лише поза продакшеном — щоб на Render
    // одразу після деплою тестовий режим не "протік" у реальну роботу
    paymentTestMode: { type: Boolean, default: process.env.NODE_ENV !== 'production' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const SystemSettings = (mongoose.models.SystemSettings as Model<ISystemSettings>) ||
  mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);

export default SystemSettings;

// Singleton-патерн: у колекції завжди рівно один документ з налаштуваннями
export async function getSystemSettings() {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({});
  }
  return settings;
}