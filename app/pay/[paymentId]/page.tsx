'use client'

import { use, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Copy, Check, Shield, Clock, Wallet, Loader2, ArrowRight,
  CircleCheck, CircleDot, Circle, Zap, QrCode, Info, LockKeyhole,
  PartyPopper, XCircle, RefreshCw, ChevronLeft, Headphones, X, Upload
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
  { id: 'Google Pay', title: 'Google Pay', desc: 'Instant transfer via Google Pay', category: 'UPI' },
  { id: 'Paytm', title: 'Paytm', desc: 'Instant transfer via Paytm UPI', category: 'UPI' },
  { id: 'UPI', title: 'UPI ID / VPA', desc: 'Any standard UPI application', category: 'UPI' },
  { id: 'BHIM UPI', title: 'BHIM UPI', desc: 'Government UPI app transfer', category: 'UPI' },
  { id: 'WhatsApp Pay', title: 'WhatsApp Pay', desc: 'Transfer via WhatsApp Pay', category: 'UPI' },
  { id: 'IMPS', title: 'IMPS', desc: 'Immediate Payment Service (Bank Transfer)', category: 'Bank' },
  { id: 'NEFT', title: 'NEFT', desc: 'National Electronic Funds Transfer', category: 'Bank' },
  { id: 'RTGS', title: 'RTGS', desc: 'Real Time Gross Settlement', category: 'Bank' },
  { id: 'State Bank of India', title: 'State Bank of India (SBI)', desc: 'SBI Net Banking / Transfer', category: 'Bank' },
  { id: 'HDFC Bank', title: 'HDFC Bank', desc: 'HDFC Net Banking / Transfer', category: 'Bank' },
  { id: 'ICICI Bank', title: 'ICICI Bank', desc: 'ICICI Net Banking / Transfer', category: 'Bank' },
  { id: 'Axis Bank', title: 'Axis Bank', desc: 'Axis Net Banking / Transfer', category: 'Bank' },
  { id: 'Kotak Mahindra Bank', title: 'Kotak Mahindra Bank', desc: 'Kotak Net Banking / Transfer', category: 'Bank' },
  { id: 'IndusInd Bank', title: 'IndusInd Bank', desc: 'IndusInd Net Banking / Transfer', category: 'Bank' },
  { id: 'Yes Bank', title: 'Yes Bank', desc: 'Yes Net Banking / Transfer', category: 'Bank' },
  { id: 'Punjab National Bank', title: 'Punjab National Bank (PNB)', desc: 'PNB Net Banking / Transfer', category: 'Bank' },
  { id: 'Bank of Baroda', title: 'Bank of Baroda (BoB)', desc: 'BoB Net Banking / Transfer', category: 'Bank' },
  { id: 'Union Bank of India', title: 'Union Bank of India', desc: 'Union Net Banking / Transfer', category: 'Bank' },
  { id: 'Canara Bank', title: 'Canara Bank', desc: 'Canara Net Banking / Transfer', category: 'Bank' },
  { id: 'Federal Bank', title: 'Federal Bank', desc: 'Federal Net Banking / Transfer', category: 'Bank' },
  { id: 'IDFC First Bank', title: 'IDFC First Bank', desc: 'IDFC Net Banking / Transfer', category: 'Bank' }
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
  const eventSourceRef = useRef<EventSource | null>(null)

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

  // Redirect on completion
  useEffect(() => {
    if (!payment) return
    const finalStatuses = ['completed', 'expired', 'cancelled']
    const isFinal = finalStatuses.includes(paymentStatus)

    if (!isFinal) return

    const timer = setTimeout(() => {
      if (payment.callbackUrl) {
        console.log(`[REDIRECT] Redirecting to: ${payment.callbackUrl}`)
        window.location.href = payment.callbackUrl
      }
    }, 4000)

    return () => clearTimeout(timer)
  }, [paymentStatus, payment])

  // SSE watcher – listen for payment confirmation
  useEffect(() => {
    if (!paymentId) return

    const es = new EventSource(`/api/payment/${paymentId}/status`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.status === 'completed') {
          setPaymentStatus('completed')
          if (data.txHash) setTxHash(data.txHash)
          es.close()
        } else if (data.status === 'expired') {
          setPaymentStatus('expired')
          es.close()
        } else if (data.status === 'confirming') {
          setPaymentStatus('confirming')
          fetchPaymentRef.current()
        } else if (data.status === 'cancelled') {
          setPaymentStatus('cancelled')
          es.close()
        } else if (data.status === 'withheld') {
          setPaymentStatus('withheld')
          if (data.timeLeft !== undefined) {
            setPayment(prev => prev ? { ...prev, status: 'withheld', frozenTimeLeft: data.timeLeft } : null)
          }
        } else if (data.status === 'pending') {
          setPaymentStatus('pending')
          fetchPaymentRef.current()
        }
      } catch (err) {
        console.error("SSE parse error:", err)
      }
    }

    es.onerror = () => {
      // Reconnect handled automatically by browser
    }

    return () => {
      es.close()
    }
  }, [paymentId])

  // Copy to clipboard helper
  const copyText = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    }).catch(() => {})
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

  const isPaymentWithheld = paymentStatus === 'withheld'
  const countdown = useCountdown(payment?.expiresAt ?? null, isPaymentWithheld, payment?.frozenTimeLeft)
  const expired = paymentStatus !== 'withheld' && payment !== null && countdown.total === 0

  // ---------------------------------------------------------------------------
  // Dynamic Views
  // ---------------------------------------------------------------------------
  
  // 1. LOADING SCREEN
  if (loading) {
    return (
      <div className="relative min-h-screen w-full bg-[#0d0d13] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-slate-400 text-sm">Synchronizing systems…</p>
        </div>
      </div>
    )
  }

  // 2. ERROR SCREEN
  if (error || !payment) {
    return (
      <div className="relative min-h-screen w-full bg-[#0d0d13] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <XCircle className="h-12 w-12 text-rose-400" />
          <h2 className="text-xl font-semibold text-slate-100">Deposit Order Terminated</h2>
          <p className="text-sm text-slate-400 max-w-sm">{error || 'Order has expired or been cancelled.'}</p>
        </div>
      </div>
    )
  }

  // 3. SUCCESS / COMPLETED VIEW
  if (paymentStatus === 'completed') {
    return (
      <div className="relative min-h-screen w-full bg-transparent text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.07)_0,transparent_100%)]" />
        <div className="w-full max-w-md bg-[#050a14] border border-emerald-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center shadow-[0_0_30px_rgba(52,211,153,0.3)] animate-bounce">
            <CircleCheck className="h-10 w-10 text-zinc-950" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Deposit Successful!</h1>
          <p className="text-slate-400 text-sm mb-6">
            Your transfer has been verified and settled.
          </p>

          <div className="bg-[#02050c] rounded-2xl p-4 text-left space-y-3 border border-[#0f2744] mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Deposit Order</span>
              <span className="text-zinc-300 font-mono">{payment.paymentId.slice(0, 14)}...</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Payer Name</span>
              <span className="text-zinc-300 font-medium">{payerName || payment.customerName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Matched UTR</span>
              <span className="text-zinc-300 font-mono">{utrNumber || payment.utrNumber || "N/A"}</span>
            </div>
            <Separator className="bg-[#0f2744]" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-500 font-semibold">Credited Crypto</span>
              <span className="text-emerald-400 font-bold text-lg">{payment.amountUSDT} USDT</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
            <span>Firing Payment Webhook & Redirecting...</span>
          </div>
        </div>
      </div>
    )
  }

  // 4. EXPIRED / CANCELLED VIEW
  if (paymentStatus === 'expired' || paymentStatus === 'cancelled' || expired) {
    return (
      <div className="relative min-h-screen w-full bg-transparent flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#050a14] border border-red-500/30 rounded-3xl p-8 text-center shadow-xl">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Deposit Failed</h1>
          <p className="text-slate-400 text-sm mb-6">
            {paymentStatus === 'cancelled' ? 'This transaction has been flagged and cancelled.' : 'The payment session has expired.'}
          </p>
          {payment.cancelUrl && (
            <a href={window.location.origin}>
              <Button variant="outline" className="h-11 border-[#0f2744] bg-[#050a14] text-zinc-200 hover:bg-[#0f2744]/40 hover:text-white">
                Return to Merchant
              </Button>
            </a>
          )}
        </div>
      </div>
    )
  }

  // 5. PENDING SYSTEM AUTO VERIFICATION / WAITING SCREEN
  if (paymentStatus === 'confirming') {
    return (
      <div className="relative min-h-screen w-full bg-transparent text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06)_0,transparent_100%)]" />
        <div className="w-full max-w-md bg-[#050a14] border border-blue-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="relative mx-auto mb-6 h-24 w-24 rounded-full border border-blue-500/30 grid place-items-center bg-blue-500/5">
            <span className="absolute inset-0 rounded-full border border-blue-500/40 animate-ping opacity-70" />
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white mb-2">Verifying Transaction</h1>
          <p className="text-slate-400 text-xs px-2 mb-6">
            Your payment proof has been submitted. The gateway matching engine is auditing your transaction and proof screenshot.
          </p>

          <div className="bg-[#02050c] rounded-2xl p-4 text-left space-y-2 border border-[#0f2744] mb-6 text-xs text-slate-400">
            <div className="font-semibold text-slate-300 text-center mb-2">Instructions for Evaluation:</div>
            {verificationType === 'auto' ? (
              <div className="space-y-1">
                <p>🤖 <strong className="text-blue-400">Automated Mode Activated:</strong> The system scanner is automatically validating your UTR reference against bank reports.</p>
                <p className="pt-2 text-center text-amber-400 animate-pulse font-semibold">Settle will execute automatically in ~12 seconds...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p>🧑‍💼 <strong className="text-purple-400">Manual Mode Activated:</strong> The merchant requires the matching vendor to review your uploaded proof receipt.</p>
                <div className="pt-2">
                  <a
                    href="/vendor"
                    target="_blank"
                    className="block text-center bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 py-2.5 rounded-xl transition font-semibold"
                  >
                    Open Vendor Panel to Approve ↗
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-zinc-500">Monitoring bank settlement status in real-time.</div>
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
      <div className="min-h-screen w-full bg-transparent text-slate-100 flex flex-col items-center">
        {/* Navigation Header */}
        <header className="w-full max-w-lg flex items-center justify-between px-5 py-4 border-b border-[#0f2744]">
          <button className="text-slate-400 hover:text-slate-200">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-black tracking-wider">
            <span className="text-slate-100">Onn</span>
            <span className="text-blue-500 font-extrabold">X</span>
            <span className="text-slate-100">pay</span>
          </h1>
          <div className="w-5" /> {/* Spacer to keep header title centered */}
        </header>

        <main className="w-full max-w-lg p-5 flex flex-col flex-1 pb-8">
          {/* Matching Engine overlay */}
          {isMatching ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-8 h-24 w-24 rounded-full border border-blue-500/20 grid place-items-center bg-blue-500/5 shadow-[0_0_50px_rgba(59,130,246,0.1)]">
                <span className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping opacity-40" />
                <span className="absolute inset-2 rounded-full border border-blue-500/30 animate-pulse" />
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              </div>
              <h3 className="text-xl font-black text-white mb-2 tracking-tight">Finding Order</h3>
              <p className="text-slate-400 text-xs max-w-sm mb-8 leading-relaxed">
                Establishing a secure gateway connection to retrieve your order details.
                This may take a few moments. Please do not close or refresh this page.
              </p>
              
              {/* Sleek Progress Bar */}
              <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800/80 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
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
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2 font-medium">Select Preferred Payment Method</div>
              <div ref={dropdownRef} className="relative w-full mb-6">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Wallet className="h-4 w-4 text-blue-500" />
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
                    className="w-full h-12 pl-11 pr-10 bg-[#050a14] border border-[#0f2744] text-white placeholder-slate-500 rounded-2xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-semibold"
                  />
                  <button 
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1.5"
                  >
                    <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-90' : '-rotate-90'}`} />
                  </button>
                </div>

                {/* Dropdown Options List */}
                {dropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-[#050a14] border border-[#0f2744] rounded-2xl shadow-2xl z-50 p-2 space-y-1 scrollbar-thin">
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
                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                              isSelected 
                                ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-500/20' 
                                : 'hover:bg-zinc-900 text-slate-300 hover:text-white border border-transparent'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-semibold">{method.title}</div>
                              <div className="text-[10px] text-slate-500 font-normal">{method.desc}</div>
                            </div>
                            {isSelected && (
                              <CircleCheck className="h-4 w-4 text-blue-500" />
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
                        className="px-4 py-3 text-center text-xs text-slate-400 hover:bg-zinc-900 rounded-xl cursor-pointer"
                      >
                        No standard method matches. Tap here to select <strong className="text-blue-400">"{searchTerm}"</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Red Guidelines Box */}
              <div className="bg-[#2c1212]/80 border border-[#4f1a1a]/50 rounded-2xl p-4 text-xs text-[#fca5a5] space-y-2 mb-6">
                <div className="font-bold uppercase tracking-widest text-[#f87171] mb-1 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> *Important notice
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
                <div className="flex gap-2 font-semibold text-[#f87171]">
                  <span>5.</span>
                  <p>Strictly no third-party deposits will be accepted. Any such transactions will be rejected without exception.</p>
                </div>
              </div>

              {/* Payment Details Table Summary */}
              <div className="bg-[#050a14] border border-[#0f2744] rounded-3xl p-5 shadow-lg mb-8">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-4 pb-2 border-b border-[#0f2744]">
                  <LockKeyhole className="h-3.5 w-3.5 text-blue-400" /> Payment Details
                </div>
                
                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Pay To Account</span>
                    <span className="text-slate-300 font-mono select-all">{payment.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Deposit Amount</span>
                    <span className="text-slate-300 font-semibold">{estimatedUSDT} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Voucher Amount</span>
                    <span className="text-slate-500">—</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-[#0f2744]">
                    <span className="text-slate-500 font-medium">Voucher Applied</span>
                    <span className="text-slate-500">—</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-slate-300 font-bold text-base">Actual Payment Amount</span>
                    <span className="text-blue-400 font-black text-xl">₹{payment.amountINR.toLocaleString()}.00</span>
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
                  className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(59,130,246,0.3)] transition-all flex items-center justify-center gap-2"
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
    <div className="min-h-screen w-full bg-transparent text-slate-100 flex flex-col items-center">
      {paymentStatus === "withheld" && (
        <div className="w-full max-w-lg px-5 pt-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-300 flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <div className="font-bold uppercase tracking-wider text-blue-400 mb-1">Transaction Withheld / Paused</div>
              <p className="leading-relaxed">This payment's timer has been temporarily withheld by the platform administrator. The countdown is paused and your funds are secure.</p>
            </div>
          </div>
        </div>
      )}
      {/* Navigation Header with cancel X */}
      <header className="w-full max-w-lg flex items-center justify-between px-5 py-4 border-b border-[#0f2744]">
        <button
          onClick={handleCancel}
          className="text-slate-400 hover:text-slate-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-black tracking-wider text-white">
          <span className="text-slate-100">Onn</span>
          <span className="text-blue-500 font-extrabold">X</span>
          <span className="text-slate-100">pay</span>
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-lg p-5 flex flex-col flex-1 pb-10">
        {/* Dynamic Order Number Clip */}
        <div className="flex items-center justify-between bg-[#02050c]/60 border border-[#0f2744] rounded-xl px-4 py-2 text-xs mb-6 text-slate-400 select-none">
          <span>Order.NO</span>
          <button
            onClick={() => copyText(paymentId, "order")}
            className="flex items-center gap-1.5 text-zinc-300 font-mono font-bold hover:text-white"
          >
            {paymentId}
            {copiedId === "order" ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-slate-500" />
            )}
          </button>
        </div>

        {/* Transaction Amount Summary Card */}
        <div className="bg-[#050a14] border border-[#0f2744] rounded-3xl p-5 mb-6 shadow-lg relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-amber-500/5 blur-2xl" />
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Pay Amount</span>
              <span className="text-lg font-black text-[#fbbf24] block">
                ₹{payment.amountINR.toLocaleString()}.00
              </span>
            </div>
            
            <div className="space-y-1 border-l border-[#0f2744]">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Receive USDT</span>
              <span className="text-lg font-black text-emerald-400 block">
                {payment.amountUSDT} USDT
              </span>
            </div>
          </div>
        </div>

        {/* TIMELINE PROGRESS SECTION */}
        <div className="relative pl-7 flex flex-col gap-8 flex-1">
          {/* Vertical Golden Line */}
          <div className="absolute left-[9px] top-2 bottom-3 w-[1.5px] bg-[#fbbf24] rounded-full" />

          {/* STEP 1: SEND PAYMENT */}
          <div className="relative">
            {/* Golden Circle Dot */}
            <div className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full bg-[#fbbf24] border-4 border-[#0d0d12] shadow-[0_0_8px_rgba(251,191,36,0.6)]" />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">1</span>
                <h3 className="text-sm font-bold text-white">Send Payment</h3>
              </div>

              <div className="text-slate-400 text-xs space-y-1 pl-4 leading-relaxed list-decimal">
                <p>1. Leave the current page and <span className="text-[#f43f5e] font-semibold">send the payment</span> in your UPI Apps</p>
                <p>2. Take a screenshot of the payment slip and <span className="text-[#f43f5e] font-semibold">return</span> to this page.</p>
                <p>3. Please strictly follow <span className="text-[#f43f5e] font-semibold">the displayed amount</span> when making the payment. Any discrepancy may result in order <span className="text-[#f43f5e] font-semibold">delays</span> or <span className="text-[#f43f5e] font-semibold">potential loss</span> of funds.</p>
              </div>

              {/* Vendor Account Details Card */}
              <div className="bg-[#050a14] border border-[#0f2744] rounded-3xl p-4 mt-1 relative overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-[#0f2744]/60 mb-3 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <span className="text-slate-300">Receiving Account Details:</span>
                  <Badge variant="outline" className="border-blue-500/20 bg-blue-500/5 text-blue-400 text-[10px]">
                    UPI ID Match
                  </Badge>
                </div>

                <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                  {/* Account detail text lines */}
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Beneficiary Name</div>
                      <button
                        onClick={() => copyText(payment.vendorName || "", "vendor_name")}
                        className="flex items-center gap-1.5 text-sm font-bold text-slate-200 hover:text-white"
                        disabled={!payment.vendorName}
                      >
                        {payment.vendorName || "Not Available"}
                        {payment.vendorName && (copiedId === "vendor_name" ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-500" />
                        ))}
                      </button>
                    </div>

                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono font-semibold">Receiving UPI ID</div>
                      <button
                        onClick={() => copyText(payment.vendorUpiId || "", "vendor_upi")}
                        className="flex items-center gap-1.5 text-sm font-black text-slate-200 hover:text-white font-mono break-all text-left"
                        disabled={!payment.vendorUpiId}
                      >
                        {payment.vendorUpiId || "Not Available"}
                        {payment.vendorUpiId && (copiedId === "vendor_upi" ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-500" />
                        ))}
                      </button>
                    </div>

                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Amount to Deposit</div>
                      <button
                        onClick={() => copyText(String(payment.amountINR), "amount_inr")}
                        className="flex items-center gap-1.5 text-base font-extrabold text-[#fbbf24] hover:text-[#fbbf24]/80 text-left font-mono"
                      >
                        ₹{payment.amountINR.toLocaleString()}.00
                        {copiedId === "amount_inr" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-slate-500" />
                        )}
                      </button>
                    </div>

                    <div className="pt-1">
                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Receive USDT</div>
                        <span className="text-xs font-bold text-[#10b981] block pt-0.5 font-mono">
                          {payment.amountUSDT} USDT
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QR Image embedded on the right */}
                  <div className="relative bg-white p-2 rounded-2xl w-24 h-24 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center select-none shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={payment.vendorQrCode || (payment.vendorUpiId 
                        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=0a1628&data=${encodeURIComponent(`upi://pay?pa=${payment.vendorUpiId}&pn=${encodeURIComponent(payment.vendorName || "Vendor")}`)}` 
                        : "https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=0a1628&data=No%20UPI%20ID%20Configured")}
                      alt="Payment QR"
                      className="w-full h-full rounded-lg object-contain"
                    />
                    <div className="absolute inset-0 border border-zinc-200 rounded-2xl pointer-events-none" />
                  </div>
                </div>

                {/* Supported payment app icons */}
                <div className="mt-3 pt-3 border-t border-zinc-900/60 flex items-center justify-start gap-3">
                  {payment.paymentMethod ? (
                    (() => {
                      const method = payment.paymentMethod.toLowerCase();
                      if (method === "phonepe") {
                        return (
                          <span className="h-6 px-3 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center text-[10px] font-bold text-purple-400 shadow-sm">
                            PhonePe Only
                          </span>
                        );
                      }
                      if (method === "gpay" || method === "google pay") {
                        return (
                          <span className="h-6 px-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center text-[10px] font-bold text-blue-400 shadow-sm">
                            Google Pay Only
                          </span>
                        );
                      }
                      if (method === "paytm") {
                        return (
                          <span className="h-6 px-3 bg-sky-500/10 border border-sky-500/20 rounded-lg flex items-center justify-center text-[10px] font-bold text-sky-400 shadow-sm">
                            Paytm Only
                          </span>
                        );
                      }
                      if (method === "imps") {
                        return (
                          <span className="h-6 px-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-[10px] font-bold text-amber-400 shadow-sm">
                            IMPS Bank Transfer
                          </span>
                        );
                      }
                      if (method === "bank transfer") {
                        return (
                          <span className="h-6 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-[10px] font-bold text-emerald-400 shadow-sm">
                            Bank Transfer
                          </span>
                        );
                      }
                      // For general UPI selection, show the standard supported apps
                      return (
                        <>
                          <span className="h-5 w-12 bg-white/5 border border-[#0f2744] rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">GPay</span>
                          <span className="h-5 w-12 bg-white/5 border border-[#0f2744] rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">PhonePe</span>
                          <span className="h-5 w-12 bg-white/5 border border-[#0f2744] rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">Paytm</span>
                          <span className="h-5 w-12 bg-white/5 border border-[#0f2744] rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">UPI</span>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <span className="h-5 w-12 bg-white/5 border border-[#0f2744] rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">GPay</span>
                      <span className="h-5 w-12 bg-white/5 border border-[#0f2744] rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">PhonePe</span>
                      <span className="h-5 w-12 bg-white/5 border border-[#0f2744] rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">Paytm</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: CONFIRM PAYMENT */}
          <div className="relative">
            {/* Golden Circle Dot */}
            <div className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full bg-[#fbbf24] border-4 border-[#0d0d12] shadow-[0_0_8px_rgba(251,191,36,0.6)]" />

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">2</span>
                <h3 className="text-sm font-bold text-white">Confirm Payment</h3>
              </div>

              <div className="text-slate-400 text-xs space-y-1 pl-4 leading-relaxed">
                <p>Enter account holder's name and <span className="text-[#f43f5e] font-semibold">upload payment slip</span> to confirm your payment.</p>
                <p className="text-[#f43f5e] font-semibold text-[11px] pt-1">
                  The payer's name must be the same as the name registered with the bank account, Please change it manually in the event of any discrepancies. *
                </p>
              </div>

              {/* Form Input fields card */}
              <div className="bg-[#050a14] border border-[#0f2744] rounded-3xl p-5 mt-1 space-y-4">
                {/* Payer Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Payer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Please enter your name"
                    className="w-full h-11 bg-[#02050c] border border-[#0f2744] text-white rounded-xl px-4 text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* Screenshot proof upload zone */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                    Upload Payment Proof <span className="text-rose-500">*</span>
                  </label>

                  {proofError && (
                    <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold animate-pulse">
                      {proofError}
                    </div>
                  )}

                  <div className="relative border border-dashed border-[#0f2744] bg-[#02050c]/40 hover:bg-[#02050c]/70 rounded-2xl p-6 text-center transition flex flex-col items-center justify-center min-h-[120px] select-none cursor-pointer">
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
                          className="max-h-28 rounded-lg object-contain border border-[#0f2744]"
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
                        <Upload className="h-6 w-6 text-zinc-600 mb-2" />
                        <span className="text-xs text-zinc-500">Upload</span>
                      </>
                    )}
                  </div>
                  
                  {/* Button to generate mock screenshot */}
                  {/* <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={generateMockScreenshot}
                      className="text-[11px] text-[#fbbf24] hover:underline font-semibold"
                    >
                      ✨ Generate Mock PhonePe Payment slip
                    </button>
                  </div> */}
                </div>

                {/* Enforces standard manual vendor/admin audits */}

                {/* Error messages are now rendered dynamically above the upload proof box */}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTON BAR */}
        <div className="mt-8 grid grid-cols-[100px_1fr] gap-3 pt-4 border-t border-zinc-900/50">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="h-12 bg-white text-zinc-900 border-white hover:bg-zinc-100 hover:text-zinc-950 font-bold rounded-xl shadow-md"
          >
            Cancel
          </Button>
          
          <Button
            type="button"
            onClick={handleSubmitProof}
            disabled={isSubmittingProof}
            className="h-12 bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0d0d12] font-black rounded-xl shadow-[0_4px_15px_rgba(251,191,36,0.25)] transition-all flex items-center justify-center"
          >
            {isSubmittingProof ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Deposit"
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}
