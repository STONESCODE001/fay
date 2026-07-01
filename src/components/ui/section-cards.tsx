import { IconTrendingDown, IconTrendingUp, IconPlayerRecordFilled, IconInfoOctagonFilled } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
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
import { useState, useEffect, useRef } from 'react'
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
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode" // The Camera Engine
import React from "react"
import { isMobile } from 'react-device-detect';
import { db } from "../../lib/db"



export function SectionCards() {
  // ─── 1. ALL HOOK DECLARATIONS AT THE TOP LEVEL ───
  const user = db.useUser();
  const { user: authState } = db.useAuth();

  // Query hook uses conditional logic inside its argument rather than wrapper blocks
  const { data, isLoading } = db.useQuery(
    authState ? { $users: { $: { where: { id: authState.id } } } } : null
  );

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sendAmount, setSendAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Dialog routing states
  const [sendStep, setSendStep] = useState<"FORM_ENTRY" | "QR_DISPLAY">("FORM_ENTRY");
  const [isScannerMounted, setIsScannerMounted] = useState<boolean>(false);
  const [generatedPayload, setGeneratedPayload] = useState<string>("");

  // Dynamic state representation for balance sync
  const [balance, setBalance] = useState<number>(0);

  // Camera device references
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const CAMERA_VIEWPORT_ID = "fayd-modal-lens";

  // ─── 2. EXTRACT & CALCULATE DERIVED VALUES ───
  const dbUser = data?.$users?.[0];
  const userBalance = dbUser?.balance ?? 0;

  // ─── 3. SYNCHRONIZE BACKEND DATA TO COMPONENT STATE VIA EFFECTS ───
  useEffect(() => {
    console.log("Your live offline/online balance:", userBalance);
    if (userBalance !== undefined) {
      setBalance(userBalance);
    }
  }, [userBalance]);

  // Camera lens tracking logic safely declared above early returns
  useEffect(() => {
    if (!isScannerMounted || !isMobile) return;

    const element = document.getElementById(CAMERA_VIEWPORT_ID);
    if (!element) return;

    const scanner = new Html5QrcodeScanner(
      CAMERA_VIEWPORT_ID,
      { fps: 10, qrbox: 250 },
      /* verbose= */ false
    );

    return () => {
      scanner.clear().catch((error) => console.error("Failed to clear scanner", error));
    };
  }, [isScannerMounted, isMobile]);

  // ─── 4. HANDLERS AND EVENT MANAGEMENT ───
  const goOnline = () => setIsOnline(true);
  const goOffline = () => setIsOnline(false);

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

  const handleConfirmSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (error || !sendAmount) return;

    const tokenPayload = {
      app: "FAYD",
      type: "OFFLINE_PAYMENT",
      amount: parseFloat(sendAmount),
      timestamp: Date.now()
    };

    setGeneratedPayload(JSON.stringify(tokenPayload));
    setSendStep("QR_DISPLAY");
  };

  // ─── 5. CONDITIONAL RENDER CLAUSES (PLACED SAFELY AFTER ALL HOOKS) ───
  if (!authState) return null;
  if (isLoading) return <div>Loading balance...</div>;

  // ─── 6. COMPONENT RENDER OUTPUT (JSX) ───

  return (
    <div className="grid grid-cols-1 gap-1 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-1 @5xl/main:grid-cols-1 dark:*:data-[slot=card]:bg-card">
      <Card className={`p-3 mb-3 ${isOnline ? 'bg-yellow-200' : 'bg-green-200'}`}>
        <CardHeader>
          <CardDescription className={`flex gap-2 ${isOnline ? 'text-yellow-600' : 'text-green-600'}`}>
            <IconInfoOctagonFilled className="size-4 " />
            Kindly go offline to test the app / kindly turn airplane mode on
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
              <span>{isOnline ? "online" : "offline"}</span>
              {isOnline ? <IconPlayerRecordFilled className="size-4" /> : <IconPlayerRecordFilled className="size-4" />}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm hidden">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {isOnline ? <IconTrendingUp className="size-4" /> : <IconTrendingDown className="size-4" />}
          </div>
        </CardFooter>
      </Card>

      <div className="flex m-2 gap-2 ">

        {/* ==================== SEND DIALOG WORKFLOW ==================== */}
        <Dialog onOpenChange={(isOpen) => { if (!isOpen) setSendStep("FORM_ENTRY"); }}>
          <DialogTrigger asChild>
            <button className="flex-auto duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground rounded-full bg-[#F2F4FA] px-4 py-2 border-3 border-[#D9DDE8] text-sm font-medium text-[#4B5563]">
              Send
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle>{sendStep === "FORM_ENTRY" ? "Send Funds" : "Scan to Withdraw"}</DialogTitle>
              <DialogDescription>
                {sendStep === "FORM_ENTRY"
                  ? "Enter the amount you want to transfer."
                  : "Display this high-contrast code to the receiver's phone camera."
                }
              </DialogDescription>
            </DialogHeader>

            {/* SEND STEP 1 VIEW LAYOUT: INPUT VALUES STAGE */}
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
              /* SEND STEP 2 VIEW LAYOUT: RENDER THE HIGH CONTRAST SVG QR CODE VECTOR */
              <div className="space-y-6 my-2 text-center animate-fade-in">
                <div className="bg-white border-2 border-slate-100 p-6 rounded-2xl inline-block mx-auto shadow-sm relative overflow-hidden">
                  {/* Visual Laser Line Animation Effect */}
                  <div className="absolute inset-x-0 h-0.5 bg-emerald-500 top-0 animate-bounce"></div>
                  {/* <QRCode
                    value={generatedPayload}
                    size={160}
                    level="M"
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  /> */}
                  <ReactQRCode
                    dataModulesSettings={{
                      style: 'rounded',
                      color: '#4267B2',
                      size: 1,
                    }}
                    finderPatternOuterSettings={{
                      style: 'inpoint-sm',
                    }}
                    finderPatternInnerSettings={{
                      style: 'leaf-sm',
                    }}
                    marginSize={2}
                    size={256}
                    value={generatedPayload}
                  />
                </div>

                <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-400 font-mono select-none break-all text-left">
                  Payload Array: {generatedPayload}
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button" onClick={() => setBalance(prev => prev - parseFloat(sendAmount))}>
                      Done (Deduct Funds)
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ==================== RECEIVE DIALOG WORKFLOW ==================== */}
        <Dialog onOpenChange={(isOpen) => setIsScannerMounted(isOpen)}>
          <DialogTrigger asChild>
            <button className="flex-auto duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground rounded-full bg-[#F2F4FA] px-4 py-2 border-3 border-[#D9DDE8] text-sm font-medium text-[#4B5563]">
              Receive
            </button>
          </DialogTrigger>

          {!isMobile ? (
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Camera Scanning Unavailable</DialogTitle>
                <DialogDescription>
                  Camera Scanning is only available on mobile devices.
                </DialogDescription>
              </DialogHeader>

              {/* Footer inside the desktop view */}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close Window</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          ) : (
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Scan Inbound Code</DialogTitle>
                <DialogDescription>
                  Align the targeting square viewport box over the sender's dynamic canvas voucher.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2">
                <div className="bg-slate-50 border border-slate-200 p-2 rounded-2xl overflow-hidden shadow-inner">
                  <div id={CAMERA_VIEWPORT_ID} className="w-full font-sans overflow-hidden rounded-xl"></div>
                </div>
              </div>

              {/* Footer inside the mobile view */}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close Camera Lens</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>



      </div>




      <Card>
        <CardHeader>
          Recent Transactions
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">INV001</TableCell>
                <TableCell>Paid</TableCell>
                <TableCell>Credit Card</TableCell>
                <TableCell className="text-right">$250.00</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  )
}



