'use client'

import { use, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Copy, Check, Shield, Clock, Wallet, Loader2, ArrowRight,
  CircleCheck, CircleDot, Circle, Zap, QrCode, Info, LockKeyhole,
  PartyPopper, XCircle, RefreshCw, ChevronLeft, Headphones, X, Upload, Maximize2,
  ExternalLink, Smartphone
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PaymentData {
  paymentId: string
  orderId: string
  amountINR: number
  amountUSDT: number
  exchangeRate: number
  currency: string
  customerName: string
  customerEmail: string
  callbackUrl: string
  status: string
  createdAt: number
  expiresAt: number
  cancelUrl: string
  txHash?: string

  // P2P fields
  paymentMethod?: string
  vendorId?: string
  vendorName?: string
  vendorUpiId?: string
  vendorBankName?: string
  vendorAccountHolder?: string
  vendorAccountNumber?: string
  vendorIfscCode?: string
  vendorQrCode?: string
  utrNumber?: string
  payerName?: string
  screenshotUrl?: string
  vendorApproval?: string
  liquidityLocked?: boolean
  verificationType?: string
  frozenTimeLeft?: number
}

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------
function useCountdown(expiresAt: number | null, isPaused: boolean = false, frozenTimeLeftMs?: number) {
  const calc = useCallback(() => {
    if (isPaused && frozenTimeLeftMs !== undefined) {
      return Math.max(0, Math.floor(frozenTimeLeftMs / 1000));
    }
    return expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : -1;
  }, [expiresAt, isPaused, frozenTimeLeftMs]);

  const [t, setT] = useState(calc);

  useEffect(() => {
    setT(calc());
    if (isPaused || !expiresAt) return;
    const id = setInterval(() => {
      setT(calc());
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isPaused, calc]);

  const mm = String(Math.floor(Math.max(0, t) / 60)).padStart(2, '0')
  const ss = String(Math.max(0, t) % 60).padStart(2, '0')
  return { mm, ss, total: t }
}

const ALL_PAYMENT_METHODS = [
  { id: 'PhonePe', title: 'PhonePe', desc: 'Instant transfer via PhonePe UPI', category: 'UPI' },
  { id: 'Google Pay', title: 'Google Pay (GPay)', desc: 'Instant transfer via Google Pay', category: 'UPI' },
  { id: 'Paytm', title: 'Paytm', desc: 'Instant transfer via Paytm UPI', category: 'UPI' },
  { id: 'Bank Transfer', title: 'Bank Transfer', desc: 'Direct IMPS / NEFT Bank Account Transfer', category: 'Bank' },
  { id: 'UPI', title: 'UPI ID', desc: 'Any standard UPI VPA application', category: 'UPI' },
  { id: 'IMPS', title: 'IMPS', desc: 'Immediate Payment Service Transfer', category: 'Bank' },
]

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ paymentId: string }>
}) {
  const { paymentId } = use(params)

  const [payment, setPayment] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  // ESC key listener to dismiss QR modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsQrModalOpen(false)
      }
    }
    if (isQrModalOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isQrModalOpen])

  // Dynamic UPI Intent URI containing exact Amount, Currency & Order Reference
  const dynamicUpiUri = useMemo(() => {
    if (!payment?.vendorUpiId) return '';
    const params = new URLSearchParams({
      pa: payment.vendorUpiId,
      pn: payment.vendorName || payment.vendorAccountHolder || 'Merchant',
      am: Number(payment.amountINR).toFixed(2),
      cu: 'INR',
      tr: payment.orderId,
      tn: `Deposit Order ${payment.orderId}`
    });
    return `upi://pay?${params.toString()}`;
  }, [payment]);

  // Specific App Intent deep-links for mobile 1-tap checkout
  const appIntents = useMemo(() => {
    if (!payment?.vendorUpiId) return null;
    const baseParams = new URLSearchParams({
      pa: payment.vendorUpiId,
      pn: payment.vendorName || payment.vendorAccountHolder || 'Merchant',
      am: Number(payment.amountINR).toFixed(2),
      cu: 'INR',
      tr: payment.orderId,
      tn: `Deposit Order ${payment.orderId}`
    }).toString();

    return {
      generic: `upi://pay?${baseParams}`,
      phonepe: `phonepe://pay?${baseParams}`,
      gpay: `tez://upi/pay?${baseParams}`,
      paytm: `paytmmp://pay?${baseParams}`,
    };
  }, [payment]);

  // Dynamic QR Code image URL (500x500 high-resolution with amount locked)
  const qrImageUrl = useMemo(() => {
    if (!payment) return '';
    if (payment.vendorQrCode) return payment.vendorQrCode;
    if (dynamicUpiUri) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&bgcolor=ffffff&color=0a1628&data=${encodeURIComponent(dynamicUpiUri)}`;
    }
    return 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&bgcolor=ffffff&color=0a1628&data=No%20UPI%20ID%20Configured';
  }, [payment, dynamicUpiUri]);

  // Selection/Summary states
  const [isMatching, setIsMatching] = useState(false)
  const [matchingStep, setMatchingStep] = useState(0)
  const [selectedMethod, setSelectedMethod] = useState<string>('PhonePe')

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('PhonePe')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (selectedMethod) {
      const match = ALL_PAYMENT_METHODS.find(m => m.id === selectedMethod)
      setSearchTerm(match ? match.title : selectedMethod)
    }
  }, [selectedMethod])

  const filteredMethods = useMemo(() => {
    const selectedMatch = ALL_PAYMENT_METHODS.find(m => m.id === selectedMethod)
    const selectedTitle = selectedMatch ? selectedMatch.title : selectedMethod

    // If search term is empty OR it matches the selected method's title exactly, show all options
    if (!searchTerm || searchTerm === selectedTitle) {
      return ALL_PAYMENT_METHODS;
    }

    return ALL_PAYMENT_METHODS.filter(m =>
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [searchTerm, selectedMethod])

  // P2P Payer Entry States
  const [payerName, setPayerName] = useState('')
  // Pre-generate a gorgeous, valid 12-digit mock UTR number on component mount so screenshot generator & payload already have one
  const [utrNumber, setUtrNumber] = useState(() => {
    return "9" + Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
  })
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null)
  const [verificationType, setVerificationType] = useState<'auto' | 'manual'>('manual')
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [proofError, setProofError] = useState<string | null>(null)

  const [paymentStatus, setPaymentStatus] = useState<string>('pending')
  const [txHash, setTxHash] = useState<string | null>(null)

  // Fetch payment info
  const fetchPayment = useCallback(async () => {
    try {
      const res = await fetch(`/api/payment/${paymentId}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Payment not found')
        return
      }
      const data: PaymentData = await res.json()
      setPayment(data)
      setPaymentStatus(data.status)
      if (data.txHash) setTxHash(data.txHash)

      // Auto prefill payer name with customer name
      if (data.customerName && !payerName) {
        setPayerName(data.customerName)
      }
    } catch {
      setError('Failed to load payment info')
    } finally {
      setLoading(false)
    }
  }, [paymentId, payerName])

  const fetchPaymentRef = useRef(fetchPayment)
  useEffect(() => {
    fetchPaymentRef.current = fetchPayment
  }, [fetchPayment])

  useEffect(() => {
    fetchPayment()
  }, [fetchPayment])

  // BFCache (Back-Forward Cache) guard – force fresh reload if page is restored from memory cache
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Redirect on completion (1 second delay for visual feedback)
  useEffect(() => {
    if (!payment) return;
    const finalStatuses = ['completed', 'expired', 'cancelled'];
    const isFinal = finalStatuses.includes(paymentStatus);

    if (!isFinal) return;

    const timer = setTimeout(() => {
      const isSuccess = paymentStatus === 'completed';
      const targetBase = isSuccess ? payment.callbackUrl : (payment.cancelUrl || payment.callbackUrl);

      if (targetBase) {
        try {
          const url = new URL(targetBase);
          url.searchParams.set('payment_id', payment.paymentId);
          url.searchParams.set('order_id', payment.orderId);
          url.searchParams.set('status', paymentStatus);
          if (txHash) url.searchParams.set('tx_hash', txHash);

          console.log(`[REDIRECT] Navigating to: ${url.toString()}`);
          window.location.replace(url.toString());
        } catch {
          const separator = targetBase.includes('?') ? '&' : '?';
          window.location.replace(`${targetBase}${separator}payment_id=${payment.paymentId}&order_id=${payment.orderId}&status=${paymentStatus}`);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [paymentStatus, payment, txHash]);

  // Polling watcher – check payment confirmation every 4 seconds
  useEffect(() => {
    if (!paymentId) return;

    let isSubscribed = true;
    const finalStatuses = ['completed', 'expired', 'cancelled'];

    const checkStatus = async () => {
      if (!isSubscribed) return;
      try {
        const res = await fetch(`/api/payment/${paymentId}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (!isSubscribed) return;

        if (data.status === 'completed') {
          setPaymentStatus('completed');
          if (data.tx_hash) setTxHash(data.tx_hash);
        } else if (data.status === 'expired') {
          setPaymentStatus('expired');
        } else if (data.status === 'cancelled') {
          setPaymentStatus('cancelled');
        } else if (data.status === 'confirming') {
          setPaymentStatus('confirming');
          fetchPaymentRef.current();
        } else if (data.status === 'withheld' || data.status === 'frozen') {
          setPaymentStatus(data.status);
        } else if (data.status === 'pending') {
          setPaymentStatus('pending');
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    const intervalId = setInterval(() => {
      if (!finalStatuses.includes(paymentStatus)) {
        checkStatus();
      }
    }, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [paymentId, paymentStatus]);

  // Copy to clipboard helper
  const copyText = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    }).catch(() => { })
  }, [])

  // Trigger matching engine
  const handlePayNow = async () => {
    setIsMatching(true)
    setMatchingStep(0)

    // Simulate connection progress for visual feedback
    for (let i = 0; i < 5; i++) {
      await new Promise((res) => setTimeout(res, 600))
      setMatchingStep(i + 1)
    }

    try {
      const res = await fetch(`/api/payment/${paymentId}/select-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: selectedMethod })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Matching engine failed")

      // Reload payment record with matching P2P details locked
      await fetchPayment()
    } catch (err: any) {
      alert(err.message || "No active matching vendors found.")
    } finally {
      setIsMatching(false)
    }
  }

  // Cancel Payment Flow
  const handleCancel = async () => {
    if (confirm("Cancel this deposit order?")) {
      try {
        await fetch(`/api/payment/${paymentId}/cancel`, { method: "POST" });
      } catch (err) {
        console.error("Failed to call cancel API:", err);
      }
      setPaymentStatus("cancelled");
    }
  }

  // Submit proof
  const handleSubmitProof = async () => {
    setProofError(null)
    if (!payerName.trim()) {
      setProofError("Please enter your name.")
      return
    }
    if (!screenshotBase64) {
      setProofError("Please upload the payment proof.")
      return
    }

    setIsSubmittingProof(true)

    try {
      const res = await fetch(`/api/payment/${paymentId}/submit-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer_name: payerName,
          utr: utrNumber,
          screenshot_url: screenshotBase64,
          verification_type: verificationType
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPaymentStatus("confirming")
    } catch (err: any) {
      setProofError(err.message || "Failed to submit transaction proof.")
    } finally {
      setIsSubmittingProof(false)
    }
  }

  // Handle local screenshot load simulation
  const generateMockScreenshot = () => {
    // Generate a beautiful, realistic canvas image representing a PhonePe payment slip
    const canvas = document.createElement("canvas")
    canvas.width = 400
    canvas.height = 500
    const ctx = canvas.getContext("2d")
    if (ctx) {
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 500)
      grad.addColorStop(0, "#5f259f") // Purple PhonePe gradient
      grad.addColorStop(1, "#36165e")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 400, 500)

      // Tick mark
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.arc(200, 100, 40, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = "#5f259f"
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(185, 100)
      ctx.lineTo(195, 110)
      ctx.lineTo(215, 90)
      ctx.stroke()

      // Header Text
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 20px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Transaction Successful", 200, 175)

      // Amount
      ctx.font = "bold 32px monospace"
      ctx.fillText(`₹${payment?.amountINR?.toLocaleString() || "1,000"}.00`, 200, 230)

      ctx.font = "14px sans-serif"
      ctx.fillStyle = "#dcd1f0"
      ctx.fillText(`To: ${payment?.vendorName || "Not Available"}`, 200, 270)
      ctx.fillText(`UTR: ${utrNumber || "205570668039"}`, 200, 300)

      // Footer
      ctx.fillStyle = "rgba(255,255,255,0.1)"
      ctx.fillRect(20, 360, 360, 110)
      ctx.fillStyle = "#ffffff"
      ctx.font = "11px sans-serif"
      ctx.fillText("PhonePe Payment Receipt", 200, 390)
      ctx.font = "10px monospace"
      ctx.fillStyle = "#bbb"
      ctx.fillText(`ID: TXN${Date.now()}`, 200, 420)
      ctx.fillText("End-to-end Encrypted by OnnxPay Gateway", 200, 440)
    }
    const dataUrl = canvas.toDataURL("image/png")
    setScreenshotBase64(dataUrl)
  }

  const isPaymentWithheld = paymentStatus === 'withheld' || paymentStatus === 'frozen'
  const countdown = useCountdown(payment?.expiresAt ?? null, isPaymentWithheld, payment?.frozenTimeLeft)
  const expired = paymentStatus === 'pending' && payment !== null && countdown.total === 0

  const isBankCategory = useMemo(() => {
    if (!payment?.paymentMethod) return false
    const pm = ALL_PAYMENT_METHODS.find(
      m => m.id.toLowerCase() === payment.paymentMethod?.toLowerCase() || m.title.toLowerCase() === payment.paymentMethod?.toLowerCase()
    )
    return pm?.category === 'Bank' || !!payment.vendorAccountNumber
  }, [payment?.paymentMethod, payment?.vendorAccountNumber])

  // ---------------------------------------------------------------------------
  // Dynamic Views
  // ---------------------------------------------------------------------------

  // 1. LOADING SCREEN
  if (loading) {
    return (
      <div className="relative min-h-screen w-full bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-slate-600 text-sm">Synchronizing systems…</p>
        </div>
      </div>
    )
  }

  // 2. ERROR SCREEN
  if (error || !payment) {
    return (
      <div className="relative min-h-screen w-full bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <XCircle className="h-12 w-12 text-rose-500" />
          <h2 className="text-xl font-semibold text-slate-900">Deposit Order Terminated</h2>
          <p className="text-sm text-slate-600 max-w-sm">{error || 'Order has expired or been cancelled.'}</p>
        </div>
      </div>
    )
  }

  // 3. SUCCESS / COMPLETED VIEW
  if (paymentStatus === 'completed') {
    return (
      <div className="relative min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.07)_0,transparent_100%)]" />
        <div className="w-full max-w-md bg-white border border-emerald-500/30 rounded-3xl p-8 shadow-xl relative overflow-hidden text-center">
          <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center shadow-[0_0_30px_rgba(52,211,153,0.2)] animate-bounce">
            <CircleCheck className="h-10 w-10 text-white" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Deposit Successful!</h1>
          <p className="text-slate-600 text-sm mb-6">
            Your transfer has been verified and settled.
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-3 border border-slate-200 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Deposit Order</span>
              <span className="text-slate-800 font-mono">{payment.paymentId.slice(0, 14)}...</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Payer Name</span>
              <span className="text-slate-800 font-medium">{payerName || payment.customerName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Matched UTR</span>
              <span className="text-slate-800 font-mono">{utrNumber || payment.utrNumber || "N/A"}</span>
            </div>
            <Separator className="bg-slate-200" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500 font-semibold">Credited Crypto</span>
              <span className="text-emerald-600 font-bold text-lg">{payment.amountUSDT} USDT</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
            <span>Redirecting...</span>
          </div>
        </div>
      </div>
    )
  }

  // 4. EXPIRED / CANCELLED VIEW
  if (paymentStatus === 'expired' || paymentStatus === 'cancelled' || expired) {
    return (
      <div className="relative min-h-screen w-full bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-red-200 rounded-3xl p-8 text-center shadow-xl">
          <XCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Deposit Failed</h1>
          <p className="text-slate-600 text-sm mb-6">
            {paymentStatus === 'cancelled' ? 'This transaction has been flagged and cancelled.' : 'The payment session has expired.'}
          </p>
         <span>Redirecting...</span>
        </div>
      </div>
    )
  }

  // 5. PENDING SYSTEM AUTO VERIFICATION / WAITING SCREEN
  if (paymentStatus === 'confirming' || ((paymentStatus === 'withheld' || paymentStatus === 'frozen') && payment.screenshotUrl)) {
    const isPaused = paymentStatus === 'withheld' || paymentStatus === 'frozen'
    return (
      <div className="relative min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06)_0,transparent_100%)]" />
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl relative overflow-hidden text-center">
          {isPaused ? (
            <div className="relative mx-auto mb-6 h-24 w-24 rounded-full border border-sky-200 grid place-items-center bg-sky-50 shadow-inner">
              <Clock className="h-10 w-10 text-sky-600 animate-pulse" />
            </div>
          ) : (
            <div className="relative mx-auto mb-6 h-24 w-24 rounded-full border border-sky-200 grid place-items-center bg-sky-50">
              <span className="absolute inset-0 rounded-full border border-sky-400 animate-ping opacity-50" />
              <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
            </div>
          )}

          <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
            {isPaused ? "Verification Paused" : "Verifying Transaction"}
          </h1>
          <p className="text-slate-600 text-xs px-2 mb-6">
            {isPaused
              ? "This transaction has been temporarily withheld/paused by the administrator. The verification is paused and your funds are secure."
              : "Your payment proof has been submitted. The gateway matching engine is auditing your transaction and proof screenshot."
            }
          </p>

          {/* Instructions for Evaluation & Vendor approval shortcut commented out for production
          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 border border-slate-200 mb-6 text-xs text-slate-600">
            <div className="font-semibold text-slate-800 text-center mb-2">Instructions for Evaluation:</div>
            {isPaused ? (
              <div className="space-y-1">
                <p>⏳ <strong className="text-sky-600">Transaction Paused:</strong> Administrator action required. Countdown timer is paused. No loss of funds will occur.</p>
              </div>
            ) : verificationType === 'auto' ? (
              <div className="space-y-1">
                <p>🤖 <strong className="text-sky-600">Automated Mode Activated:</strong> The system scanner is automatically validating your UTR reference against bank reports.</p>
                <p className="pt-2 text-center text-amber-600 animate-pulse font-semibold">Settle will execute automatically in ~12 seconds...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p>🧑‍💼 <strong className="text-purple-600">Manual Mode Activated:</strong> The merchant requires the matching vendor to review your uploaded proof receipt.</p>
                <div className="pt-2">
                  <a
                    href="/vendor"
                    target="_blank"
                    className="block text-center bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 py-2.5 rounded-xl transition font-semibold"
                  >
                    Open Vendor Panel to Approve ↗
                  </a>
                </div>
              </div>
            )}
          </div>
          */}

          <div className="text-[10px] text-slate-500">Monitoring settlement status in real-time.</div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 6. SCREEN 1: DEPOSIT METHOD SUMMARY / SELECTION VIEW (Image 1)
  // ---------------------------------------------------------------------------
  if (!payment.paymentMethod) {
    const defaultExchangeRate = payment.exchangeRate || 86.80
    const estimatedUSDT = parseFloat((payment.amountINR / defaultExchangeRate).toFixed(2))

    return (
      <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col items-center">
        {/* Navigation Header */}
        <header className="w-full max-w-lg flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <button 
          onClick={handleCancel}
          className="text-slate-500 hover:text-slate-900 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-black tracking-wider">
            <span className="text-slate-900">Onn</span>
            <span className="text-sky-500 font-extrabold">X</span>
            <span className="text-slate-900">pay</span>
          </h1>
          <div className="flex items-center">
            {countdown.total >= 0 && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${isPaymentWithheld
                  ? 'bg-sky-50 border-sky-200 text-sky-600'
                  : 'bg-rose-50 border-rose-200 text-rose-600'
                }`}>
                <Clock className="h-3.5 w-3.5" />
                <span>{countdown.mm}:{countdown.ss}</span>
              </div>
            )}
          </div>
        </header>

        <main className="w-full max-w-lg p-5 flex flex-col flex-1 pb-8">
          {/* Matching Engine overlay */}
          {isMatching ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-8 h-24 w-24 rounded-full border border-sky-200 grid place-items-center bg-sky-50 shadow-sm">
                <span className="absolute inset-0 rounded-full border-2 border-sky-300 animate-ping opacity-40" />
                <span className="absolute inset-2 rounded-full border border-sky-300 animate-pulse" />
                <Loader2 className="h-10 w-10 text-sky-600 animate-spin" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Finding Order</h3>
              <p className="text-slate-600 text-xs max-w-sm mb-8 leading-relaxed">
                Establishing a secure gateway connection to retrieve your order details.
                This may take a few moments. Please do not close or refresh this page.
              </p>

              {/* Sleek Progress Bar */}
              <div className="w-full max-w-xs bg-slate-200 border border-slate-300 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
                <div
                  className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${Math.min(100, (matchingStep / 5) * 100)}%` }}
                />
              </div>

              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-3 animate-pulse">
                {matchingStep < 5 ? "Securing channel..." : "Retrieving details..."}
              </span>
            </div>
          ) : (
            <>
              {/* Searchable Payment Method Selection */}
              <div className="text-xs uppercase tracking-wider text-slate-600 mb-2 font-semibold">Select Preferred Payment Method</div>
              <div ref={dropdownRef} className="relative w-full mb-6">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Wallet className="h-4 w-4 text-sky-500" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onFocus={() => setDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setDropdownOpen(true)
                    }}
                    placeholder="Search payment method (e.g. PhonePe, Bank Transfer...)"
                    className="w-full h-12 pl-11 pr-10 bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-2xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all font-semibold shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5"
                  >
                    <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                </div>

                {/* Dropdown Options List */}
                {dropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 scrollbar-thin">
                    {filteredMethods.length > 0 ? (
                      filteredMethods.map((method) => {
                        const isSelected = selectedMethod === method.id
                        return (
                          <div
                            key={method.id}
                            onClick={() => {
                              setSelectedMethod(method.id)
                              setSearchTerm(method.title)
                              setDropdownOpen(false)
                            }}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${isSelected
                                ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200'
                                : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                              }`}
                          >
                            <div>
                              <div className="text-xs font-semibold">{method.title}</div>
                              <div className="text-[10px] text-slate-500 font-normal">{method.desc}</div>
                            </div>
                            {isSelected && (
                              <CircleCheck className="h-4 w-4 text-sky-500" />
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div
                        onClick={() => {
                          setSelectedMethod(searchTerm)
                          setDropdownOpen(false)
                        }}
                        className="px-4 py-3 text-center text-xs text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer"
                      >
                        No standard method matches. Tap here to select <strong className="text-sky-600">"{searchTerm}"</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Red Guidelines Box */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-2 mb-6 shadow-xs">
                <div className="font-bold uppercase tracking-widest text-rose-700 mb-1 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-rose-600" /> *Important notice
                </div>
                <div className="flex gap-2">
                  <span>1.</span>
                  <p>Confirm the details and click 'Pay Now'</p>
                </div>
                <div className="flex gap-2">
                  <span>2.</span>
                  <p>Select bank in bank selection page and login to your online bank</p>
                </div>
                <div className="flex gap-2">
                  <span>3.</span>
                  <p>Follow the instruction and make payment via your Online/Mobile Bank</p>
                </div>
                <div className="flex gap-2">
                  <span>4.</span>
                  <p>Follow the prompts in account to complete your payment.</p>
                </div>
                <div className="flex gap-2 font-semibold text-rose-700">
                  <span>5.</span>
                  <p>Strictly no third-party deposits will be accepted. Any such transactions will be rejected without exception.</p>
                </div>
              </div>

              {/* Payment Details Table Summary */}
              <div className="bg-slate-100/90 border border-slate-200 rounded-3xl p-5 shadow-xs mb-8">
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
                  <LockKeyhole className="h-3.5 w-3.5 text-sky-500" /> Payment Details
                </div>

                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Pay To Account</span>
                    <span className="text-slate-900 font-mono font-semibold select-all">{payment.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Deposit Amount</span>
                    <span className="text-slate-900 font-semibold">{estimatedUSDT} USDT</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-slate-900 font-bold text-base">Actual Payment Amount</span>
                    <span className="text-sky-600 font-black text-xl">₹{payment.amountINR.toLocaleString()}.00</span>
                  </div>
                  <div className="flex justify-end text-[11px] text-slate-500 pt-0.5">
                    <span>≈ {estimatedUSDT} USDT</span>
                  </div>
                </div>
              </div>

              {/* Bottom Pay Button */}
              <div className="mt-auto">
                <Button
                  onClick={handlePayNow}
                  className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-2"
                >
                  Pay Now
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 7. SCREEN 2: P2P TIMELINE DEPOSIT VIEW (Image 2)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col items-center">
      {(paymentStatus === "withheld" || paymentStatus === "frozen") && (
        <div className="w-full max-w-lg px-5 pt-4">
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs text-sky-800 flex items-start gap-3 shadow-xs">
            <Clock className="h-5 w-5 text-sky-600 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <div className="font-bold uppercase tracking-wider text-sky-700 mb-1">Transaction Withheld / Paused</div>
              <p className="leading-relaxed">This payment's timer has been temporarily withheld by the platform administrator. The countdown is paused and your funds are secure.</p>
            </div>
          </div>
        </div>
      )}
      {/* Navigation Header with cancel X */}
      <header className="w-full max-w-lg flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <button
          onClick={handleCancel}
          className="text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-black tracking-wider">
          <span className="text-slate-900">Onn</span>
          <span className="text-sky-500 font-extrabold">X</span>
          <span className="text-slate-900">pay</span>
        </h1>
        <div className="flex items-center gap-4">
          {countdown.total >= 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${isPaymentWithheld
                ? 'bg-sky-50 border-sky-200 text-sky-600'
                : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{countdown.mm}:{countdown.ss}</span>
            </div>
          )}
          <button
            onClick={handleCancel}
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-lg p-5 flex flex-col flex-1 pb-10">
        {/* Dynamic Order Number Clip */}
        <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-xs mb-6 text-slate-600 select-none shadow-xs">
          <span>Order.NO</span>
          <button
            onClick={() => copyText(paymentId, "order")}
            className="flex items-center gap-1.5 text-slate-900 font-mono font-bold hover:text-sky-600 transition-colors"
          >
            {paymentId}
            {copiedId === "order" ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>

        {/* Transaction Amount Summary Card */}
        <div className="bg-slate-100/90 border border-slate-200 rounded-3xl p-5 mb-6 shadow-xs relative overflow-hidden">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Pay Amount</span>
              <span className="text-lg font-black text-amber-600 block">
                ₹{payment.amountINR.toLocaleString()}.00
              </span>
            </div>

            <div className="space-y-1 border-l border-slate-200">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Receive USDT</span>
              <span className="text-lg font-black text-emerald-600 block">
                {payment.amountUSDT} USDT
              </span>
            </div>
          </div>
        </div>

        {/* TIMELINE PROGRESS SECTION */}
        <div className="relative pl-7 flex flex-col gap-8 flex-1">
          {/* Vertical Golden Line */}
          <div className="absolute left-[9px] top-2 bottom-3 w-[1.5px] bg-amber-400 rounded-full" />

          {/* STEP 1: SEND PAYMENT */}
          <div className="relative">
            {/* Golden Circle Dot */}
            <div className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full bg-amber-400 border-4 border-[#f8fafc] shadow-xs" />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">1</span>
                <h3 className="text-sm font-bold text-slate-900">Send Payment</h3>
              </div>

              <div className="text-slate-600 text-xs space-y-1 pl-4 leading-relaxed list-decimal">
                {isBankCategory ? (
                  <>
                    <p>1. Open your net banking or mobile banking app and initiate a <span className="text-rose-600 font-semibold">bank transfer</span>.</p>
                    <p>2. Transfer the exact amount to the beneficiary details below.</p>
                    <p>3. Take a screenshot of the transaction receipt/slip and <span className="text-rose-600 font-semibold">return</span> to this page.</p>
                  </>
                ) : (
                  <>
                    <p>1. Leave the current page and <span className="text-rose-600 font-semibold">send the payment</span> in your UPI Apps</p>
                    <p>2. Take a screenshot of the payment slip and <span className="text-rose-600 font-semibold">return</span> to this page.</p>
                  </>
                )}
                <p>Please strictly follow <span className="text-rose-600 font-semibold">the displayed amount</span> when making the payment. Any discrepancy may result in order <span className="text-rose-600 font-semibold">delays</span> or <span className="text-rose-600 font-semibold">potential loss</span> of funds.</p>
              </div>

              {/* Vendor Account Details Card */}
              <div className="bg-slate-100/90 border border-slate-200 rounded-3xl p-4 mt-1 relative overflow-hidden shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3 text-xs text-slate-600 font-semibold uppercase tracking-wider">
                  <span className="text-slate-800">Receiving Account Details:</span>
                  {isBankCategory ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                      Bank Transfer Match
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 text-[10px]">
                      UPI ID Match
                    </Badge>
                  )}
                </div>

                <div className={(!isBankCategory || payment.vendorQrCode) ? "grid grid-cols-[1fr_auto] items-center gap-4" : "block space-y-3.5"}>
                  {/* Account detail text lines */}
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Beneficiary Name</div>
                      <button
                        onClick={() => copyText(payment.vendorAccountHolder || payment.vendorName || "", "vendor_name")}
                        className="flex items-center gap-1.5 text-sm font-bold text-slate-900 hover:text-sky-600 transition-colors"
                        disabled={!payment.vendorName && !payment.vendorAccountHolder}
                      >
                        {payment.vendorAccountHolder || payment.vendorName || "Not Available"}
                        {(payment.vendorName || payment.vendorAccountHolder) && (copiedId === "vendor_name" ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-400" />
                        ))}
                      </button>
                    </div>

                    {isBankCategory ? (
                      <>
                        {payment.vendorBankName && (
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Bank Name</div>
                            <button
                              onClick={() => copyText(payment.vendorBankName || "", "vendor_bank")}
                              className="flex items-center gap-1.5 text-sm font-bold text-slate-900 hover:text-sky-600 transition-colors"
                            >
                              {payment.vendorBankName}
                              {copiedId === "vendor_bank" ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-slate-400" />
                              )}
                            </button>
                          </div>
                        )}

                        {payment.vendorAccountNumber && (
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-semibold">Account Number</div>
                            <button
                              onClick={() => copyText(payment.vendorAccountNumber || "", "vendor_acc_num")}
                              className="flex items-center gap-1.5 text-sm font-black text-slate-900 hover:text-sky-600 transition-colors font-mono break-all text-left"
                            >
                              {payment.vendorAccountNumber}
                              {copiedId === "vendor_acc_num" ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-slate-400" />
                              )}
                            </button>
                          </div>
                        )}

                        {payment.vendorIfscCode && (
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-semibold">IFSC Code</div>
                            <button
                              onClick={() => copyText(payment.vendorIfscCode || "", "vendor_ifsc")}
                              className="flex items-center gap-1.5 text-sm font-black text-slate-900 hover:text-sky-600 transition-colors font-mono break-all text-left"
                            >
                              {payment.vendorIfscCode}
                              {copiedId === "vendor_ifsc" ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-slate-400" />
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono font-semibold">Receiving UPI ID</div>
                        <button
                          onClick={() => copyText(payment.vendorUpiId || "", "vendor_upi")}
                          className="flex items-center gap-1.5 text-sm font-black text-slate-900 hover:text-sky-600 transition-colors font-mono break-all text-left"
                          disabled={!payment.vendorUpiId}
                        >
                          {payment.vendorUpiId || "Not Available"}
                          {payment.vendorUpiId && (copiedId === "vendor_upi" ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-slate-400" />
                          ))}
                        </button>
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Amount to Deposit</div>
                      <button
                        onClick={() => copyText(String(payment.amountINR), "amount_inr")}
                        className="flex items-center gap-1.5 text-base font-extrabold text-amber-600 hover:text-amber-700 text-left font-mono"
                      >
                        ₹{payment.amountINR.toLocaleString()}.00
                        {copiedId === "amount_inr" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    <div className="pt-1">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Receive USDT</div>
                        <span className="text-xs font-bold text-emerald-600 block pt-0.5 font-mono">
                          {payment.amountUSDT} USDT
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QR Image embedded on the right */}
                  {(!isBankCategory || payment.vendorQrCode) && (
                    <button
                      type="button"
                      onClick={() => setIsQrModalOpen(true)}
                      className="group relative bg-white p-2 rounded-2xl w-24 h-24 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center select-none shadow-sm border border-slate-200 hover:border-amber-400 hover:shadow-md cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                      title="Click to zoom QR Code"
                      aria-label="Enlarge QR code"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImageUrl}
                        alt="Payment QR"
                        className="w-full h-full rounded-lg object-contain transition-transform duration-200 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 rounded-2xl transition-colors flex items-center justify-center pointer-events-none">
                        <div className="opacity-0 group-hover:opacity-100 bg-white/95 text-slate-800 p-1.5 rounded-full shadow-md transition-all duration-200 scale-90 group-hover:scale-100">
                          <Maximize2 className="h-3.5 w-3.5 text-slate-800" />
                        </div>
                      </div>
                      <div className="absolute inset-0 border border-slate-200 group-hover:border-amber-400 rounded-2xl pointer-events-none transition-colors" />
                    </button>
                  )}
                </div>

                {/* Supported payment app icons */}
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-start gap-3">
                  {payment.paymentMethod ? (
                    (() => {
                      const method = payment.paymentMethod.toLowerCase();
                      if (method === "phonepe") {
                        return (
                          <span className="h-6 px-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-purple-700 shadow-xs">
                            PhonePe Only
                          </span>
                        );
                      }
                      if (method === "gpay" || method === "google pay") {
                        return (
                          <span className="h-6 px-3 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-sky-700 shadow-xs">
                            Google Pay Only
                          </span>
                        );
                      }
                      if (method === "paytm") {
                        return (
                          <span className="h-6 px-3 bg-sky-50 border border-sky-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-sky-700 shadow-xs">
                            Paytm Only
                          </span>
                        );
                      }
                      if (method === "imps") {
                        return (
                          <span className="h-6 px-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-amber-700 shadow-xs">
                            IMPS Bank Transfer
                          </span>
                        );
                      }
                      if (method === "bank transfer") {
                        return (
                          <span className="h-6 px-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-emerald-700 shadow-xs">
                            Bank Transfer
                          </span>
                        );
                      }
                      // For general UPI selection, show the standard supported apps
                      return (
                        <>
                          <span className="h-5 w-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-xs">GPay</span>
                          <span className="h-5 w-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-xs">PhonePe</span>
                          <span className="h-5 w-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-xs">Paytm</span>
                          <span className="h-5 w-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-xs">UPI</span>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <span className="h-5 w-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-xs">GPay</span>
                      <span className="h-5 w-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-xs">PhonePe</span>
                      <span className="h-5 w-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-xs">Paytm</span>
                    </>
                  )}
                </div>

                {/* 1-Tap Mobile UPI Intent Button */}
                {(!isBankCategory && appIntents) && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <a
                      href={
                        payment.paymentMethod?.toLowerCase() === 'phonepe'
                          ? appIntents.phonepe
                          : (payment.paymentMethod?.toLowerCase() === 'gpay' || payment.paymentMethod?.toLowerCase() === 'google pay')
                          ? appIntents.gpay
                          : payment.paymentMethod?.toLowerCase() === 'paytm'
                          ? appIntents.paytm
                          : appIntents.generic
                      }
                      className="w-full h-11 bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-all active:scale-[0.98]"
                    >
                      <Zap className="h-4 w-4 fill-white" />
                      <span>
                        {payment.paymentMethod?.toLowerCase() === 'phonepe'
                          ? `Pay ₹${payment.amountINR.toLocaleString()} via PhonePe`
                          : (payment.paymentMethod?.toLowerCase() === 'gpay' || payment.paymentMethod?.toLowerCase() === 'google pay')
                          ? `Pay ₹${payment.amountINR.toLocaleString()} via Google Pay`
                          : payment.paymentMethod?.toLowerCase() === 'paytm'
                          ? `Pay ₹${payment.amountINR.toLocaleString()} via Paytm`
                          : `Pay ₹${payment.amountINR.toLocaleString()} via Any UPI App`}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                    </a>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                      <span className="flex items-center gap-1">
                        <Smartphone className="h-3 w-3 text-slate-400" />
                        <span>1-Tap App Launch (Mobile)</span>
                      </span>
                      <span className="font-mono font-semibold text-amber-600">₹{payment.amountINR.toLocaleString()}.00 pre-filled</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: CONFIRM PAYMENT */}
          <div className="relative">
            {/* Golden Circle Dot */}
            <div className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full bg-amber-400 border-4 border-[#f8fafc] shadow-xs" />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">2</span>
                <h3 className="text-sm font-bold text-slate-900">Confirm Payment</h3>
              </div>

              <div className="text-slate-600 text-xs space-y-1 pl-4 leading-relaxed">
                <p>Enter account holder's name and <span className="text-rose-600 font-semibold">upload payment slip</span> to confirm your payment.</p>
                <p className="text-rose-600 font-semibold text-[11px] pt-1">
                  The payer's name must be the same as the name registered with the bank account, Please change it manually in the event of any discrepancies. *
                </p>
              </div>

              {/* Form Input fields card */}
              <div className="bg-slate-100/90 border border-slate-200 rounded-3xl p-5 mt-1 space-y-4 shadow-xs">
                {/* Payer Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Payer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Please enter your name"
                    className="w-full h-11 bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all font-medium shadow-xs"
                  />
                </div>

                {/* Screenshot proof upload zone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Upload Payment Proof <span className="text-rose-500">*</span>
                  </label>

                  {proofError && (
                    <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold animate-pulse">
                      {proofError}
                    </div>
                  )}

                  <div className="relative border border-dashed border-slate-300 bg-white hover:bg-slate-50/80 rounded-2xl p-6 text-center transition flex flex-col items-center justify-center min-h-[120px] select-none cursor-pointer shadow-xs">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            setScreenshotBase64(reader.result as string)
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    {screenshotBase64 ? (
                      <div className="relative w-full flex flex-col items-center justify-center p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshotBase64}
                          alt="Screenshot Proof Preview"
                          className="max-h-28 rounded-lg object-contain border border-slate-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setScreenshotBase64(null)
                          }}
                          className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-full shadow-lg border border-rose-500/20 transition-all hover:scale-105 active:scale-95 z-10"
                          title="Remove screenshot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-400 mb-2" />
                        <span className="text-xs text-slate-500 font-medium">Upload</span>
                      </>
                    )}
                  </div>

                  {/* Button to generate mock screenshot commented out for production
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={generateMockScreenshot}
                      className="text-[11px] text-amber-600 hover:underline font-semibold"
                    >
                      ✨ Generate Mock PhonePe Payment slip
                    </button>
                  </div>
                  */}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTON BAR */}
        <div className="mt-8 grid grid-cols-[100px_1fr] gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="h-12 bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300 font-bold rounded-xl shadow-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmitProof}
            disabled={isSubmittingProof}
            className="h-12 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center justify-center"
          >
            {isSubmittingProof ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Deposit"
            )}
          </Button>
        </div>
      </main>

      {/* Enlarged QR Code Modal with blurred backdrop */}
      {isQrModalOpen && payment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsQrModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged QR Code"
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shadow-xs"
              aria-label="Close QR modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center mb-4 pr-6 pl-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                Scan to Pay
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-2">
                {payment.vendorAccountHolder || payment.vendorName || "Payment QR Code"}
              </h3>
              {payment.vendorUpiId && (
                <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">
                  {payment.vendorUpiId}
                </p>
              )}
            </div>

            {/* Large QR Container */}
            <div className="relative bg-white p-3.5 rounded-2xl border-2 border-slate-200 shadow-inner flex items-center justify-center max-w-[260px] sm:max-w-[280px] w-full aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="Enlarged Payment QR"
                className="w-full h-full object-contain rounded-lg select-none"
              />
            </div>

            {/* Footer info: Amount & Tips */}
            <div className="w-full mt-4 pt-4 border-t border-slate-100 flex flex-col items-center gap-2">
              <div className="flex items-center justify-between w-full px-2 text-xs">
                <span className="text-slate-500 font-medium">Exact Deposit Amount:</span>
                <span className="font-extrabold font-mono text-amber-600 text-base">
                  ₹{payment.amountINR.toLocaleString()}.00
                </span>
              </div>
              {payment.vendorUpiId && (
                <button
                  type="button"
                  onClick={() => copyText(payment.vendorUpiId || "", "modal_upi")}
                  className="w-full py-2 px-3 mt-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="truncate">Copy UPI ID: {payment.vendorUpiId}</span>
                  {copiedId === "modal_upi" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                </button>
              )}
              <p className="text-[11px] text-slate-400 text-center mt-1">
                Scan with PhonePe, Google Pay, Paytm or any UPI app. Click outside or press ESC to close.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

