import { useState, useEffect, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Volume2, VolumeX, Phone, StickyNote, Check, X, Timer, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Order, OrderStatus } from "@/lib/types";
import { useSound } from "@/store/soundStore";
import { Button, Badge, Spinner } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { rupees, timeAgo, cn } from "@/lib/utils";
import { waConfirmUrl, waCancelUrl } from "@/lib/whatsapp";
import { VendorHeader } from "./Dashboard";
import { playClickSound } from "@/lib/sound";

type TabKey = "active" | "ready" | "completed";
const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
];

// Next action per status. Flow: Accept → Mark Ready → Mark Delivered (no "preparing" step).
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  accepted: { to: "ready", label: "Mark Ready" },
  ready: { to: "collected", label: "Mark Delivered" },
};

const statusColor: Record<OrderStatus, any> = {
  received: "orange",
  accepted: "blue",
  preparing: "purple",
  ready: "green",
  collected: "slate",
  cancelled: "red",
};

// Must match the backend AUTO_CANCEL_SECONDS — a new order auto-declines if the
// vendor doesn't respond within this window.
const AUTO_CANCEL_SECONDS = 180;

// "preparing" is legacy (old orders) — treated as active for backward compatibility.
const isActive = (o: Order) => o.status === "received" || o.status === "accepted" || o.status === "preparing";
const isReady = (o: Order) => o.status === "ready";
const isCompleted = (o: Order) => o.status === "collected";

export default function Orders() {
  const qc = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["vendor-orders"],
    queryFn: () => api<Order[]>(`/api/vendor/orders?status=all`, { auth: true }),
  });

  async function updateStatus(id: string, status: OrderStatus, reason?: string) {
    if (useSound.getState().enabled) playClickSound();
    // Optimistic: move the card instantly (no waiting for the network round-trip).
    const prev = qc.getQueryData<Order[]>(["vendor-orders"]);
    qc.setQueryData<Order[]>(["vendor-orders"], (old) =>
      (old || []).map((o) => (o._id === id ? { ...o, status } : o))
    );
    if (status === "accepted") toast.success("Order accepted");
    if (status === "ready") toast.success("Marked ready for pickup");
    if (status === "collected") toast.success("Order delivered");
    if (status === "cancelled") toast.success("Order declined");
    try {
      await api(`/api/vendor/orders/${id}/status`, {
        method: "PATCH",
        body: { status, ...(reason ? { reason } : {}) },
        auth: true,
      });
      qc.invalidateQueries({ queryKey: ["vendor-orders"] });
      qc.invalidateQueries({ queryKey: ["vendor-stats"] });
    } catch (e: any) {
      // Roll back the optimistic change on failure.
      if (prev) qc.setQueryData(["vendor-orders"], prev);
      toast.error(e.message);
    }
  }

  const vm: OrdersView = { orders, isLoading, updateStatus };

  return (
    <>
      {/* Mobile / tablet — tabbed single column */}
      <div className="lg:hidden">
        <OrdersMobile {...vm} />
      </div>
      {/* Desktop — split board */}
      <div className="hidden lg:block">
        <OrdersDesktop {...vm} />
      </div>
    </>
  );
}

interface OrdersView {
  orders: Order[] | undefined;
  isLoading: boolean;
  updateStatus: (id: string, status: OrderStatus, reason?: string) => void;
}

/** Live mm:ss left before a new order auto-declines. */
function useAutoCancelCountdown(createdAt: string) {
  const deadline = new Date(createdAt).getTime() + AUTO_CANCEL_SECONDS * 1000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, deadline - now);
  const secs = Math.ceil(ms / 1000);
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return { secs, expired: ms <= 0, label };
}

function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <Button variant="outline" size="sm" onClick={toggle}>
      {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      <span className="hidden sm:inline">{enabled ? "Sound On" : "Sound Off"}</span>
    </Button>
  );
}

function EmptyState({ label = "No orders here." }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
      {label}
    </div>
  );
}

