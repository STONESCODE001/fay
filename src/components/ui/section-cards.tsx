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
import { useState, useEffect } from 'react'
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
import { isMobile } from 'react-device-detect';
import { db } from "../../lib/db"

export function SectionCards() {
  // ─── 1. HOOK DECLARATIONS ───
  const { user: authState } = db.useAuth();

  const { data, isLoading } = db.useQuery(
    authState
      ? {
        $users: { $: { where: { id: authState.id } } },
        transactions: {
          $: {
            order: { timestamp: "desc" },
            limit: 10
          },
          sender: {},
          receiver: {}
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

  // ─── 2. DERIVED VALUES ───
  const dbUser = data?.$users?.[0];
  const userBalance = dbUser?.balance ?? 0;
  // Fallback to 0 if the counter hasn't been set yet
  const userSequenceNumber = dbUser?.sequenceNumber ?? 0;
  const recentTransactions = data?.transactions ?? [];

  const [isOnline, setIsOnline] = useState(true);
  const connectionStatus = db.useConnectionStatus();

  useEffect(() => {
    const verifyActualConnectivity = async () => {
      try {
        await fetch("https://www.google.com/favicon.ico", {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
        });
        setIsOnline(true);
      } catch (error) {
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

  useEffect(() => {
    if (userBalance !== undefined) {
      setBalance(userBalance);
    }
  }, [userBalance]);

  // ─── 3. INBOUND VOUCHER SCANNING & COUNTER VERIFICATION ───
  const processIncomingVoucher = async (decodedText: string, html5QrCodeInstance: Html5Qrcode) => {
    if (!authState?.id) {
      alert("Authentication error: Please log in again.");
      return;
    }

    try {
      const parsed = JSON.parse(decodedText);

      if (parsed.app !== "FAYD") {
        alert("Invalid QR Code: Not a FAYD asset token.");
        return;
      }

      const twoMinutes = 2 * 60 * 1000;
      if (Date.now() - parsed.timestamp > twoMinutes) {
        alert("Transaction Expired: Request a fresh QR code from the sender.");
        return;
      }

      // 🛡️ RE-HASH VERIFICATION BLOCK (Now binding the unique sequence counter into the cipher message)
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

      if (parsed.senderBalanceBefore < parsed.amount) {
        alert("Transaction Declined: Sender has insufficient certified funds.");
        return;
      }

      await html5QrCodeInstance.stop();
      const txId = crypto.randomUUID();

      // Process double-sided transaction matrix natively 
      await db.transact([
        // Credit the receiver
        db.tx.$users[authState.id].update({
          balance: userBalance + parsed.amount
        }),
        // Force debit the sender in the cloud array instantly
        db.tx.$users[parsed.senderId].update({
          balance: parsed.senderBalanceBefore - parsed.amount
        }),
        // Register transaction with tracking variables
        db.tx.transactions[txId].update({
          amount: parsed.amount,
          type: parsed.type,
          status: isOnline ? "completed" : "pending_sync",
          senderBalanceBefore: parsed.senderBalanceBefore,
          senderBalanceAfter: parsed.senderBalanceBefore - parsed.amount,
          sequenceNumber: parsed.sequenceNumber, // Captured for post-sync clash protection
          nonce: `tx_${parsed.nonce}`,
          timestamp: Date.now()
        }),
        db.tx.transactions[txId].link({ sender: parsed.senderId }),
        db.tx.transactions[txId].link({ receiver: authState.id })
      ]);

      alert(`✅ Successfully processed ₦${parsed.amount}!`);
      setIsScannerMounted(false);

    } catch (e) {
      console.error(e);
      alert("Error parsing standard FAYD transactional payload structure.");
    }
  };

  useEffect(() => {
    if (!isScannerMounted || !isMobile) return;

    const timeoutId = setTimeout(() => {
      const element = document.getElementById(CAMERA_VIEWPORT_ID);
      if (!element) return;

      const html5QrCode = new Html5Qrcode(CAMERA_VIEWPORT_ID);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

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
  }, [isScannerMounted, isMobile, userBalance, isOnline]);

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

  // ─── 4. COUNTER GENERATION, BALANCE LOCK, AND CRYPTO SIGNING ───
  const handleConfirmSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error || !sendAmount || !authState?.id) return;

    const paymentAmount = parseFloat(sendAmount);
    const timestamp = Date.now();
    const senderId = authState.id;
    const senderBalanceBefore = userBalance;
    const currentSeq = userSequenceNumber;

    const nonce = Math.random().toString(36).substring(2, 15);

    // 1. Structural Payload for QR generation
    const tokenPayload = {
      app: "FAYD",
      type: `${isOnline ? "ONLINE_PAYMENT" : "OFFLINE_PAYMENT"}`,
      amount: paymentAmount,
      senderId: senderId,
      senderBalanceBefore: senderBalanceBefore,
      sequenceNumber: currentSeq,
      timestamp: timestamp,
      nonce: nonce
    };

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

      // 2. LOCK FUNDS IMMEDIATELY IN THE DB BEFORE DISPLAYING QR
      // This prevents double spending locally by changing state the moment the code is minted.
      await db.transact([
        db.tx.$users[senderId].update({
          balance: senderBalanceBefore - paymentAmount,
          sequenceNumber: currentSeq + 1
        })
      ]);

      setGeneratedPayload(JSON.stringify({ ...tokenPayload, sig: signatureHex }));
      setSendStep("QR_DISPLAY");
    } catch (err) {
      console.error(err);
      setError("Failed to securely sign transaction.");
    }
  };

  if (!authState) return null;
  if (isLoading) return <div>Loading balance...</div>;

  return (
    <div className="grid grid-cols-1 gap-1 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 dark:*:data-[slot=card]:bg-card">
      <Card className={`p-3 mb-3 ${isOnline ? 'bg-yellow-200' : 'bg-green-200'}`}>
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
            ₦{balance}
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
            <button className="flex-auto duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground rounded-full bg-[#F2F4FA] px-4 py-2 border-3 border-[#D9DDE8] text-sm font-medium text-[#4B5563]">
              Send
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
                  <span className="font-semibold text-gray-700">₦{balance.toFixed(2)}</span>
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
                        // Reset form fields cleanly now that balance logic is pre-committed
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
            <button className="flex-auto duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground rounded-full bg-[#F2F4FA] px-4 py-2 border-3 border-[#D9DDE8] text-sm font-medium text-[#4B5563]">
              Receive
            </button>
          </DialogTrigger>

          {!isMobile ? (
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Camera Scanning Unavailable</DialogTitle>
                <DialogDescription>Camera Scanning is only available on mobile devices.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Close Window</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          ) : (
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
          )}
        </Dialog>
      </div>

      <Card>
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
              {recentTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-gray-400 text-xs">
                    No transactions recorded on this profile yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentTransactions.map((tx: any) => {
                  const isSent = tx.sender?.id === authState.id;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate font-medium">
                        {tx.nonce || tx.id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            tx.status === "completed"
                              ? "bg-green-50 text-green-700 hover:bg-green-50 border border-green-200"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-200"
                          }
                        >
                          {tx.status === "completed" ? "Completed" : "Sync Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                        {tx.type ? tx.type.replace("_", " ") : "P2P CASH"}
                      </TableCell>
                      <TableCell className={`text-right font-bold tabular-nums ${isSent ? "text-red-600" : "text-emerald-600"}`}>
                        {isSent ? "-" : "+"}₦{tx.amount.toFixed(2)}
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