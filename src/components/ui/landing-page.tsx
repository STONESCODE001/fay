
import { db } from "../../lib/db"
import myLogo from '../../assets/FAY_LOGO.png';

interface LandingPageProps {
  onStartApp: () => void
}

async function handleGuestLogin() {
  try {
    // 1. Trigger the native InstantDB Guest auth pipeline
    const { user } = await db.auth.signInAsGuest();

    if (!user || !user.id) {
      console.error("Failed to retrieve Guest User ID");
      return;
    }

    const guestUserId = user.id;

    // Cast to any to tell TypeScript: "Trust me, I added 'balance' to the $users schema"
    const extendedUser = user as any;

    // 2. Safety Check: Only provision if they don't have a balance yet
    if (extendedUser.balance === undefined || extendedUser.balance === null) {
      console.log(`🆕 New guest detected (${guestUserId}). Provisioning initial wallet...`);

      // 10-year timestamp calculation so the offline credential math stays valid
      const TEN_YEARS_IN_MS = 10 * 365 * 24 * 60 * 60 * 1000;
      const farFutureExpiry = Date.now() + TEN_YEARS_IN_MS;

      await db.transact([
        db.tx.$users[guestUserId].update({
          balance: 12000,               // Starting online/offline pool
          voucherMaxBalance: 12000,      // Match the full balance for seamless offline use
          sequenceNumber: 1,
          expiresAt: farFutureExpiry,  // Decade-long validity
          serverSignature: "MOCK_LONG_TERM_SERVER_SIGNATURE_HEX"
        })
      ]);

      console.log("💰 Wallet successfully initialized with $12,000.");
    } else {
      console.log(`👋 Welcome back guest (${guestUserId}). Current balance: $${extendedUser.balance}`);
    }

    return user;
  } catch (error) {
    console.error("Guest login failed:", error);
    throw error;
  }
}


export default function LandingPage({ onStartApp }: LandingPageProps) {
  return (
    <main className="min-h-svh bg-slate-50 text-slate-900">
      <section id="center" className="mx-auto flex min-h-svh max-w-5xl flex-col items-center justify-center gap-6 px-4 py-8">
        <div className="hero relative">
          <img src={myLogo} alt="FAY_LOGO" width="200" />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-medium tracking-tight md:text-5xl">
            Send and receive payments OFFLINE
          </h1>
          <p className="text-slate-600">
            Fayd allows you to send and receive payments without an internet connection.
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={onStartApp}
            className="rounded-xl hidden bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-slate-800 active:scale-[0.98]"
          >
            Launch Demo
          </button>
          <button
            onClick={handleGuestLogin}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow transition hover:bg-slate-800 active:scale-[0.98]"
          >
            Sign in as Guest
          </button>
        </div>
      </section>
    </main>
  )
}