/* ---------------- MOBILE — app-style, single column, sticky tabs ---------------- */
function OrdersMobile({ orders, isLoading, updateStatus }: OrdersView) {
  const [tab, setTab] = useState<TabKey>("active");
  const filter = tab === "active" ? isActive : tab === "ready" ? isReady : isCompleted;
  const list = (orders || []).filter(filter);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <VendorHeader title="Orders" subtitle="Tap a card to update its status." />
        <SoundToggle />
      </div>

      {/* Sticky tabs under the mobile top bar */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const n = (orders || []).filter(t.key === "active" ? isActive : t.key === "ready" ? isReady : isCompleted).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                  tab === t.key
                    ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                )}
              >
                {t.label}{n > 0 && <span className="ml-1.5 opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <OrderCard key={o._id} o={o} onUpdate={updateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- DESKTOP — split board: Active | Ready (+ Completed toggle) ---------------- */
function OrdersDesktop({ orders, isLoading, updateStatus }: OrdersView) {
  const [showCompleted, setShowCompleted] = useState(false);
  const active = (orders || []).filter(isActive);
  const ready = (orders || []).filter(isReady);
  const completed = (orders || []).filter(isCompleted);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <VendorHeader title="Orders" subtitle="Live order board — accept, mark ready, then delivered." />
        <div className="flex items-center gap-2">
          <Button
            variant={showCompleted ? undefined : "outline"}
            size="sm"
            onClick={() => setShowCompleted((s) => !s)}
          >
            {showCompleted ? "← Back to board" : `Completed (${completed.length})`}
          </Button>
          <SoundToggle />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : showCompleted ? (
        completed.length === 0 ? (
          <EmptyState label="No completed orders yet." />
        ) : (
          <div className="grid gap-5 2xl:grid-cols-2">
            {completed.map((o) => (
              <OrderCard key={o._id} o={o} onUpdate={updateStatus} />
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <Column title="Active" subtitle="New & accepted orders" count={active.length} accent="brand" empty="No active orders right now.">
            {active.map((o) => (
              <OrderCard key={o._id} o={o} onUpdate={updateStatus} />
            ))}
          </Column>
          <Column title="Ready for Pickup" subtitle="Awaiting collection" count={ready.length} accent="green" empty="Nothing ready yet.">
            {ready.map((o) => (
              <OrderCard key={o._id} o={o} onUpdate={updateStatus} />
            ))}
          </Column>
        </div>
      )}
    </div>
  );
}

function Column({
  title, subtitle, count, accent, empty, children,
}: { title: string; subtitle: string; count: number; accent: "brand" | "green"; empty: string; children: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 shadow-sm">
      <div className={cn("flex items-center justify-between px-4 py-3 text-white", accent === "green" ? "bg-emerald-500" : "bg-brand-500")}>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="text-[11px] text-white/80">{subtitle}</div>
        </div>
        <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-white/25 px-2 text-sm font-bold">{count}</span>
      </div>
      <div className="min-h-[220px] max-h-[calc(100vh-240px)] flex-1 space-y-3 overflow-y-auto p-3">
        {count === 0 ? <div className="py-14 text-center text-sm text-slate-400">{empty}</div> : children}
      </div>
    </div>
  );
}

function OrderCard({ o, onUpdate }: { o: Order; onUpdate: (id: string, s: OrderStatus, reason?: string) => void }) {
  const next = NEXT[o.status];
  const isNew = o.status === "received";
  const canCancel = o.status !== "collected" && o.status !== "cancelled";
  const countdown = useAutoCancelCountdown(o.createdAt);

  function decline() {
    if (confirm(`Decline order ${o.orderNumber}? The customer will be notified.`)) {
      onUpdate(o._id, "cancelled");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition",
        isNew ? "border-brand-300 ring-2 ring-brand-200" : "border-slate-200"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{o.orderNumber}</span>
            {isNew && (
              <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                New
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                o.orderType === "TAKE_AWAY" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
              )}
            >
              {o.orderType === "TAKE_AWAY" ? "Take Away" : "Dine In"}
            </span>
          </div>
          <div className="text-xs text-slate-400">{timeAgo(o.createdAt)}</div>
        </div>
        <Badge color={statusColor[o.status]}>
          {o.status === "collected" ? "delivered" : o.status}
        </Badge>
      </div>

      {/* Customer + call */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{o.customerName}</div>
          <div className="text-xs text-slate-400">{o.customerPhone}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={o.status === "cancelled" ? waCancelUrl(o) : waConfirmUrl(o)}
            target="_blank"
            rel="noopener noreferrer"
            title={o.status === "cancelled" ? "Send cancellation message on WhatsApp" : "Send confirmation on WhatsApp"}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-emerald-50"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <a
            href={`tel:${o.customerPhone}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-brand-50"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        </div>
      </div>

      {/* Items */}
      <div className="mt-3 space-y-1.5">
        {o.items.map((it, i) => (
          <div key={i}>
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-slate-700">
                <span className="font-semibold text-brand-600">{it.qty}×</span> {it.name}
              </span>
              <span className="shrink-0 text-slate-500">{rupees(it.price * it.qty)}</span>
            </div>
            {it.addons && it.addons.length > 0 && (
              <div className="mt-0.5 text-xs text-slate-500">+ {it.addons.map((a) => a.label).join(", ")}</div>
            )}
            {it.instructions && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                <StickyNote className="h-3 w-3 shrink-0" /> {it.instructions}
              </div>
            )}
          </div>
        ))}
      </div>

      {o.note && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">Note: {o.note}</p>
      )}

      {/* Total */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-400">{o.paymentMethod} · {o.paymentStatus}</span>
        <span className="text-lg font-extrabold text-slate-900">{rupees(o.total)}</span>
      </div>

      {/* Actions */}
      {isNew ? (
        <div className="mt-3">
          {/* Auto-decline countdown */}
          <div
            className={cn(
              "mb-2 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
              countdown.secs <= 15 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
            )}
          >
            <Timer className="h-3.5 w-3.5" />
            {countdown.expired ? "Auto-declining…" : `Respond within ${countdown.label} — auto-declines after`}
          </div>
          <div className="flex gap-2">
            <Button className="h-11 flex-1" onClick={() => onUpdate(o._id, "accepted")}>
              <Check className="h-4 w-4" /> Accept
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1 border-red-200 text-red-600 hover:bg-red-50"
              onClick={decline}
            >
              <X className="h-4 w-4" /> Decline
            </Button>
          </div>
        </div>
      ) : (
        (next || canCancel) && (
          <div className="mt-3 flex gap-2">
            {next && (
              <Button className="h-10 flex-1" onClick={() => onUpdate(o._id, next.to)}>
                {next.label}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="h-10"
                onClick={() => {
                  if (confirm(`Cancel order ${o.orderNumber}?`)) onUpdate(o._id, "cancelled");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
