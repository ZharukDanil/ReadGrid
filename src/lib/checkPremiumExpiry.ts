// src/lib/checkPremiumExpiry.ts
import User from '@/models/User';

/**
 * Перевіряє, чи не закінчився термін Premium-підписки користувача.
 *
 * Правило:
 * - premiumUntil ВІДСУТНІЙ (undefined/null)  -> Premium видано адміном вручну,
 *   вважається безстроковим, НІЧОГО не робимо.
 * - premiumUntil Є і вже минув                -> підписка була куплена і сплила,
 *   знімаємо isPremium і чистимо premiumUntil.
 * - premiumUntil Є і ще не минув               -> все гаразд, нічого не робимо.
 *
 * Викликати перед тим, як віддавати isPremium користувачу назовні
 * (наприклад у GET /api/users/[id], або в списку користувачів в адмінці).
 */
export async function checkPremiumExpiry(userId: string) {
  const user = await User.findById(userId);
  if (!user) return null;

  const isExpiredPurchase =
    user.isPremium && user.premiumUntil && new Date(user.premiumUntil) < new Date();

  if (isExpiredPurchase) {
    user.isPremium = false;
    user.premiumUntil = undefined;
    await user.save();
    console.log(`⏳ Premium expired for user ${userId}, isPremium reset to false`);
  }

  return user;
}