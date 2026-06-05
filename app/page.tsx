'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Zap, Loader2, ArrowRight, CheckCircle2, User, Mail,
  Phone, IndianRupee, ShieldAlert, Sparkles, RefreshCw,
  ExternalLink, Layers, Globe
} from 'lucide-react'

export default function Home() {
  // Order configuration states
  const [amountINR, setAmountINR] = useState('1000')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('+91 9876543210')
  const [merchantUserId, setMerchantUserId] = useState(`USR_${Math.floor(100000 + Math.random() * 900000)}`)
  const [orderId, setOrderId] = useState(`MERC_TEST_${Math.floor(1000 + Math.random() * 9000)}`)
  const [callbackUrl, setCallbackUrl] = useState(process.env.NEXT_PUBLIC_BASE_URL)
  const [cancelUrl, setCancelUrl] = useState('https://onnxpay.com/cancelled')

  // UI state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoRedirect, setAutoRedirect] = useState(true)

  // Quick prefill configurations
  const handlePrefill = (amount: string, name: string) => {
    setAmountINR(amount)
    setCustomerName(name)
    setOrderId(`MERC_TEST_${Math.floor(1000 + Math.random() * 9000)}`)
    setMerchantUserId(`USR_${Math.floor(100000 + Math.random() * 900000)}`)
    if (name === 'Jon Snow') {
      setCustomerEmail('jon.snow@winterfell.com')
    } else {
      setCustomerEmail('')
    }
  }

  // Calculate dynamic USDT estimation (standard process rate ₹86.80)
  const estimatedUSDT = useMemo(() => {
    const amt = parseFloat(amountINR)
    if (isNaN(amt) || amt <= 0) return '0.00'
    return (amt / 86.80).toFixed(2)
  }, [amountINR])

  const createCustomOrder = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    const amt = parseFloat(amountINR)
    if (isNaN(amt) || amt < 100) {
      setError('Order amount must be at least ₹100 INR for gateway liquidity locking.')
      setLoading(false)
      return
    }

    if (!customerName || !customerName.trim()) {
      setError('Payer Full Name is a required field.')
      setLoading(false)
      return
    }

    if (!customerEmail || !customerEmail.trim()) {
      setError('Payer Email Address is a required field.')
      setLoading(false)
      return
    }

    if (!merchantUserId || !merchantUserId.trim()) {
      setError('Merchant User ID is a required field.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fd4fca8b-0122-4a42-b2ed-4dd507a8f6ea',
        },
        body: JSON.stringify({
          amount_inr: amt,
          currency: 'INR',
          order_id: orderId,
          customer_details: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            merchant_user_id: merchantUserId,
          },
          callback_url: callbackUrl,
          cancel_url: cancelUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create sandbox order.')

      setResult(data)

      // Automatic high-speed redirection
      if (autoRedirect && data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#07070a] text-slate-100 flex flex-col font-sans">
      {/* Decorative Radial Gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0,transparent_100%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-cyan-500/5 blur-3xl opacity-60" />

      {/* Navigation Header */}
      <header className="relative z-10 mx-auto w-full max-w-6xl flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-950/40 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 grid place-items-center shadow-lg shadow-cyan-500/10">
            <Zap className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              OnnxPay Gateway Sandbox
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/5 text-cyan-400 text-[9px] font-bold">
                TESTNET
              </Badge>
            </div>
            <div className="text-[9px] uppercase tracking-widest text-slate-500">Merchant API Integration Console</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/vendor"
            target="_blank"
            className="text-xs font-semibold text-zinc-400 hover:text-white transition flex items-center gap-1 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800"
          >
            Vendor Panel ↗
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col items-center justify-center py-12">
        <div className="text-center mb-8 max-w-xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Simulate Merchant Checkout
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Fill out the order parameters below to generate a dynamic payment gateway session. Clicking launch will request <code className="text-cyan-300 font-mono">POST /api/create-order</code> and lock the payment rate.
          </p>
        </div>

        {/* Dashboard Split Card Layout */}
        <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6 items-start">
          
          {/* Left Panel: Inputs Form */}
          <div className="bg-[#0f0f13] border border-zinc-900 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" /> Order Parameters
              </h2>
              <button
                type="button"
                onClick={() => setOrderId(`MERC_TEST_${Math.floor(1000 + Math.random() * 9000)}`)}
                className="text-[11px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1 font-semibold transition"
              >
                <RefreshCw className="h-3 w-3" /> Refresh ID
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Amount INR */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Deposit Amount (INR) <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">₹</span>
                  <input
                    type="number"
                    value={amountINR}
                    onChange={(e) => setAmountINR(e.target.value)}
                    placeholder="Enter amount in INR"
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 font-mono transition"
                  />
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 block">Est. conversion: <strong className="text-emerald-400 font-mono">{estimatedUSDT} USDT</strong> (Rate: ₹86.80)</span>
              </div>

              {/* Order ID */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Merchant Order ID <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Globe className="h-4 w-4" /></span>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="E.g. MERC_DELL_1002"
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 font-mono transition"
                  />
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Payer Full Name <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><User className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter payer's full name"
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 transition"
                  />
                </div>
              </div>

              {/* Customer Email */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Payer Email Address <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Mail className="h-4 w-4" /></span>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 transition"
                  />
                </div>
              </div>

              {/* Merchant User ID */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Merchant User ID <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Layers className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={merchantUserId}
                    onChange={(e) => setMerchantUserId(e.target.value)}
                    placeholder="E.g. USR_90392"
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 font-mono transition"
                  />
                </div>
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Payer Phone Number <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Phone className="h-4 w-4" /></span>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="E.g. +91 98765 43210"
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 transition"
                  />
                </div>
              </div>

              {/* Callback Webhook URL */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Webhook Callback Endpoint <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><ExternalLink className="h-4 w-4" /></span>
                  <input
                    type="text"
                    value={callbackUrl}
                    onChange={(e) => setCallbackUrl(e.target.value)}
                    placeholder="Callback webhook link"
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-white focus:outline-none focus:border-zinc-700 transition"
                  />
                </div>
              </div>

            </div>

            {/* Strategy Switch / Redirect toggle */}
            <div className="pt-4 border-t border-zinc-900 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white mb-0.5">High-Speed Gateway Autotransfer</h4>
                <p className="text-[10px] text-zinc-500">Automatically redirect to the checkout flow upon link validation.</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoRedirect(!autoRedirect)}
                className={`w-12 h-6 rounded-full relative transition duration-300 flex items-center px-1 shrink-0 ${
                  autoRedirect ? 'bg-cyan-500' : 'bg-zinc-800'
                }`}
              >
                <span className={`h-4.5 w-4.5 rounded-full bg-slate-950 shadow transition duration-300 block transform ${
                  autoRedirect ? 'translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Right Panel: Side Controls Card */}
          <div className="space-y-6">
            
            {/* Quick Prefill Selection */}
            <div className="bg-[#0f0f13] border border-zinc-900 rounded-3xl p-5 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider pb-2 border-b border-zinc-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" /> Sandbox Quick Limits
              </h3>
              
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handlePrefill('1000', '')}
                  className="w-full p-3 rounded-xl border border-zinc-900 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-800 text-left transition flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-200 block">Jaiswal SBI Limits</span>
                    <span className="text-[10px] text-zinc-500">Auto match advertisement engine</span>
                  </div>
                  <span className="font-mono font-black text-cyan-400">₹1,000</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrefill('800', 'Jon Snow')}
                  className="w-full p-3 rounded-xl border border-zinc-900 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-800 text-left transition flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-200 block">PhonePe Active Channel</span>
                    <span className="text-[10px] text-zinc-500">Minimum trade bounds test</span>
                  </div>
                  <span className="font-mono font-black text-emerald-400">₹800</span>
                </button>
              </div>
            </div>

            {/* Launch Action Card */}
            <div className="bg-gradient-to-b from-[#101115] to-[#07070a] border border-zinc-900 rounded-3xl p-5 shadow-xl space-y-4">
              <Button
                onClick={createCustomOrder}
                disabled={loading}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl shadow-[0_4px_15px_rgba(6,182,212,0.25)] transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Synchronizing Order…</>
                ) : (
                  <>Launch Gateway <ArrowRight className="h-4.5 w-4.5" /></>
                )}
              </Button>

              {error && (
                <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {result && !autoRedirect && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    Secure order instantiated!
                  </div>
                  <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3 space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Payment Session:</span>
                      <span className="text-zinc-300 font-bold">{result.payment_id.slice(0, 16)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Conversion Locked:</span>
                      <span className="text-emerald-400 font-bold">{result.amount_usdt} USDT</span>
                    </div>
                  </div>
                  <a
                    href={result.checkout_url}
                    className="block w-full"
                  >
                    <Button
                      variant="outline"
                      className="w-full h-10 border-cyan-500/30 bg-[#0f0f13] text-cyan-300 hover:bg-cyan-500/10 font-bold rounded-xl"
                    >
                      Open Checkout Panel <ExternalLink className="h-3.5 w-3.5 ml-2" />
                    </Button>
                  </a>
                </div>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-[10px] text-zinc-600 border-t border-zinc-900 bg-zinc-950/20">
        OnnxPay Sandbox integration client. Compliant with TRON Shasta networks & MongoDB advertisements.
      </footer>
    </div>
  )
}

// Simple absolute Badge helper in case shadcn default isn't globally registered
function Badge({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: 'outline' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
      {children}
    </span>
  )
}
