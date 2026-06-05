'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Check, X, Clock, Shield,
  AlertCircle, TrendingUp, Coins, Users, CheckCircle2,
  Image as ImageIcon, RefreshCw, Copy, Search, HelpCircle,
  Eye, FileText, ArrowRight
} from 'lucide-react'

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
}

export default function VendorDashboard() {
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  // Modal state for screenshot zoom
  const [zoomScreenshot, setZoomScreenshot] = useState<string | null>(null)

  // Action pending states
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Filter state
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirming' | 'completed' | 'cancelled'>('confirming')

  // Fetch all payments
  const fetchPayments = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true)
    try {
      const res = await fetch('/api/payment')
      if (!res.ok) throw new Error('Failed to load transaction logs')
      const data: PaymentData[] = await res.json()
      
      // Filter for P2P payments only (where paymentMethod is present)
      const p2pPayments = data.filter(p => p.paymentMethod)
      
      // Sort payments: most recent first
      p2pPayments.sort((a, b) => b.createdAt - a.createdAt)
      
      setPayments(p2pPayments)
      
      // Select first payment if none is selected
      if (p2pPayments.length > 0 && !selectedPaymentId) {
        // Find first item matching current filter
        const matched = p2pPayments.find(p => {
          if (filterStatus === 'all') return true
          return p.status === filterStatus
        })
        if (matched) {
          setSelectedPaymentId(matched.paymentId)
        } else {
          setSelectedPaymentId(p2pPayments[0].paymentId)
        }
      }
      setError(null)
    } catch (err: any) {
      setError(err.message || 'An error occurred while synchronizing database records.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [selectedPaymentId, filterStatus])

  // Periodic polling for real-time sync (every 4 seconds)
  useEffect(() => {
    fetchPayments(true)
    const interval = setInterval(() => {
      fetchPayments(true)
    }, 4000)
    return () => clearInterval(interval)
  }, [fetchPayments])

  const copyText = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    }).catch(() => {})
  }, [])

  // Process manual approval/rejection
  const handleVendorAction = async (paymentId: string, approve: boolean) => {
    setProcessingId(paymentId)
    setActionError(null)
    setActionSuccess(null)

    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, approve })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gateway action failed')

      setActionSuccess(approve ? '✅ Settlement complete! Funds swept on-chain.' : '❌ Transaction rejected. Order cancelled.')
      
      // Refetch payment records immediately
      await fetchPayments(true)
    } catch (err: any) {
      setActionError(err.message || 'An error occurred during transaction processing.')
    } finally {
      setProcessingId(null)
    }
  }

  // Get active payment selection detail
  const selectedPayment = payments.find(p => p.paymentId === selectedPaymentId)

  // Compute overall stats
  const stats = (() => {
    const completed = payments.filter(p => p.status === 'completed')
    const totalINR = completed.reduce((sum, p) => sum + p.amountINR, 0)
    const totalUSDT = completed.reduce((sum, p) => sum + p.amountUSDT, 0)
    const pendingCount = payments.filter(p => p.status === 'confirming').length
    
    return {
      totalINR,
      totalUSDT,
      pendingCount,
      totalCount: payments.length
    }
  })()

  // Filtered payments list
  const filteredPayments = payments.filter(p => {
    if (filterStatus === 'all') return true
    return p.status === filterStatus
  })

  // Format date helper
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-IN', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short'
    })
  }

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-600 grid place-items-center shadow-lg shadow-yellow-500/10">
            <Coins className="h-5 w-5 text-zinc-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              OnnxPay P2P Vendor Console
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold py-0.5 px-2">
                Merchant Gateway Mode
              </Badge>
            </h1>
            <p className="text-[11px] text-slate-400">Manage liquidity settlements & verify direct bank-to-bank fiat receipts</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPayments()}
            disabled={isRefreshing}
            className="h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            Sync Records
          </button>
          <div className="text-xs text-slate-400 border-l border-zinc-800 pl-3">
            Local Time: <span className="font-mono text-zinc-200">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      {/* Stats Summary Area */}
      <section className="bg-zinc-950/40 border-b border-zinc-900 px-6 py-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="bg-[#18181b] border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Total P2P Volume</span>
            <span className="text-xl font-extrabold text-white font-mono">{stats.totalUSDT.toFixed(2)} <span className="text-xs text-emerald-400">USDT</span></span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/5 border border-emerald-500/10 grid place-items-center shrink-0">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-[#18181b] border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Total INR Collected</span>
            <span className="text-xl font-extrabold text-blue-400 font-mono">₹{stats.totalINR.toLocaleString('en-IN')}.00</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/5 border border-blue-500/10 grid place-items-center shrink-0">
            <Coins className="h-5 w-5 text-blue-400" />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-[#18181b] border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Pending Review</span>
            <span className="text-xl font-extrabold text-amber-500 font-mono">{stats.pendingCount} <span className="text-xs text-zinc-500 font-normal">orders</span></span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/5 border border-amber-500/10 grid place-items-center shrink-0">
            <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-[#18181b] border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Active Ad Campaign</span>
            <span className="text-xs font-semibold text-slate-300 block mt-1">ADV-161167KPBIHK (Visible)</span>
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider font-mono">1 USDT = 86.80 INR</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-yellow-500/5 border border-yellow-500/10 grid place-items-center shrink-0">
            <Users className="h-5 w-5 text-yellow-500" />
          </div>
        </div>
      </section>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Side: Payments List */}
        <aside className="w-full md:w-[420px] border-r border-zinc-900 bg-zinc-950 flex flex-col overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-zinc-900 bg-zinc-950/80 flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setFilterStatus('confirming')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                filterStatus === 'confirming'
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-zinc-900 text-zinc-400 border border-transparent hover:text-white'
              }`}
            >
              Pending ({payments.filter(p => p.status === 'confirming').length})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                filterStatus === 'completed'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-900 text-zinc-400 border border-transparent hover:text-white'
              }`}
            >
              Completed ({payments.filter(p => p.status === 'completed').length})
            </button>
            <button
              onClick={() => setFilterStatus('cancelled')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                filterStatus === 'cancelled'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-zinc-900 text-zinc-400 border border-transparent hover:text-white'
              }`}
            >
              Cancelled
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                filterStatus === 'all'
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                  : 'bg-zinc-900 text-zinc-400 border border-transparent hover:text-white'
              }`}
            >
              All ({payments.length})
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-6 w-6 text-zinc-500 animate-spin" />
                <span className="text-xs text-zinc-500">Retrieving system ledger...</span>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center p-4">
                <AlertCircle className="h-8 w-8 text-zinc-700 mb-2" />
                <h4 className="text-sm font-bold text-zinc-400">No matching P2P transactions</h4>
                <p className="text-xs text-zinc-600 max-w-[240px] mt-1">There are no payments currently matching the selected status filters.</p>
              </div>
            ) : (
              filteredPayments.map(p => {
                const isSelected = p.paymentId === selectedPaymentId
                return (
                  <div
                    key={p.paymentId}
                    onClick={() => setSelectedPaymentId(p.paymentId)}
                    className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 border-zinc-700 shadow-md ring-1 ring-zinc-700'
                        : 'bg-[#18181b]/50 border-zinc-900 hover:bg-[#18181b] hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-[11px] font-bold text-zinc-400">
                        {p.paymentId.slice(0, 16)}...
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          p.status === 'completed'
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[9px]'
                            : p.status === 'confirming'
                            ? 'border-amber-500/20 bg-amber-500/5 text-amber-400 text-[9px] animate-pulse'
                            : p.status === 'pending'
                            ? 'border-blue-500/20 bg-blue-500/5 text-blue-400 text-[9px]'
                            : 'border-red-500/20 bg-red-500/5 text-red-400 text-[9px]'
                        }
                      >
                        {p.status === 'confirming' ? 'Pending Review' : p.status}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs font-semibold text-slate-400 truncate max-w-[180px]">
                        {p.payerName || p.customerName || 'Payer Name'}
                      </span>
                      <span className="text-sm font-extrabold text-white font-mono">
                        ₹{p.amountINR.toLocaleString('en-IN')}.00
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-900/60 pt-2">
                      <span>Rate: {p.exchangeRate}</span>
                      <span>{formatDate(p.createdAt)}</span>
                    </div>

                    {p.utrNumber && (
                      <div className="mt-2 bg-black/30 border border-zinc-900 rounded-lg px-2.5 py-1 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-500">UTR:</span>
                        <span className="text-amber-400 font-bold">{p.utrNumber}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Side: Selected Payment details & Action Panel */}
        <main className="flex-1 bg-zinc-950 flex flex-col overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-zinc-500 animate-spin" />
            </div>
          ) : !selectedPayment ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="h-16 w-16 rounded-full bg-zinc-900 border border-zinc-800 grid place-items-center mb-4">
                <FileText className="h-6 w-6 text-zinc-600" />
              </div>
              <h3 className="text-base font-bold text-zinc-400">Select a Transaction Log</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">Select any payment from the left list to review dynamic UTR references, screenshots, and trigger blockchain settlement sweeps.</p>
            </div>
          ) : (
            <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
              
              {/* Header Title Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#18181b]/40 border border-zinc-900 p-4 rounded-3xl">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Deposit Transaction File</span>
                    <Badge variant="outline" className="border-blue-500/20 bg-blue-500/5 text-blue-400 text-[9px] uppercase font-mono">
                      {selectedPayment.verificationType === 'auto' ? '🤖 AUTO SCAN' : '🧑‍💼 MANUAL REVIEW'}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-bold text-white font-mono flex items-center gap-1.5 select-all">
                    {selectedPayment.paymentId}
                    <button
                      onClick={() => copyText(selectedPayment.paymentId, 'payment_id')}
                      className="text-zinc-500 hover:text-white transition"
                    >
                      {copiedId === 'payment_id' ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      selectedPayment.status === 'completed'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold py-1 px-3.5'
                        : selectedPayment.status === 'confirming'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-bold py-1 px-3.5 animate-pulse'
                        : selectedPayment.status === 'pending'
                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 text-[11px] font-bold py-1 px-3.5'
                        : 'border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-bold py-1 px-3.5'
                    }
                  >
                    {selectedPayment.status === 'confirming' ? 'PENDING APPROVAL' : selectedPayment.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Error or Success Banner */}
              {actionError && (
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>{actionError}</p>
                </div>
              )}
              {actionSuccess && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <p>{actionSuccess}</p>
                </div>
              )}

              {/* Side-by-Side Review Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Card: Customer & Details */}
                <div className="space-y-6">
                  {/* Details Card */}
                  <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-zinc-900 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-400" /> Transaction Payer Details
                    </h3>

                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Payer Full Name:</span>
                        <span className="text-zinc-300 font-bold text-right">{selectedPayment.payerName || selectedPayment.customerName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Customer Email:</span>
                        <span className="text-zinc-300 text-right select-all">{selectedPayment.customerEmail || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Order Refer ID:</span>
                        <span className="text-zinc-300 font-mono text-right select-all">{selectedPayment.orderId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Voucher Details:</span>
                        <span className="text-zinc-500 text-right">No Vouchers</span>
                      </div>
                      <Separator className="bg-zinc-900" />
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Gateway Type:</span>
                        <span className="text-zinc-300 font-bold text-right flex items-center gap-1">
                          P2P Fiat-to-Crypto
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Payer Selected Method:</span>
                        <span className="text-zinc-200 font-bold text-right text-emerald-400 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded-lg">
                          {selectedPayment.paymentMethod || 'UPI'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Registration Timestamp:</span>
                        <span className="text-zinc-400 text-right">{formatDate(selectedPayment.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Conversion Card */}
                  <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-zinc-900 flex items-center gap-2">
                      <Coins className="h-4 w-4 text-emerald-400" /> Settlement & Exchange Rate
                    </h3>

                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-zinc-400 font-bold">Fiat Amount Received:</span>
                        <span className="text-xl font-extrabold text-blue-400 font-mono">₹{selectedPayment.amountINR.toLocaleString('en-IN')}.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-semibold">Locked Rate (USDT/INR):</span>
                        <span className="text-zinc-300 font-semibold font-mono">₹{selectedPayment.exchangeRate}</span>
                      </div>
                      <Separator className="bg-zinc-900" />
                      <div className="flex justify-between items-baseline">
                        <span className="text-zinc-400 font-bold">Locked Crypto swept (USDT):</span>
                        <span className="text-xl font-black text-emerald-400 font-mono">{selectedPayment.amountUSDT} USDT</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Screenshot & Verification Details */}
                <div className="space-y-6">
                  {/* UTR Reference Box */}
                  <div className="bg-[#1c1812] border border-amber-500/20 rounded-3xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-[#fbbf24] uppercase tracking-wider pb-2 border-b border-amber-950 flex items-center gap-2">
                      <Shield className="h-4 w-4" /> UTR Ledger Matching
                    </h3>

                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Transaction 12-Digit Reference (UTR)</div>
                      {selectedPayment.utrNumber ? (
                        <div className="flex items-center justify-between bg-black/40 border border-zinc-800 rounded-2xl px-4 py-3">
                          <code className="text-lg font-mono font-black tracking-widest text-[#fbbf24]">
                            {selectedPayment.utrNumber}
                          </code>
                          <button
                            onClick={() => copyText(selectedPayment.utrNumber || '', 'utr')}
                            className="text-zinc-500 hover:text-white transition"
                          >
                            {copiedId === 'utr' ? (
                              <Check className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-400 rounded-xl text-center text-xs">
                          ⚠️ UTR not submitted by user yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Screenshot Proof Card */}
                  <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-2 border-b border-zinc-900 flex items-center justify-between">
                      <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-purple-400" /> Screenshot Receipt Proof</span>
                      {selectedPayment.screenshotUrl && (
                        <button
                          onClick={() => setZoomScreenshot(selectedPayment.screenshotUrl || null)}
                          className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" /> Full Size
                        </button>
                      )}
                    </h3>

                    <div className="flex flex-col items-center justify-center min-h-[160px] bg-black/40 border border-dashed border-zinc-900 rounded-2xl p-4 overflow-hidden">
                      {selectedPayment.screenshotUrl ? (
                        <div
                          className="relative w-full group cursor-pointer"
                          onClick={() => setZoomScreenshot(selectedPayment.screenshotUrl || null)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={selectedPayment.screenshotUrl}
                            alt="Payment Slip Proof"
                            className="max-h-44 mx-auto rounded-lg object-contain border border-zinc-800 transition group-hover:opacity-90"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg text-xs font-semibold">
                            Click to zoom receipt
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-zinc-600 text-xs">
                          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30 text-zinc-500" />
                          <span>No receipt slip uploaded by customer</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>



              {/* BOTTOM STRATEGY & DECISION ACTION BOARD */}
              {selectedPayment.status === 'confirming' && (
                <div className="bg-[#1b1c1e] border border-zinc-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg shadow-black/40">
                  <div className="space-y-1 text-center sm:text-left">
                    <h4 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <Shield className="h-4 w-4 text-amber-500 animate-pulse" /> Settle Security Verification Required
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                      Confirm you have received the exact amount of <strong className="text-blue-400">₹{selectedPayment.amountINR.toLocaleString('en-IN')}.00</strong> in your {selectedPayment.vendorBankName || selectedPayment.paymentMethod || "UPI"} account (Holder: {selectedPayment.vendorName || "Not Available"}).
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
                    <Button
                      onClick={() => handleVendorAction(selectedPayment.paymentId, false)}
                      disabled={processingId !== null}
                      variant="outline"
                      className="h-12 w-1/2 sm:w-28 bg-[#18181b] border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>

                    <Button
                      onClick={() => handleVendorAction(selectedPayment.paymentId, true)}
                      disabled={processingId !== null}
                      className="h-12 w-1/2 sm:w-48 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.25)] transition flex items-center justify-center gap-1.5"
                    >
                      {processingId === selectedPayment.paymentId ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-zinc-950" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 shrink-0" />
                          Approve Transfer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Redirect banner details */}
              {selectedPayment.status === 'completed' && (
                <div className="bg-emerald-500/5 border border-emerald-500/15 p-5 rounded-3xl flex items-center gap-4">
                  <div className="h-10 w-10 bg-emerald-500/10 rounded-2xl grid place-items-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-0.5">Order Finalized & Webhook Dispatched</h4>
                    <p className="text-[11px] text-zinc-400">
                      The secure success callback POST webhook has been delivered to: <code className="text-slate-300 select-all">{selectedPayment.callbackUrl}</code>. User redirected back to merchant site.
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* Screen Zoom Modal */}
      {zoomScreenshot && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <button
            onClick={() => setZoomScreenshot(null)}
            className="absolute top-6 right-6 h-10 w-10 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-full grid place-items-center transition text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="max-w-3xl max-h-full overflow-hidden flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomScreenshot}
              alt="Zoomed Payment Receipt Slip"
              className="max-h-[85vh] object-contain rounded-2xl border border-zinc-800"
            />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest bg-zinc-950/80 px-4 py-1.5 border border-zinc-900 rounded-full shadow-lg">
              PhonePe Payment Receipt Audit
            </span>
          </div>
        </div>
      )}

    </div>
  )
}
