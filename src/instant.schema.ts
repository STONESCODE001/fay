// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    // 1. Extend the built-in System User collection
    $users: i.entity({
      // Email is a default system field, we keep it optional since we use Guest Auth
      email: i.string().unique().indexed().optional(),

      // --- Our Custom Financial Wallet Fields ---
      balance: i.number().optional(),             // Main online wallet balance

      // --- Our Offline Security Fields ---
      voucherMaxBalance: i.number().optional(),   // Safe offline spending ceiling
      sequenceNumber: i.number().optional(),      // Anti-replay sync counter
      expiresAt: i.number().optional(),           // Offline ticket expiration timestamp
      serverSignature: i.string().optional(),     // Server mathematical watermark
    }),

    // 2. Real-Time Transaction Ledger
    transactions: i.entity({
      amount: i.number(),
      type: i.string(),                 // "ONLINE_PAYMENT" or "OFFLINE_PAYMENT"
      status: i.string(),               // "completed", "pending_sync", or "failed"
      senderBalanceBefore: i.number(),  // Tracks cryptographically signed snapshot
      senderBalanceAfter: i.number(),   // Remaining wallet balance post-transaction
      nonce: i.string(),                // Unique transaction ID flag
      timestamp: i.number().indexed(),  // Chronological sorting key
      rawPayload: i.string().optional(),// Crypto string packet (if offline)
    }),
  },

  // 3. Update the Relational Links to point directly to $users
  links: {
    // Multi-directional relationship links for standard querying and traversal
    userSentTransactions: {
      forward: { on: "transactions", has: "one", label: "sender" }, // 👈 FIXED: A transaction has exactly ONE sender
      reverse: { on: "$users", has: "many", label: "sentTransactions" },
    },
    userReceivedTransactions: {
      forward: { on: "transactions", has: "one", label: "receiver" }, // 👈 FIXED: A transaction has exactly ONE receiver
      reverse: { on: "$users", has: "many", label: "receivedTransactions" },
    },
  },
});

// Provides enhanced TypeScript intellisense autocomplete support
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema { }
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;