import { MetadataRoute } from 'next';
import { dbConnect } from '@/lib/dbConnect';
import Book from '@/models/Book';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://readgridproject.onrender.com';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/premium`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  let bookRoutes: MetadataRoute.Sitemap = [];

  try {
    await dbConnect();
    const books = await Book.find({}, '_id updatedAt').lean();

    bookRoutes = books.map((book: any) => ({
      url: `${baseUrl}/books/${book._id}`,
      lastModified: book.updatedAt || new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Sitemap generation error:', error);
  }

  return [...staticRoutes, ...bookRoutes];
}