import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Tag, Loader2, ShoppingCart, CheckCircle2, Store, Clock, ShieldCheck, User, Phone, FileText, Circle, Smartphone, Utensils, ShoppingBag, Banknote, Lock, ChevronUp, ChevronRight, X, CreditCard, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Order, Vendor } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { Input, Button, Label, Textarea, Card } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useCart } from "@/store/cartStore";
import { DemoBanner } from "@/components/DemoBanner";
import { loadCashfreeSdk, CASHFREE_MODE } from "@/lib/cashfree";
import { loadRazorpaySdk } from "@/lib/razorpay";
import { rupees, cn } from "@/lib/utils";

/** Compact UPI logo chip (red/green arrows + blue "UPI"). */
function UpiBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-[3px] border border-slate-200 bg-white px-1 py-[1px] align-middle shadow-sm">
      <span className="text-[8px] font-black leading-none tracking-wider text-[#0C5BA8]">UPI</span>
      <svg className="h-2 w-auto" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="1,1 5,6 1,11 4,11 8,6 4,1" fill="#E15457" />
        <polygon points="6,1 10,6 6,11 9,11 13,6 9,1" fill="#33A86A" />
      </svg>
    </span>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const cart = useCart();

  const { data: vendorData, isLoading: loadingVendor } = useQuery({
    queryKey: ["vendor", cart.vendorSlug],
    queryFn: () => api<{ vendor: Vendor }>(`/api/public/vendors/${cart.vendorSlug}`),
    enabled: !!cart.vendorSlug,
  });

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => api<{ paymentsDisabled?: boolean; codEnabled?: boolean }>("/api/public/settings"),
  });

  const isStoreClosed = vendorData ? !vendorData.vendor.isOpen : false;
  const paymentsDisabled = !!settings?.paymentsDisabled;
  const codEnabled = !!settings?.codEnabled;

  // Which order types this restaurant offers (default both).
  const dineInEnabled = vendorData ? vendorData.vendor.dineInEnabled !== false : true;
  const takeAwayEnabled = vendorData ? vendorData.vendor.takeAwayEnabled !== false : true;
  const orderTypeOptions = (
    [
      dineInEnabled && { key: "DINE_IN" as const, label: "Dine In", emoji: "🍽️" },
      takeAwayEnabled && { key: "TAKE_AWAY" as const, label: "Pick Up", emoji: "🛍️" },
    ].filter(Boolean) as { key: "DINE_IN" | "TAKE_AWAY"; label: string; emoji: string }[]
  );
  // Safety: if a vendor disabled both, still show both so ordering isn't blocked.
  const shownOrderTypes = orderTypeOptions.length
    ? orderTypeOptions
    : ([
        { key: "DINE_IN", label: "Dine In", emoji: "🍽️" },
        { key: "TAKE_AWAY", label: "Pick Up", emoji: "🛍️" },
      ] as const);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<"COD" | "RAZORPAY">("RAZORPAY");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKE_AWAY">("DINE_IN");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  // Display-level choice. UPI/Cards/Wallet all route through the online gateway
  // (Razorpay supports them all); COD is the only non-online one.
  const [payChoice, setPayChoice] = useState<"UPI" | "CARDS" | "WALLET" | "COD">("UPI");

  function choosePay(choice: "UPI" | "CARDS" | "WALLET" | "COD") {
    setPayChoice(choice);
    setMethod(choice === "COD" ? "COD" : "RAZORPAY");
    setPayOpen(false);
  }

  // Keep the selected order type to one the restaurant actually offers.
  useEffect(() => {
    if (orderType === "DINE_IN" && !dineInEnabled && takeAwayEnabled) setOrderType("TAKE_AWAY");
    else if (orderType === "TAKE_AWAY" && !takeAwayEnabled && dineInEnabled) setOrderType("DINE_IN");
  }, [dineInEnabled, takeAwayEnabled, orderType]);

  // If the admin turns COD off while it's selected, fall back to online payment.
  useEffect(() => {
    if (!codEnabled && (method === "COD" || payChoice === "COD")) {
      setMethod("RAZORPAY");
      setPayChoice("UPI");
    }
  }, [codEnabled, method, payChoice]);

  const subtotal = cart.subtotal();
  const total = subtotal - discount;
  const itemCount = cart.lines.reduce((n, l) => n + l.qty, 0);
  const prepTime = vendorData?.vendor.prepTime;

  if (cart.lines.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <SiteHeader />
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-32 px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Your cart is empty</h2>
          <p className="text-sm text-slate-500">Looks like you haven't added anything to your cart yet.</p>
          <Link to="/" className="mt-2">
            <Button>Browse vendors</Button>
          </Link>
        </div>
      </div>
    );
  }

  async function applyCoupon() {
    if (!coupon.trim()) return;
    try {
      const res = await api<{ code: string; discount: number }>(
        `/api/public/vendors/${cart.vendorSlug}/coupon`,
        { method: "POST", body: { code: coupon, subtotal } }
      );
      setDiscount(res.discount);
      setAppliedCode(res.code);
      toast.success(`Coupon ${res.code} applied — ${rupees(res.discount)} off`);
    } catch (e: any) {
      setDiscount(0);
      setAppliedCode("");
      toast.error(e.message || "Invalid coupon");
    }
  }

  async function placeOrder() {
    if (paymentsDisabled) {
      toast.error("Payments are temporarily disabled. Please try again later.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    setPlacing(true);

    try {
      const isCod = method === "COD" && codEnabled;

      // 1. Create the PreSnag order (unpaid until Cashfree confirms payment).
      const order = await api<Order>("/api/public/orders", {
        method: "POST",
        body: {
          slug: cart.vendorSlug,
          customerName: name,
          customerPhone: phone,
          note,
          orderType,
          paymentMethod: isCod ? "COD" : "CASHFREE",
          couponCode: appliedCode,
          items: cart.lines.map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            instructions: l.instructions,
            selectedOptions: (l.addons ?? []).map((a) => ({ group: a.group, label: a.label })),
          })),
        },
      });

      // Cash on Delivery — no gateway; the order is placed and the vendor alerted.
      if (isCod) {
        toast.success("Order placed! Pay at pickup.");
        cart.clear();
        navigate(`/order/${order.orderNumber}`, { replace: true });
        return;
      }

      // 2. Create the payment order with whichever gateway the admin enabled.
      const pay = await api<{
        provider: "CASHFREE" | "RAZORPAY";
        demo: boolean;
        paymentSessionId?: string;
        razorpayOrderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
      }>("/api/payments/order", { method: "POST", body: { orderNumber: order.orderNumber } });

      // Demo mode (gateway not configured) — simulate a successful payment.
      if (pay.demo) {
        await api("/api/payments/cashfree/demo-confirm", {
          method: "POST",
          body: { orderNumber: order.orderNumber },
        });
        navigate(`/order/${order.orderNumber}`, { replace: true });
        return;
      }

      // 3. Open the right gateway's checkout.
      if (pay.provider === "RAZORPAY") {
        const Razorpay = await loadRazorpaySdk();
        await new Promise<void>((resolve) => {
          const rzp = new Razorpay({
            key: pay.keyId,
            order_id: pay.razorpayOrderId,
            amount: pay.amount,
            currency: pay.currency || "INR",
            name: "PreSnag",
            description: `Order ${order.orderNumber}`,
            prefill: { name, contact: phone },
            theme: { color: "#f97316" },
            handler: (resp: any) => {
              // INSTANT: jump straight to the tracking screen and verify in the
              // background. The tracking page also re-verifies on arrival and the
              // webhook is the ultimate backup — so we never block the UI here.
              api("/api/payments/verify", {
                method: "POST",
                body: {
                  orderNumber: order.orderNumber,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  razorpayOrderId: resp.razorpay_order_id,
                  razorpaySignature: resp.razorpay_signature,
                },
              }).catch(() => {});
              cart.clear();
              navigate(`/order/${order.orderNumber}`, { state: { justPaid: true }, replace: true });
              resolve();
            },
            modal: {
              ondismiss: () => {
                // Payment cancelled — order stays unpaid; cart kept for retry.
                toast.error("Payment cancelled");
                navigate(`/order/${order.orderNumber}`, { replace: true });
                resolve();
              },
            },
          });
          rzp.open();
        });
        return;
      }

      // CASHFREE — hosted redirect; the order page confirms the payment.
      const Cashfree = await loadCashfreeSdk();
      const cashfree = Cashfree({ mode: CASHFREE_MODE });
      await cashfree.checkout({ paymentSessionId: pay.paymentSessionId, redirectTarget: "_self" });
      navigate(`/order/${order.orderNumber}`, { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 pt-2 pb-6 md:pt-4 md:pb-8">
        
        {/* Header */}
        <div className="mb-3 flex items-center gap-1.5 sm:gap-2">
          {/* Tweak the -top class below to shift the icon up/down as needed */}
          <ShieldCheck 
            className="relative -top-[2px] min-[375px]:-top-[3px] h-5 min-[375px]:h-6 w-5 min-[375px]:w-6 text-brand-500 shrink-0" 
            strokeWidth={2} 
          />
          <div className="leading-tight">
            <h1 className="text-base min-[375px]:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Secure Checkout
            </h1>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              Your order will be confirmed instantly
            </p>
          </div>
        </div>

        {/* Admin-controlled notice banner */}
        <DemoBanner placement="checkout" className="mb-4" />

        <div className="grid gap-4 md:grid-cols-12 md:gap-6">

          {/* Left Column: Forms */}
          <div className="space-y-3 md:col-span-7 md:space-y-4">
            
            {/* Contact Details */}
            <Card className="border-slate-200/60 shadow-sm p-3 min-[375px]:p-4 md:p-5">
              <div className="mb-3 min-[375px]:mb-4 flex items-center justify-between">
                <h3 className="text-sm min-[375px]:text-base font-semibold text-slate-900">Contact Details</h3>
                <User className="h-4 w-4 min-[375px]:h-5 min-[375px]:w-5 text-brand-500" />
              </div>
              <div className="space-y-3 min-[375px]:space-y-4">
                <div className="space-y-1 min-[375px]:space-y-1.5">
                  <Label className="text-[10px] min-[375px]:text-xs font-medium text-slate-700">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 min-[375px]:left-3 top-1/2 h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 -translate-y-1/2 text-slate-400" />
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="John Doe" 
                      className="h-9 min-[375px]:h-10 pl-8 min-[375px]:pl-9 text-xs min-[375px]:text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1 min-[375px]:space-y-1.5">
                  <Label className="text-[10px] min-[375px]:text-xs font-medium text-slate-700">Phone Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 min-[375px]:left-3 top-1/2 h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 -translate-y-1/2 text-slate-400" />
                    <Input 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      placeholder="10-digit mobile" 
                      type="tel"
                      className="h-9 min-[375px]:h-10 pl-8 min-[375px]:pl-9 text-xs min-[375px]:text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1 min-[375px]:space-y-1.5">
                  <Label className="text-[10px] min-[375px]:text-xs font-medium text-slate-700">Order Notes (Optional)</Label>
                  <div className="relative">
                    <FileText className="absolute left-2.5 min-[375px]:left-3 top-3 h-3.5 w-3.5 min-[375px]:h-4 min-[375px]:w-4 text-slate-400" />
                    <Textarea 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)} 
                      rows={2} 
                      placeholder="E.g., Please ensure the food is extra spicy..." 
                      className="resize-none pl-8 min-[375px]:pl-9 py-2 min-[375px]:py-2.5 text-xs min-[375px]:text-sm min-h-[40px] min-[375px]:min-h-[44px]"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Order Type */}
            <Card className="border border-slate-200 bg-white p-3.5 min-[375px]:p-4 shadow-sm">
              {/* Header */}
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="font-sans text-[13px] font-bold tracking-tight text-slate-900">
                  Order Type
                </h3>
                <Utensils className="h-3.5 w-3.5 text-brand-400" />
              </div>

              {/* Segmented Control */}
              <div className="flex rounded-lg bg-slate-100/80 p-1">
                {shownOrderTypes.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setOrderType(opt.key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-semibold tracking-tight transition-all duration-200 focus:outline-none min-[375px]:text-[13px]",
                      orderType === opt.key
                        ? "bg-white text-brand-600 shadow-sm ring-1 ring-brand-400/40"
                        : "text-slate-500 hover:bg-slate-200/30 hover:text-slate-700"
                    )}
                  >
                    {opt.key === "TAKE_AWAY" ? (
                      <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="text-[13px] leading-none">{opt.emoji}</span>
                    )}
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </Card>

          </div>

          {/* Right Column: Order Summary */}
          <div className="md:col-span-5">
  <Card className="sticky top-6 overflow-hidden border border-slate-200 bg-white shadow-sm">
    
    {/* Header */}
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
      <h3 className="text-sm font-bold tracking-tight text-slate-900">Order Summary</h3>
      <span className="text-xs font-medium text-slate-500">
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </span>
    </div>

    <div className="flex flex-col">
      {/* Vendor Info (Compact Row) */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Store className="h-3.5 w-3.5 text-brand-500" />
          <span className="font-semibold">{cart.vendorName}</span>
        </div>
        {prepTime != null && (
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="h-3.5 w-3.5" /> ~{prepTime} min
          </span>
        )}
      </div>

      {/* Line Items */}
      <div className="px-4 py-2 space-y-3">
        {cart.lines.map((l) => (
          <div key={l.lineKey} className="flex items-start justify-between gap-3 text-[13px]">
            <div className="flex min-w-0 items-start gap-2">
              <span className="w-5 shrink-0 pt-0.5 font-medium text-slate-500">
                {l.qty}x
              </span>
              <div className="min-w-0">
                <span className="font-semibold text-slate-800">{l.name}</span>
                {(l.addons ?? []).length > 0 && (
                  <div className="truncate text-xs text-slate-400 pt-0.5">
                    {(l.addons ?? []).map((a) => a.label).join(", ")}
                  </div>
                )}
              </div>
            </div>
            <span className="shrink-0 pt-0.5 font-medium text-slate-900">
              {rupees(l.price * l.qty)}
            </span>
          </div>
        ))}
      </div>

      {/* Billing Breakdown */}
      <div className="mx-4 mt-1 border-t border-slate-100 pt-3 pb-1 space-y-2 text-[13px]">
        <div className="flex justify-between text-slate-500">
          <span>Item Total</span>
          <span className="font-medium text-slate-700">{rupees(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Discount ({appliedCode})</span>
            <span className="font-medium">− {rupees(discount)}</span>
          </div>
        )}
      </div>

      {/* To Pay (Clean & Professional) */}
      <div className="mx-4 mt-2 mb-3 flex items-center justify-between border-t-2 border-slate-900 pt-3">
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-slate-900">To Pay</span>
          {discount > 0 && (
            <span className="text-[10px] font-medium text-emerald-600">
              Saved {rupees(discount)}
            </span>
          )}
        </div>
        <span className="text-base font-extrabold tracking-tight text-slate-900">
          {rupees(total)}
        </span>
      </div>

      {/* Footer Note */}
      <div className="bg-slate-50 py-2.5 px-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-500">
          <ShieldCheck className="h-3 w-3 text-emerald-500" /> 
          No extra charges — you only pay for your food.
        </p>
      </div>
      
    </div>
  </Card>
</div>
          
        </div>
      </div>

      {/* Sticky action bar — payment selector + Confirm, like Zomato/Swiggy */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-4xl border-t border-slate-200 bg-white px-3 py-2.5 shadow-[0_-6px_24px_rgba(0,0,0,0.08)] sm:px-4">
        {isStoreClosed ? (
          <div className="rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-800">🚫 Store is currently closed</div>
        ) : paymentsDisabled ? (
          <div className="rounded-lg bg-amber-50 p-3 text-center text-sm font-medium text-amber-800">⏸️ Payments are temporarily disabled. Please try again later.</div>
        ) : (
          <div className="relative flex items-stretch gap-3">
            {/* Payment selector */}
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="flex min-w-0 flex-1 flex-col justify-center text-left"
            >
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                <Lock className="h-2 w-2 text-emerald-500" /> Pay Using
                <ChevronUp className={cn("relative -top-[1px] left-[2px] h-3 w-3 text-slate-500 transition-transform", payOpen ? "rotate-180" : "")} />
              </span>
              <span className="flex items-center gap-1 truncate font-sans text-sm font-bold tracking-tight text-slate-700">
                {payChoice === "UPI" && <>Pay Online <UpiBadge /></>}
                {payChoice === "CARDS" && "Credit / Debit Cards"}
                {payChoice === "WALLET" && "Wallets"}
                {payChoice === "COD" && "Cash on Delivery"}
              </span>
              <span className="truncate text-[10px] text-slate-400">
                {payChoice === "UPI" && "GPay • PhonePe • Paytm • Cards"}
                {payChoice === "CARDS" && "Visa, Mastercard, RuPay & more"}
                {payChoice === "WALLET" && "Paytm, Mobikwik, Amazon Pay…"}
                {payChoice === "COD" && "Pay at pickup"}
              </span>
            </button>

            {/* Confirm */}
            <Button
              className="h-auto min-h-[54px] flex-[1.5] rounded-xl bg-brand-500 px-4 text-white shadow-md hover:bg-brand-600"
              onClick={placeOrder}
              disabled={placing || loadingVendor}
            >
              {placing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-1.5 font-sans text-[15px] font-bold leading-tight tracking-tight">
                  Confirm Order • {rupees(total)} <ChevronRight className="h-4 w-4 shrink-0" />
                </span>
              )}
            </Button>

          </div>
        )}
      </div>

      {/* Payment methods bottom-sheet */}
      {payOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setPayOpen(false)} />
          <div className="animate-sheet-up relative w-full max-w-4xl rounded-t-2xl bg-white px-4 pb-7 pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Payment Methods</h3>
              <button onClick={() => setPayOpen(false)} className="text-slate-400 transition hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Recommended</p>
            <div className="space-y-2">
              {([
                { key: "UPI", title: "UPI", sub: "GPay • PhonePe • Paytm & more", icon: Smartphone },
                { key: "CARDS", title: "Credit / Debit Cards", sub: "Visa, Mastercard, RuPay & more", icon: CreditCard },
                { key: "WALLET", title: "Wallets", sub: "Paytm, Mobikwik, Amazon Pay…", icon: Wallet },
                ...(codEnabled ? [{ key: "COD", title: "Cash on Delivery", sub: "Pay at pickup", icon: Banknote }] : []),
              ] as const).map((opt) => {
                const sel = payChoice === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => choosePay(opt.key as "UPI" | "CARDS" | "WALLET" | "COD")}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                      sel ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <opt.icon className={cn("h-5 w-5 shrink-0", sel ? "text-brand-600" : "text-slate-400")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        {opt.title}{opt.key === "UPI" && <UpiBadge />}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">{opt.sub}</div>
                    </div>
                    {sel ? <CheckCircle2 className="h-5 w-5 shrink-0 fill-brand-500 text-white" /> : <Circle className="h-5 w-5 shrink-0 text-slate-200" />}
                  </button>
                );
              })}

              {/* Cash (Pay Later) — coming soon (disabled). */}
              <button
                onClick={() => toast.error("Cash (Pay Later) isn't available yet.")}
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left opacity-70"
              >
                <Clock className="h-5 w-5 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                    Cash (Pay Later)
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">Soon</span>
                  </div>
                  <div className="truncate text-[11px] text-slate-400">Currently unavailable</div>
                </div>
                <Circle className="h-5 w-5 shrink-0 text-slate-200" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}