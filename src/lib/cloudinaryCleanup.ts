import cloudinary from "@/lib/cloudinary";

function parseCloudinaryUrl(url?: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "res.cloudinary.com") return null;

    const m = u.pathname.match(/^\/([^/]+)\/(image|raw)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!m || m[1] !== process.env.CLOUDINARY_CLOUD_NAME) return null;

    const resourceType = m[2] as "image" | "raw";
    let publicId = decodeURIComponent(m[3]);
    
    if (resourceType === "image") publicId = publicId.replace(/\.[^/.]+$/, "");

    
    if (!publicId.startsWith("readgrid/covers/") && !publicId.startsWith("readgrid/books/")) return null;

    return { publicId, resourceType };
  } catch {
    return null;
  }
}

export async function deleteByUrl(url?: string | null) {
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return;
  try {
    await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: parsed.resourceType,
      invalidate: true,
    });
  } catch (e) {
    console.error("Cloudinary cleanup error:", e);
  }
}

export async function deletePrivatePdf(publicId?: string | null) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
  } catch (e) {
    console.error("Cloudinary cleanup error:", e);
  }
}