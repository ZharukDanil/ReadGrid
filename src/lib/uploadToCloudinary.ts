// lib/uploadToCloudinary.ts
import { randomUUID } from 'crypto';
import cloudinary from './cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  resourceType: 'image' | 'raw',
  access: 'public' | 'premium' = 'public'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const publicId =
      resourceType === 'raw'
        ? `${folder}/${randomUUID()}.pdf`
        : `${folder}/${randomUUID()}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        
        type: access === 'premium' ? 'authenticated' : 'upload',
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          return reject(error || new Error('Cloudinary не повернув посилання'));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    uploadStream.end(fileBuffer);
  });
}