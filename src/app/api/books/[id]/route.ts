// src/app/api/books/[id]/route.ts
import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Book from "@/models/Book";
import { verifyToken } from "@/lib/jwt";
import cloudinary from "@/lib/cloudinary";
import { randomUUID } from "crypto";
import { deleteByUrl, deletePrivatePdf } from "@/lib/cloudinaryCleanup";

// Переводит уже загруженный публичный PDF в приватный режим.
// Возвращает новый public_id или null, если ссылка не наша / что-то пошло не так.
async function makeFilePrivate(fileUrl: string): Promise<string | null> {
  try {
    const u = new URL(fileUrl);
    if (u.hostname !== "res.cloudinary.com") return null;

    // /<cloud_name>/raw/upload/v123456/readgrid/books/uuid.pdf
    const m = u.pathname.match(/^\/([^/]+)\/raw\/upload\/(?:v\d+\/)?(.+)$/);
    if (!m || m[1] !== process.env.CLOUDINARY_CLOUD_NAME) return null;

    const oldId = decodeURIComponent(m[2]);
    if (!oldId.startsWith("readgrid/books/")) return null;

    const newId = `readgrid/books/${randomUUID()}.pdf`;
    await cloudinary.uploader.rename(oldId, newId, {
      resource_type: "raw",
      type: "upload",
      to_type: "authenticated",
      invalidate: true,
    });
    return newId;
  } catch (e) {
    console.error("makeFilePrivate error:", e);
    return null;
  }
}

// GET - отримати книгу за ID (без fileUrl — його віддає окремий /download ендпоінт)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: "Missing book ID" }, { status: 400 });
    }

    // 🆕 .select('-fileUrl') — пряме посилання на файл більше НІКОЛИ
    // не потрапляє в цю публічну відповідь, незалежно від того, хто питає
    const book = await Book.findById(id).select('-fileUrl -filePublicId');
    if (!book) {
      return NextResponse.json({ message: "Book not found" }, { status: 404 });
    }

    return NextResponse.json(book, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching book:", error);
    return NextResponse.json({ message: "Database error", error: error.message }, { status: 500 });
  }
}

// PUT - оновити книгу (тільки admin) — без змін
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload: any = verifyToken(token);

    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ message: "Access denied. Admin only." }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: "Missing book ID" }, { status: 400 });
    }

    const body = await req.json();
    const { title, author, genre, year, description, coverUrl, fileUrl, filePublicId, isPremium } = body;

    if (!title || !author || !genre || !year || !description || !coverUrl || (!fileUrl && !filePublicId)) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const currentYear = new Date().getFullYear();
    if (typeof year !== 'number' || year < 1500 || year > currentYear) {
      return NextResponse.json({
        message: `Invalid year. Must be between 1500 and ${currentYear}`
      }, { status: 400 });
    }

    const urlRegex = /^https?:\/\/.+/i;
    if (!urlRegex.test(coverUrl) || (fileUrl && !urlRegex.test(fileUrl))) {
      return NextResponse.json({ message: "Invalid file URL" }, { status: 400 });
    }
    if (filePublicId && !String(filePublicId).startsWith('readgrid/books/')) {
      return NextResponse.json({ message: "Invalid file id" }, { status: 400 });
    }

    const existingBook = await Book.findById(id);
    if (!existingBook) {
      return NextResponse.json({ message: "Book not found" }, { status: 404 });
    }

    // Если книгу делают Premium, а файл ещё публичный: переводим его в приватный
    let finalFilePublicId: string | undefined = filePublicId || undefined;
    let finalFileUrl: string | undefined = fileUrl || undefined;

    if (isPremium && !finalFilePublicId && finalFileUrl) {
      const newId = await makeFilePrivate(finalFileUrl);
      if (newId) {
        finalFilePublicId = newId;
        finalFileUrl = undefined;
      }
    }

    const update: any = {
      title, author, genre, year, description, coverUrl,
      isPremium: !!isPremium,
    };
    if (finalFilePublicId) {
      update.filePublicId = finalFilePublicId;
      update.$unset = { fileUrl: 1 };
    } else {
      update.fileUrl = finalFileUrl;
      update.$unset = { filePublicId: 1 };
    }

    const updatedBook = await Book.findByIdAndUpdate(id, update, { new: true, runValidators: true });

    // старый приватный PDF больше не нужен: чистим, чтобы не копить мусор
    // чистим файлы, которые заменили
    if (existingBook.filePublicId && existingBook.filePublicId !== finalFilePublicId) {
      await deletePrivatePdf(existingBook.filePublicId);
    }
    if (existingBook.fileUrl && existingBook.fileUrl !== finalFileUrl) {
      // если файл только что переведён в приватный, старого имени уже нет, это безвредно
      await deleteByUrl(existingBook.fileUrl);
    }
    if (existingBook.coverUrl && existingBook.coverUrl !== coverUrl) {
      await deleteByUrl(existingBook.coverUrl);
    }

    const safeBook = updatedBook?.toObject();
    if (safeBook) { delete safeBook.fileUrl; delete safeBook.filePublicId; }

    return NextResponse.json({
      message: "Book successfully updated",
      book: safeBook
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error updating book:", error);

    if (error.code === 11000) {
      return NextResponse.json({
        message: "Book with this title and author already exists"
      }, { status: 409 });
    }

    return NextResponse.json({ message: "Database error", error: error.message }, { status: 500 });
  }
}

// DELETE - видалити книгу (тільки admin) — без змін
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const payload: any = verifyToken(token);

    if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
      return NextResponse.json({ message: "Access denied. Admin only." }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: "Missing book ID" }, { status: 400 });
    }

    const book = await Book.findById(id);
    if (!book) {
      return NextResponse.json({ message: "Book not found" }, { status: 404 });
    }

    await deletePrivatePdf(book.filePublicId);
    await deleteByUrl(book.fileUrl);

    // обложку удаляем, только если ей не пользуется другая книга
    const coverStillUsed = await Book.countDocuments({ coverUrl: book.coverUrl, _id: { $ne: id } });
    if (!coverStillUsed) await deleteByUrl(book.coverUrl);

    await Book.findByIdAndDelete(id);

    return NextResponse.json({
      message: "Book successfully deleted"
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error deleting book:", error);
    return NextResponse.json({ message: "Database error", error: error.message }, { status: 500 });
  }
}