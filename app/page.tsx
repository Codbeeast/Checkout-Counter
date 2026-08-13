'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Zap, Loader2, ArrowRight, CheckCircle2, User,
  IndianRupee, ShieldAlert, Sparkles, RefreshCw,
  ExternalLink, Layers, Globe
} from 'lucide-react'

export default function Home() {
  // Order configuration states
  const [amountINR, setAmountINR] = useState('1000')
  const [customerName, setCustomerName] = useState('')
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
          'x-api-key':  process.env.NEXT_PUBLIC_API_KEY || '', // Ensure API key is sent for authentication
        },
        body: JSON.stringify({
          amount_inr: amt,
          currency: 'INR',
          order_id: orderId,
          customer_details: {
            name: customerName,
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
    <div className="relative min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="relative z-10 mx-auto w-full max-w-6xl flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 grid place-items-center shadow-md shadow-sky-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              OnnxPay Gateway Sandbox
              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 text-[9px] font-bold">
                TESTNET
              </Badge>
            </div>
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">Merchant API Integration Console</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/vendor"
            target="_blank"
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs"
          >
            Vendor Panel ↗
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center justify-center">
        <div className="text-center mb-8 max-w-xl px-2">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
            Simulate Merchant Checkout
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Fill out the order parameters below to generate a dynamic payment gateway session. Clicking launch will request <code className="text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 font-mono">POST /api/create-order</code> and lock the payment rate.
          </p>
        </div>

        {/* Dashboard Split Card Layout */}
        <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_360px] gap-6 items-start">
          
          {/* Left Panel: Inputs Form */}
          <div className="bg-slate-100/90 border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-500" /> Order Parameters
              </h2>
              <button
                type="button"
                onClick={() => setOrderId(`MERC_TEST_${Math.floor(1000 + Math.random() * 9000)}`)}
                className="text-[11px] text-slate-500 hover:text-sky-600 flex items-center gap-1 font-semibold transition"
              >
                <RefreshCw className="h-3 w-3" /> Refresh ID
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Amount INR */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Deposit Amount (INR) <span className="text-sky-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                  <input
                    type="number"
                    value={amountINR}
                    onChange={(e) => setAmountINR(e.target.value)}
                    placeholder="Enter amount in INR"
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-8 pr-4 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 font-mono transition shadow-xs font-semibold"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Est. conversion: <strong className="text-emerald-600 font-mono">{estimatedUSDT} USDT</strong> (Rate: ₹86.80)</span>
              </div>

              {/* Order ID */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Merchant Order ID <span className="text-sky-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Globe className="h-4 w-4" /></span>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="E.g. MERC_DELL_1002"
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 font-mono transition shadow-xs font-semibold"
                  />
                </div>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Payer Full Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><User className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter payer's full name"
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition shadow-xs font-semibold"
                  />
                </div>
              </div>

              {/* Merchant User ID */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Merchant User ID <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Layers className="h-4 w-4" /></span>
                  <input
                    type="text"
                    required
                    value={merchantUserId}
                    onChange={(e) => setMerchantUserId(e.target.value)}
                    placeholder="E.g. USR_90392"
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 font-mono transition shadow-xs font-semibold"
                  />
                </div>
              </div>

              {/* Callback Webhook URL */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Webhook Callback Endpoint <span className="text-sky-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><ExternalLink className="h-4 w-4" /></span>
                  <input
                    type="text"
                    value={callbackUrl}
                    onChange={(e) => setCallbackUrl(e.target.value)}
                    placeholder="Callback webhook link"
                    className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition shadow-xs font-medium"
                  />
                </div>
              </div>

            </div>

            {/* Strategy Switch / Redirect toggle */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-0.5">High-Speed Gateway Autotransfer</h4>
                <p className="text-[10px] text-slate-500">Automatically redirect to the checkout flow upon link validation.</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoRedirect(!autoRedirect)}
                className={`w-12 h-6 rounded-full relative transition duration-300 flex items-center px-1 shrink-0 ${
                  autoRedirect ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <span className={`h-4.5 w-4.5 rounded-full bg-white shadow-sm transition duration-300 block transform ${
                  autoRedirect ? 'translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Right Panel: Side Controls Card */}
          <div className="space-y-6">
            
            {/* Quick Prefill Selection */}
            <div className="bg-slate-100/90 border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-200 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-sky-500 animate-pulse" /> Sandbox Quick Limits
              </h3>
              
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handlePrefill('1000', '')}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition flex justify-between items-center text-xs shadow-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">Jaiswal SBI Limits</span>
                    <span className="text-[10px] text-slate-500">Auto match advertisement engine</span>
                  </div>
                  <span className="font-mono font-black text-sky-600">₹1,000</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrefill('800', 'Jon Snow')}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition flex justify-between items-center text-xs shadow-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">PhonePe Active Channel</span>
                    <span className="text-[10px] text-slate-500">Minimum trade bounds test</span>
                  </div>
                  <span className="font-mono font-black text-emerald-600">₹800</span>
                </button>
              </div>
            </div>

            {/* Launch Action Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <Button
                onClick={createCustomOrder}
                disabled={loading}
                className="w-full h-12 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl shadow-md shadow-sky-500/20 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Synchronizing Order…</>
                ) : (
                  <>Launch Gateway <ArrowRight className="h-4.5 w-4.5" /></>
                )}
              </Button>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {result && !autoRedirect && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    Secure order instantiated!
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Session:</span>
                      <span className="text-slate-900 font-bold">{result.payment_id.slice(0, 16)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Conversion Locked:</span>
                      <span className="text-emerald-600 font-bold">{result.amount_usdt} USDT</span>
                    </div>
                  </div>
                  <a
                    href={result.checkout_url}
                    className="block w-full"
                  >
                    <Button
                      variant="outline"
                      className="w-full h-10 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold rounded-xl"
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

      <footer className="w-full text-center py-6 text-[10px] text-slate-500 border-t border-slate-200 bg-white/50">
        OnnxPay Sandbox integration client. Compliant with BSC BEP-20 networks & MongoDB advertisements.
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




