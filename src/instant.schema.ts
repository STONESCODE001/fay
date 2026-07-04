// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/core";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      balance: i.number().optional(),
      voucherMaxBalance: i.number().optional(),   // Safe offline spending ceiling
      sequenceNumber: i.number().optional(),      // Anti-replay sync counter
      expiresAt: i.number().optional(),           // Offline ticket expiration timestamp
      serverSignature: i.string().optional(),     // Server mathematical watermark
    }),
    transactions: i.entity({
      amount: i.number(),
      type: i.string(),
      status: i.string(),
      senderBalanceBefore: i.number(),
      senderBalanceAfter: i.number(),
      sequenceNumber: i.number(),
      nonce: i.string(),
      timestamp: i.number(),
      rawPayload: i.string().optional(),// Crypto string packet (if offline)
    }),
    // 🌟 THE UNBREAKABLE LOCAL-FIRST SCRATCHPAD ENTITY
    voucher_claims: i.entity({
      amount: i.number(),
      senderId: i.string(),
      receiverId: i.string(),
      status: i.string(),
      timestamp: i.number(),
      nonce: i.string(),
      type: i.string(),
    }),
  },

  links: {
    // Your exact existing relationship hooks preserved completely
    userSentTransactions: {
      forward: { on: "transactions", has: "one", label: "sender" },
      reverse: { on: "$users", has: "many", label: "sentTransactions" },
    },
    userReceivedTransactions: {
      forward: { on: "transactions", has: "one", label: "receiver" },
      reverse: { on: "$users", has: "many", label: "receivedTransactions" },
    },
    // 🌟 RELATIONAL SYSTEM LINK: Relates the claim log to the transaction row via their shared ID
    voucherClaimTransaction: {
      forward: { on: "transactions", has: "one", label: "claim" },
      reverse: { on: "voucher_claims", has: "one", label: "transaction" },
    },
  },
});

// Provides enhanced TypeScript intellisense autocomplete support
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema { }
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
