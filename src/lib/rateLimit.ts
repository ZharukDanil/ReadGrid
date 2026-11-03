
type Bucket = {
    count: number;
    resetAt: number;
  };
  
  const buckets = new Map<string, Bucket>();
  
  // Періодично чистимо застарілі записи, щоб Map не росла нескінченно
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }, 5 * 60 * 1000);
  
  export function rateLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const existing = buckets.get(identifier);
  
    if (!existing || existing.resetAt < now) {
      buckets.set(identifier, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }
  
    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
    }
  
    existing.count += 1;
    return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
  }
  
  export function getClientIp(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return 'unknown';
  }