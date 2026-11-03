// src/app/api/books/[id]/download/route.ts
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Book from "@/models/Book";
import { verifyToken } from "@/lib/jwt";
import { checkPremiumExpiry } from "@/lib/checkPremiumExpiry";
import cloudinary from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    let payload: any = null;
    try {
      payload = verifyToken(token);
    } catch {
      return NextResponse.json({ message: "Увійдіть, щоб завантажити файл" }, { status: 401 });
    }
    if (!payload || !payload.userId) {
      return NextResponse.json({ message: "Увійдіть, щоб завантажити файл" }, { status: 401 });
    }

    const { id } = await params;
    const book = await Book.findById(id);

    if (!book) {
      return NextResponse.json({ message: "Book not found" }, { status: 404 });
    }

    const isAdminRole = payload.role === "admin" || payload.role === "superadmin";

    if (book.isPremium && !isAdminRole) {
      const user = await checkPremiumExpiry(payload.userId);
      if (!user || !user.isPremium) {
        return NextResponse.json(
          { message: "Ця книга доступна лише за Premium-підпискою" },
          { status: 403 }
        );
      }
    }

    if (!book.filePublicId) {
      return NextResponse.json({ fileUrl: book.fileUrl, isPrivate: false }, { status: 200 });
    }
    
    const signedUrl = cloudinary.utils.private_download_url(book.filePublicId, "", {
      resource_type: "raw",
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + 600,
    });

    return NextResponse.json(
      {
        fileUrl: signedUrl,
        isPrivate: true,
        
        ...(isAdminRole ? { filePublicId: book.filePublicId } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error getting download link:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}