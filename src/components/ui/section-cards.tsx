import { IconPlayerRecordFilled, IconInfoOctagonFilled } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useState, useEffect, useRef, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ReactQRCode } from '@lglab/react-qr-code'
import { Html5Qrcode } from "html5-qrcode"
import React from "react"
import { db } from "../../lib/db"

export function SectionCards() {
  // ─── 1. HOOK DECLARATIONS ───
  const { user: authState } = db.useAuth();

  // Unified Query Hook: Fetches profiles, transactions, and matching scratchpad claims simultaneously
  const { data, isLoading } = db.useQuery(
    authState
      ? {
        $users: { $: { where: { id: authState.id } } },
        transactions: {
          $: {
            where: {
              or: [
                { "sender": authState.id },
                { "receiver": authState.id }
              ]
            },
            order: { serverCreatedAt: "desc" }, // 👈 Use system index
            limit: 10
          },
          sender: {},
          receiver: {}
        },
        voucher_claims: {
          $: {
            where: {
              or: [
                { "senderId": authState.id },
                { "receiverId": authState.id }
              ]
            },
            order: { serverCreatedAt: "desc" }, // 👈 Use system index here too!
            limit: 10
          }
        }
      }
      : null
  );

  const [sendAmount, setSendAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [sendStep, setSendStep] = useState<"FORM_ENTRY" | "QR_DISPLAY">("FORM_ENTRY");
  const [isScannerMounted, setIsScannerMounted] = useState<boolean>(false);
  const [generatedPayload, setGeneratedPayload] = useState<string>("");

  const [balance, setBalance] = useState<number>(0);
  const CAMERA_VIEWPORT_ID = "fayd-modal-lens";

  // Active Transaction IDs and Real-Time Delay Controls for Locking Accidental Cancels
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [cancelCountdown, setCancelCountdown] = useState<number>(0);

  // ─── 2. DERIVED VALUES ───
  const dbUser = data?.$users?.[0];
  const userBalance = dbUser?.balance ?? 0;
  const userSequenceNumber = dbUser?.sequenceNumber ?? 0;

  const [isOnline, setIsOnline] = useState(true);
  const connectionStatus = db.useConnectionStatus();
  const priorConnectionState = useRef<boolean | null>(null);

  // 🌟 NEW: Tracks if the database sync layout is completely stable and ready for clicks
  const isSyncReady = useMemo(() => {
    // If we are physically online, wait until InstantDB is fully authenticated
    if (isOnline) {
      return connectionStatus === "authenticated";
    }
    // If we are physically offline, we are ready instantly because we default to local-first paths
    return true;
  }, [isOnline, connectionStatus]);

  // Connection Polling Thread
  useEffect(() => {
    const verifyActualConnectivity = async () => {
      try {
        await fetch("https://www.google.com/favicon.ico", {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
        });
        setIsOnline(true);
      } catch (err) {
        setIsOnline(false);
      }
    };

    verifyActualConnectivity();
    const pingInterval = setInterval(verifyActualConnectivity, 3000);

    if (connectionStatus === "authenticated") {
      setIsOnline(true);
    }

    return () => clearInterval(pingInterval);
  }, [connectionStatus]);

  // AUTOMATIC NETWORK RECOVERY RELOAD TRIGGER
  useEffect(() => {
    if (priorConnectionState.current === false && isOnline === true) {
      window.location.reload();
    }
    priorConnectionState.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (userBalance !== undefined) {
      setBalance(userBalance);
    }
  }, [userBalance]);

  // Cooldown tracker timer loop
  useEffect(() => {
    if (cancelCountdown <= 0) return;
    const timer = setTimeout(() => {
      setCancelCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cancelCountdown]);

  // ─── 2.5 REAL-TIME DOUBLE-LEDGER RECONCILIATION ───
  const computedTransactions = useMemo(() => {
    const txs = data?.transactions ?? [];
    const claims = data?.voucher_claims ?? [];

    // Define the concrete blueprint shape of your UI rows
    interface ReconciledTransaction {
      id: string;
      amount: number;
      nonce: string;
      timestamp: number;
      type: string;
      status: string;
      senderId?: string;
      receiverId?: string;
    }

    const claimsMap = new Map(claims.map(c => [c.id, c]));
    const processedIds = new Set();
    // 🌟 Add explicit type annotation to the array instantiation
    const combinedList: ReconciledTransaction[] = [];

    // 1. Process standard transaction entries
    // 1. Process standard transaction entries
    txs.forEach((tx) => {
      processedIds.add(tx.id);
      const linkedClaim = claimsMap.get(tx.id);

      combinedList.push({
        id: tx.id,
        amount: tx.amount,
        nonce: tx.nonce,
        timestamp: tx.timestamp || Date.now(), // 👈 CHANGED: Read from tx.timestamp
        type: tx.type || "P2P CASH",
        status: (tx.status === "completed" || !!linkedClaim || !!tx.receiver) ? "completed" : tx.status,
        senderId: tx.sender?.id,
        receiverId: tx.receiver?.id || linkedClaim?.receiverId
      });
    });

    // 2. Catch and merge orphan offline claims before the sender pushes their transaction block
    claims.forEach((claim) => {
      if (processedIds.has(claim.id)) return;
      processedIds.add(claim.id);

      combinedList.push({
        id: claim.id,
        amount: claim.amount,
        nonce: claim.nonce,
        timestamp: claim.timestamp,
        type: "OFFLINE_PAYMENT",
        status: "completed",
        senderId: claim.senderId,
        receiverId: claim.receiverId
      });
    });

    return combinedList.sort((a, b) => b.timestamp - a.timestamp);
  }, [data?.transactions, data?.voucher_claims]);

  // ─── 3. INBOUND VOUCHER SCANNING & SECURE PROCESSING ───
  const processIncomingVoucher = async (decodedText: string, html5QrCodeInstance: Html5Qrcode) => {
    if (!authState?.id) {
      alert("Authentication error: Please log in again.");
      return;
    }

    if (!decodedText.trim().startsWith("{") || !decodedText.includes('"app":"FAYD"')) {
      return;
    }

    try {
      const parsed = JSON.parse(decodedText);

      const twoMinutes = 2 * 60 * 1000;
      if (Date.now() - parsed.timestamp > twoMinutes) {
        alert("Transaction Expired: Request a fresh QR code from the sender.");
        return;
      }

      // Cryptographic Signature Verification
      const envSecret = import.meta.env.VITE_FAYD_OFFLINE_SECRET || "FALLBACK_DEV_KEY";
      const secretMessage = `${parsed.senderId}-${parsed.amount}-${parsed.senderBalanceBefore}-${parsed.sequenceNumber}-${parsed.timestamp}-${parsed.nonce}`;

      const encoder = new TextEncoder();
      const keyData = encoder.encode(envSecret);
      const messageData = encoder.encode(secretMessage);

      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const sigBuffer = new Uint8Array(
        parsed.sig.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16))
      );

      const isSignatureValid = await window.crypto.subtle.verify("HMAC", cryptoKey, sigBuffer, messageData);

      if (!isSignatureValid) {
        alert("🚨 Security Alert: Digital signature validation failed! Data tampered.");
        return;
      }

      // FORCE STOP CAMERA INSTANTLY
      try {
        await html5QrCodeInstance.stop();
      } catch (err) {
        console.error("Camera release mismatch:", err);
      }
      setIsScannerMounted(false);

      // 🎯 INGEST MUTATION (Updated to avoid server-side graph links while offline)
      await db.transact([
        // 1. Instantly credit local wallet balance safely
        db.tx.$users[authState.id].update({
          balance: userBalance + parsed.amount
        }),
        // 2. Write the details into the voucher_claims collection using the txId as the record ID
        // This acts as our rock-solid anchor that the server will accept unconditionally.
        db.tx.voucher_claims[parsed.txId].update({
          amount: parsed.amount,
          senderId: parsed.senderId,
          receiverId: authState.id,
          status: "completed",
          timestamp: parsed.timestamp,
          nonce: parsed.nonce,
          type: "OFFLINE_INGESTION"
        })
        // ❌ REMOVED: db.tx.transactions[parsed.txId].link(...) 
        // Dropping this line prevents the server from rejecting the sync payload if the sender is still offline!
      ]);

      alert(`✅ Successfully processed ₦${parsed.amount}!`);

    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!isScannerMounted) return;

    const timeoutId = setTimeout(() => {
      const element = document.getElementById(CAMERA_VIEWPORT_ID);
      if (!element) return;

      const html5QrCode = new Html5Qrcode(CAMERA_VIEWPORT_ID);
      const config = { fps: 15, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => processIncomingVoucher(decodedText, html5QrCode),
        () => { }
      ).catch((err) => console.error(err));

      (window as any)._activeScannerInstance = html5QrCode;
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      const activeEngine = (window as any)._activeScannerInstance;
      if (activeEngine && activeEngine.isScanning) {
        activeEngine.stop().catch((err: any) => console.error(err));
      }
    };
  }, [isScannerMounted, userBalance, isOnline]);

  const handleAmountChange = (val: string) => {
    setSendAmount(val);
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setError("Please input a valid number amount");
    } else if (num > balance) {
      setError("Insufficient wallet funds available");
    } else {
      setError(null);
    }
  };

  const handleSetPercentage = (pct: number) => {
    const calculated = (balance * pct).toFixed(2);
    handleAmountChange(calculated);
  };

  const handleConfirmSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error || !sendAmount || !authState?.id) return;

    const paymentAmount = parseFloat(sendAmount);
    const timestamp = Date.now();
    const senderId = authState.id;
    const senderBalanceBefore = userBalance;
    const currentSeq = userSequenceNumber;
    const targetTxId = crypto.randomUUID();
    const nonce = Math.random().toString(36).substring(2, 15);

    try {
      const envSecret = import.meta.env.VITE_FAYD_OFFLINE_SECRET || "FALLBACK_DEV_KEY";
      const secretMessage = `${senderId}-${paymentAmount}-${senderBalanceBefore}-${currentSeq}-${timestamp}-${nonce}`;

      const encoder = new TextEncoder();
      const keyData = encoder.encode(envSecret);
      const messageData = encoder.encode(secretMessage);

      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const signatureBuffer = await window.crypto.subtle.sign("HMAC", cryptoKey, messageData);
      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      const tokenPayload = {
        app: "FAYD",
        type: "OFFLINE_PAYMENT",
        txId: targetTxId,
        amount: paymentAmount,
        senderId: senderId,
        senderBalanceBefore: senderBalanceBefore,
        sequenceNumber: currentSeq,
        timestamp: timestamp,
        nonce: nonce,
        sig: signatureHex
      };

      await db.transact([
        db.tx.$users[senderId].update({
          balance: senderBalanceBefore - paymentAmount,
          sequenceNumber: currentSeq + 1
        }),
        db.tx.transactions[targetTxId].update({
          amount: paymentAmount,
          type: "OFFLINE_PAYMENT",
          status: "conditional",
          senderBalanceBefore: senderBalanceBefore,
          senderBalanceAfter: senderBalanceBefore - paymentAmount,
          sequenceNumber: currentSeq,
          nonce: `tx_${nonce}`,
          timestamp: timestamp
        }),
        db.tx.transactions[targetTxId].link({ sender: senderId })
      ]);

      setActiveTxId(targetTxId);
      setCancelCountdown(20);

      setGeneratedPayload(JSON.stringify(tokenPayload));
      setSendStep("QR_DISPLAY");
    } catch (err) {
      console.error(err);
      setError("Failed to securely sign transaction.");
    }
  };

  if (!authState) return null;
  if (isLoading) return <div>Loading balance...</div>;

  const cancelTransaction = async (txId: string, amount: number) => {
    if (!authState?.id) return;

    await db.transact([
      db.tx.$users[authState.id].update({
        balance: userBalance + amount
      }),
      db.tx.transactions[txId].delete()
    ]);

    setSendAmount("");
    setSendStep("FORM_ENTRY");
    setActiveTxId(null);
    alert("Transaction voided. Funds successfully returned to your balance.");
  };

  return (
    <div id="dashboard" className="grid grid-cols-1 gap-1 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 dark:*:data-[slot=card]:bg-card">
      <Card data-flow="status-banner" className={`p-3 mb-3 ${isOnline ? 'bg-yellow-200' : 'bg-green-200'}`}>
        <CardHeader>
          <CardDescription className={`flex gap-2 ${isOnline ? 'text-yellow-600' : 'text-green-600'}`}>
            <IconInfoOctagonFilled className="size-4 " />
            {isOnline ? "Kindly go offline to test the app / kindly turn airplane mode on" : "Kindly go online to test the app / kindly off airplane mode"}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className={`@container/card border-5 ${isOnline ? 'border-green-800 bg-green-100' : 'border-yellow-800 bg-yellow-100'} shadow-lg`}>
        <CardHeader>
          <CardDescription>Balance</CardDescription>
          <CardTitle className="text-2xl font-extrabold tabular-nums @[250px]/card:text-3xl">
            ₦{(balance ?? 0).toFixed(2)}
          </CardTitle>
          <CardAction>
            <Badge className={isOnline ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
              <span>
                {isOnline ? "online" : "offline"}
                {!isOnline && connectionStatus === "authenticated" && " (sync delayed)"}
                {!isOnline && (connectionStatus === "connecting" || connectionStatus === "opened") && " (reconnecting...)"}
              </span>
              <IconPlayerRecordFilled className="size-4" />
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>

      <div className="flex m-2 gap-2">
        <Dialog onOpenChange={(isOpen) => { if (!isOpen) setSendStep("FORM_ENTRY"); }}>
          <DialogTrigger asChild>
            <button
              data-flow="send-btn"
              disabled={!isSyncReady}
              className={`flex-auto flex items-center justify-center gap-2 duration-200 ease-linear rounded-full px-4 py-2 border-3 text-sm font-medium transition-all
                ${!isSyncReady
                  ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-70"
                  : "bg-[#F2F4FA] border-[#D9DDE8] text-[#4B5563] hover:bg-primary/90 hover:text-primary-foreground"
                }`}
            >
              {!isSyncReady && isOnline && (
                <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {!isSyncReady && isOnline ? "Connecting..." : "Send"}
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>{sendStep === "FORM_ENTRY" ? "Send Funds" : "Scan to Withdraw"}</DialogTitle>
              <DialogDescription>
                {sendStep === "FORM_ENTRY" ? "Enter the amount you want to transfer." : "Display this code to the receiver."}
              </DialogDescription>
            </DialogHeader>

            {sendStep === "FORM_ENTRY" ? (
              <form onSubmit={handleConfirmSend} className="space-y-4 my-2">
                <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                  <span>Available Balance</span>
                  <span className="font-semibold text-gray-700">₦{(balance ?? 0).toFixed(2)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-medium text-gray-400">₦</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`w-full pl-8 pr-16 py-3 border-2 rounded-xl text-xl font-semibold tracking-wide outline-none transition-all
                      ${error ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500' : 'border-gray-200 bg-gray-50 focus:border-primary focus:bg-white'}
                    `}
                    placeholder="0.00"
                    value={sendAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleSetPercentage(1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"
                  >
                    MAX
                  </button>
                </div>
                {error && <p className="text-xs text-red-500 font-medium px-1">⚠️ {error}</p>}
                <DialogFooter className="pt-2 gap-2 sm:gap-0">
                  <DialogClose asChild>
                    <Button variant="outline" type="button">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={!!error || !sendAmount || parseFloat(sendAmount) <= 0}>
                    Confirm & Send
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="space-y-6 my-2 text-center animate-fade-in">
                <div className="bg-white border-2 border-slate-100 p-6 rounded-2xl inline-block mx-auto shadow-sm relative overflow-hidden">
                  <div className="absolute inset-x-0 h-0.5 bg-emerald-500 top-0 animate-bounce"></div>
                  <ReactQRCode
                    dataModulesSettings={{ style: 'rounded', color: '#4267B2', size: 1 }}
                    finderPatternOuterSettings={{ style: 'inpoint-sm' }}
                    finderPatternInnerSettings={{ style: 'leaf-sm' }}
                    marginSize={2}
                    size={256}
                    value={generatedPayload}
                  />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      variant="default"
                      type="button"
                      onClick={() => {
                        setSendAmount("");
                        setSendStep("FORM_ENTRY");
                      }}
                    >
                      Close Voucher Window
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog onOpenChange={(isOpen) => setIsScannerMounted(isOpen)}>
          <DialogTrigger asChild>
            <button
              data-flow="receive-btn"
              disabled={!isSyncReady}
              className={`flex-auto flex items-center justify-center gap-2 duration-200 ease-linear rounded-full px-4 py-2 border-3 text-sm font-medium transition-all
                ${!isSyncReady
                  ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-70"
                  : "bg-[#F2F4FA] border-[#D9DDE8] text-[#4B5563] hover:bg-primary/90 hover:text-primary-foreground"
                }`}
            >
              {!isSyncReady && isOnline ? "Initializing..." : "Receive"}
            </button>
          </DialogTrigger>

          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Scan Inbound Code</DialogTitle>
              <DialogDescription>Align the targeting viewport box over the sender's voucher code.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-2">
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl overflow-hidden shadow-inner">
                <div id={CAMERA_VIEWPORT_ID} className="w-full font-sans overflow-hidden rounded-xl"></div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Close Camera Lens</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card data-flow="history-card">
        <CardHeader>Recent Transactions</CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice / ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-gray-400 text-xs">
                    No transactions recorded on this profile yet.
                  </TableCell>
                </TableRow>
              ) : (
                computedTransactions.map((tx: any) => {
                  const isSent = tx.senderId === authState.id;
                  const isReceived = tx.receiverId === authState.id;

                  if (!isSent && !isReceived) return null;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate font-medium">
                        {tx.nonce || tx.id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              tx.status === "completed"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : tx.status === "conditional"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                            }
                          >
                            {tx.status === "completed" ? "Completed" : tx.status === "conditional" ? "Conditional Hold" : "Sync Pending"}
                          </Badge>

                          {tx.status === "conditional" && isSent && (
                            cancelCountdown > 0 && activeTxId === tx.id ? (
                              <span className="text-[10px] text-gray-400 px-2 py-0.5 font-semibold font-mono">
                                Cancel in 0:{(cancelCountdown < 10 ? "0" : "") + cancelCountdown}
                              </span>
                            ) : (
                              <button
                                onClick={() => cancelTransaction(tx.id, tx.amount)}
                                className="text-[10px] bg-red-50 text-red-600 hover:bg-red-100 px-2 py-0.5 rounded border border-red-200 font-bold uppercase tracking-wider"
                              >
                                Cancel
                              </button>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                        {tx.type ? tx.type.replace("_", " ") : "P2P CASH"}
                      </TableCell>
                      <TableCell className={`text-right font-bold tabular-nums ${isSent ? "text-red-600" : "text-emerald-600"}`}>
                        {isSent ? "-" : "+"}₦{typeof tx.amount === 'number' ? tx.amount.toFixed(2) : "0.00"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}