// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    // 1. Extend the built-in System User collection
    $users: i.entity({
      // Email is a default system field, we keep it optional since we use Guest Auth
      email: i.string().unique().indexed().optional(),

      // --- Our Custom Financial Wallet Fields (Must be .optional()) ---
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
      type: i.string(),                 // "online" or "offline"
      status: i.string(),               // "completed", "pending_sync", or "failed"
      nonce: i.string(),                // Unique transaction ID flag
      timestamp: i.number().indexed(),  // Chronological sorting key
      rawPayload: i.string().optional(),// Crypto string packet (if offline)
    }),
  },

  // 3. Update the Relational Links to point directly to $users
  links: {
    userSentTransactions: {
      forward: { on: "transactions", has: "many", label: "sentTransactions" },
      reverse: { on: "$users", has: "one", label: "sender" },
    },
    userReceivedTransactions: {
      forward: { on: "transactions", has: "many", label: "receivedTransactions" },
      reverse: { on: "$users", has: "one", label: "receiver" },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema { }
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;