import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Download, FileText, ArrowLeft, Copy, Check, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Order, Vendor } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { Button, Spinner } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useCart } from "@/store/cartStore";
import { getSocket } from "@/lib/socket";
import { rupees } from "@/lib/utils";

function JaggedEdgeTop() {
  return (
    <svg className="w-full h-2 text-white fill-current block print:hidden" viewBox="0 0 100 10" preserveAspectRatio="none">
      <path d="M0 10 L5 0 L10 10 L15 0 L20 10 L25 0 L30 10 L35 0 L40 10 L45 0 L50 10 L55 0 L60 10 L65 0 L70 10 L75 0 L80 10 L85 0 L90 10 L95 0 L100 10 Z" />
    </svg>
  );
}

function JaggedEdgeBottom() {
  return (
    <svg className="w-full h-2 text-white fill-current block print:hidden" viewBox="0 0 100 10" preserveAspectRatio="none">
      <path d="M0 0 L5 10 L10 0 L15 10 L20 0 L25 10 L30 0 L35 10 L40 0 L45 10 L50 0 L55 10 L60 0 L65 10 L70 0 L75 10 L80 0 L85 10 L90 0 L95 10 L100 0 Z" />
    </svg>
  );
}

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // Set by checkout right after a successful Razorpay payment.
  const justPaid = !!(location.state as any)?.justPaid;
  const cart = useCart();

  // Trap the browser Back button so it never returns to the payment-gateway page
  // (Cashfree's hosted page / the checkout). Back from here goes home instead.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () => navigate("/", { replace: true });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);
  const [copied, setCopied] = useState(false);
  const [paidCheck, setPaidCheck] = useState(false);
  // After a short grace window we stop showing "confirming" and admit failure.
  const [graceOver, setGraceOver] = useState(false);
  const clearedRef = useRef(false);
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => api<Order>(`/api/public/orders/${orderNumber}`),
    enabled: !!orderNumber,
    // Poll while an online order is still awaiting confirmation, then stop.
    refetchInterval: (query) => {
      const o = query.state.data as Order | undefined;
      if (!o) return 1500;
      const settled = o.paymentStatus === "paid" || o.paymentMethod === "COD";
      return settled ? false : 1500;
    },
  });

  const isCod = order?.paymentMethod === "COD";
  // COD orders are placed (pay at pickup), so they count as "confirmed" here.
  const paid = order?.paymentStatus === "paid" || paidCheck === true || !!isCod;

  // Confirm payment on arrival, with a couple of retries to cover gateway
  // capture lag, plus a grace window before we declare it failed. The webhook
  // is the ultimate backup.
  useEffect(() => {
    if (!orderNumber) return;
    let cancelled = false;
    const tryVerify = () =>
      api<{ paid: boolean }>("/api/payments/verify", { method: "POST", body: { orderNumber } })
        .then((r) => {
          if (cancelled) return;
          if (r.paid) {
            setPaidCheck(true);
            qc.invalidateQueries({ queryKey: ["order", orderNumber] });
          }
        })
        .catch(() => {});
    tryVerify();
    const t1 = setTimeout(tryVerify, 2000);
    const t2 = setTimeout(tryVerify, 5000);
    const grace = setTimeout(() => { if (!cancelled) setGraceOver(true); }, 12000);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); clearTimeout(grace); };
  }, [orderNumber, qc]);

  // Live confirmation via socket (webhook/verify marks paid) → refetch.
  useEffect(() => {
    if (!orderNumber) return;
    const socket = getSocket();
    socket.emit("order:track", orderNumber);
    const h = (u: Order) => { if (u.orderNumber === orderNumber) qc.invalidateQueries({ queryKey: ["order", orderNumber] }); };
    socket.on("order:status", h);
    return () => { socket.off("order:status", h); };
  }, [orderNumber, qc]);

  // Clear the cart only once the order is confirmed (a failed payment keeps the
  // cart intact for a retry).
  useEffect(() => {
    if (paid && !clearedRef.current) {
      clearedRef.current = true;
      cart.clear();
    }
  }, [paid, cart]);

  const vendor = typeof order?.vendorId === "object" ? (order!.vendorId as Vendor) : null;

  // Still loading the order itself.
  if (isLoading || !order) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50/50">
        <SiteHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-slate-500">Loading your order…</p>
        </div>
      </div>
    );
  }

  // Online order not confirmed yet → optimistic "placing your order…" screen.
  // It flips to the ticket the instant payment confirms (verify/poll/socket).
  if (!paid && !graceOver) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50/50">
        <SiteHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">{justPaid ? "Payment successful" : "Confirming your payment"}</p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> Placing your order…
            </p>
          </div>
          <p className="max-w-xs text-[11px] text-slate-400">This only takes a moment. Please don't close this screen.</p>
        </div>
      </div>
    );
  }

  // Payment failed / not completed → do NOT show the order ticket.
  if (!paid) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50/50">
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <XCircle className="h-9 w-9" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">Payment not completed</h1>
            <p className="mt-1 text-sm text-slate-500">
              Your payment didn't go through, so this order wasn't placed. No money was charged.
            </p>
          </div>
          <div className="mt-2 w-full space-y-2">
            <Link to="/checkout" className="block">
              <Button className="w-full" size="lg">
                <RefreshCw className="h-4 w-4" /> Try Again
              </Button>
            </Link>
            <Link to={vendor?.slug ? `/vendor/${vendor.slug}` : "/"} className="block">
              <Button variant="outline" className="w-full">
                {vendor?.slug ? "Back to menu" : "Back to home"}
              </Button>
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">
            Already paid? Wait a moment and refresh this page.
          </p>
        </div>
      </div>
    );
  }

  // Cancelled (vendor declined, auto-cancel, or customer cancelled) → show a
  // clear cancelled notice instead of the order ticket. Updates live via socket.
  if (order.status === "cancelled") {
    const online = order.paymentStatus === "paid" && order.paymentMethod !== "COD";
    return (
      <div className="flex min-h-screen flex-col bg-slate-50/50">
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <XCircle className="h-9 w-9" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">
              {order.cancelledBy === "system" ? "Order couldn't be accepted" : "Order cancelled"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {order.cancelReason ||
                (order.cancelledBy === "system"
                  ? "The restaurant didn't respond in time, so your order was cancelled."
                  : "This order was cancelled.")}
            </p>
          </div>
          {online && (
            <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-emerald-700">
              Any amount you paid will be refunded to your original payment method within 24 hours.
            </p>
          )}
          <Link to={vendor?.slug ? `/vendor/${vendor.slug}` : "/"} className="mt-2 text-xs font-semibold text-brand-600 hover:underline">
            {vendor?.slug ? "Order from this restaurant again" : "Back to home"}
          </Link>
        </div>
      </div>
    );
  }

  const suffix = order.orderNumber;

  function handleCopy() {
    navigator.clipboard.writeText(suffix);
    setCopied(true);
    toast.success("Order ID copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadTextReceipt() {
    if (!order) return;
    const vendorName = vendor?.name || "Vendor";
    const itemsText = order.items
      .map((it) => `${it.qty}x ${it.name.padEnd(25)} ${rupees(it.price * it.qty)}`)
      .join("\n");
    
    const receiptContent = `========================================
           PRESNAG ORDER RECEIPT
========================================
Order Number : ${order.orderNumber}
Vendor       : ${vendorName}
Status       : ${order.status.toUpperCase()}
Date/Time    : ${new Date(order.createdAt).toLocaleString()}
----------------------------------------
ITEMS:
${itemsText}
----------------------------------------
Subtotal     : ${rupees(order.subtotal)}
${order.discount > 0 ? `Discount     : -${rupees(order.discount)}\n` : ""}\
Taxes (5%)   : ${rupees(order.tax)}
TOTAL        : ${rupees(order.total)}
----------------------------------------
Payment      : ${order.paymentMethod === "COD" ? "Cash On Pickup" : "Online (UPI)"}
Status       : ${order.paymentStatus}
========================================
       Thank you for ordering!
========================================`;
    
    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PreSnag_Receipt_${order.orderNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 print:bg-white print:pb-0">
      <div className="print:hidden">
        <SiteHeader />
      </div>
      
      <div className="flex-1 mx-auto w-full max-w-sm px-4 py-3 print:p-0 print:max-w-none">
        
        {/* Printable Header (only visible on print) */}
        <div className="hidden print:flex flex-col items-center text-center pb-4 border-b-2 border-slate-200 mb-4">
          <div className="text-2xl font-black tracking-tight text-slate-900">
            Pre<span className="text-brand-500">Snag</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mt-0.5">
            Order Ahead. Skip The Queue.
          </p>
          <h1 className="text-base font-bold text-slate-800 mt-2">ORDER INVOICE</h1>
        </div>

         {/* Success Header */}
        <div className="text-center mb-4 print:hidden">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shadow-inner">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900">Order Confirmed!</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sent to <span className="font-semibold text-slate-700">{vendor?.name}</span>
          </p>
          <p className="text-[10px] text-brand-600 font-medium mt-1">
            Keep your Order ID handy to track your pickup later!
          </p>
        </div>

        {/* Jagged Receipt Card */}
        <div className="relative shadow-[0_4px_20px_rgba(0,0,0,0.04)] print:shadow-none">
          <JaggedEdgeTop />
          
          <div className="bg-white px-4 py-3 pt-0.5 print:p-0">
            {/* Store Header */}
            <div className="text-center pb-2.5 border-b border-dashed border-slate-200 flex flex-col items-center">
              <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Order ID (Tap to copy)</div>
              <button 
                onClick={handleCopy}
                className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200/80 active:bg-slate-300/60 transition font-mono text-base font-black text-slate-800 tracking-wider"
                title="Copy Order ID"
              >
                <span>{suffix}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3 text-slate-400" />
                )}
              </button>
              <div className="text-[9px] text-slate-400 mt-1.5 font-mono">
                {new Date(order.createdAt).toLocaleString()}
              </div>
            </div>

            {/* Receipt Info */}
            <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-slate-200 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">ORDER NUMBER:</span>
                <span className="font-bold text-slate-800">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">STATUS:</span>
                <span className="font-bold text-brand-600 uppercase">{order.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">ORDER TYPE:</span>
                <span className="font-bold text-slate-800">{order.orderType === "TAKE_AWAY" ? "Take Away" : "Dine In"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">EST. PICKUP:</span>
                <span className="font-bold text-slate-800">{order.pickupTime}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2.5 space-y-1.5 border-b border-dashed border-slate-200">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between text-xs font-mono">
                  <div className="flex items-start gap-2 max-w-[75%]">
                    <span className="text-slate-400 font-semibold">{it.qty}x</span>
                    <div>
                      <span className="text-slate-700">{it.name}</span>
                      {it.addons && it.addons.length > 0 && (
                        <span className="block text-[10px] text-slate-400">+ {it.addons.map((a) => a.label).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">{rupees(it.price * it.qty)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2.5 space-y-1.5 border-b border-dashed border-slate-200 text-xs font-mono">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>SUBTOTAL</span>
                <span>{rupees(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>DISCOUNT</span>
                  <span>−{rupees(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 font-medium">
                <span>TAXES (5%)</span>
                <span>{rupees(order.tax)}</span>
              </div>
              <div className="flex justify-between text-xs font-black text-slate-900 pt-0.5">
                <span>TOTAL PAID</span>
                <span>{rupees(order.total)}</span>
              </div>
            </div>

            {/* Footer details */}
            <div className="pt-2.5 text-center space-y-2 font-mono">
              <div className="text-[9px] text-slate-400 leading-normal">
                PAYMENT: {order.paymentMethod === "COD" ? "CASH ON PICKUP" : "ONLINE (UPI)"} | {order.paymentStatus.toUpperCase()}
              </div>
              
              <div className="text-[10px] font-bold text-slate-600 tracking-wider">
                *** THANK YOU FOR ORDERING ***
              </div>

              {/* Decorative Barcode */}
              <div className="flex flex-col items-center justify-center opacity-80 pt-1 print:hidden">
                <svg className="h-5 w-36 text-slate-800" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <rect x="0" y="0" width="2" height="20" fill="currentColor" />
                  <rect x="3" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="6" y="0" width="4" height="20" fill="currentColor" />
                  <rect x="12" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="15" y="0" width="2" height="20" fill="currentColor" />
                  <rect x="19" y="0" width="3" height="20" fill="currentColor" />
                  <rect x="24" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="27" y="0" width="5" height="20" fill="currentColor" />
                  <rect x="34" y="0" width="2" height="20" fill="currentColor" />
                  <rect x="38" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="41" y="0" width="3" height="20" fill="currentColor" />
                  <rect x="46" y="0" width="2" height="20" fill="currentColor" />
                  <rect x="50" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="53" y="0" width="4" height="20" fill="currentColor" />
                  <rect x="59" y="0" width="2" height="20" fill="currentColor" />
                  <rect x="63" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="66" y="0" width="3" height="20" fill="currentColor" />
                  <rect x="71" y="0" width="5" height="20" fill="currentColor" />
                  <rect x="78" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="81" y="0" width="2" height="20" fill="currentColor" />
                  <rect x="85" y="0" width="3" height="20" fill="currentColor" />
                  <rect x="90" y="0" width="1" height="20" fill="currentColor" />
                  <rect x="93" y="0" width="2" height="20" fill="currentColor" />
                  <rect x="97" y="0" width="3" height="20" fill="currentColor" />
                </svg>
                <span className="text-[8px] font-mono tracking-widest text-slate-400 mt-0.5">{order.orderNumber}</span>
              </div>
            </div>
          </div>
          
          <JaggedEdgeBottom />
        </div>

        {/* Buttons / Actions */}
        <div className="mt-4 space-y-2 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Link to={`/track/${order.orderNumber}`} className="block">
              <Button className="w-full h-9 text-[11px] font-semibold rounded-lg bg-brand-500 hover:bg-brand-600 text-white shadow-sm">
                Track Order
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              className="w-full h-9 text-[11px] font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1"
              onClick={downloadTextReceipt}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Get Receipt</span>
            </Button>
          </div>

          <div className="flex justify-between items-center px-1 text-[10px] text-slate-400">
            <button 
              onClick={() => window.print()}
              className="hover:text-slate-600 hover:underline flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              <span>Download PDF</span>
            </button>

            <Link to="/" className="hover:text-brand-600 hover:underline inline-flex items-center gap-0.5">
              <ArrowLeft className="h-2.5 w-2.5" />
              <span>Other vendor</span>
            </Link>
          </div>
        </div>

      </div>

      <footer className="w-full mt-auto py-3 border-t border-slate-200/40 bg-white/30 backdrop-blur-sm text-center text-[9px] text-slate-400 font-mono tracking-wide print:hidden">
        <div>© {new Date().getFullYear()} PreSnag Technologies. All rights reserved.</div>
        <div className="mt-0.5 text-slate-400/60 font-sans text-[8px]">Powering instant order-ahead & queue-free pickups.</div>
      </footer>
    </div>
  );
}
