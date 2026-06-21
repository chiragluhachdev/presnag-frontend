import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee, Percent, Wallet, TrendingUp, Receipt, Download, Search,
  ShoppingBag, Calculator, Clock, CheckCircle2, Store, Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PageHeader, SettlementsPanel } from "./Overview";

// Money with 2 decimals (finance precision).
const m = (n: number) =>
  `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
interface FinanceRow {
  orderNumber: string;
  vendorName: string;
  createdAt: string;
  paymentMethod: string;
  customerPaid: number;
  platformFee: number;
  vendorGets: number;
  status: "Pending" | "Paid";
}
interface VendorRollup {
  vendorName: string;
  orders: number;
  collection: number;
  commission: number;
  payout: number;
}
interface FinanceData {
  from: string;
  to: string;
  feeRatePct: number;
  rows: FinanceRow[];
  byVendor: VendorRollup[];
  totals: {
    collection: number;
    platformCommission: number;
    vendorPayoutDue: number;
    netProfit: number;
    orders: number;
    avgOrderValue: number;
    settledPayout: number;
    pendingPayout: number;
  };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function shiftDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type PresetKey = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

function rangeForPreset(key: PresetKey): { from: string; to: string } {
  const today = new Date();
  switch (key) {
    case "yesterday": {
      const y = shiftDays(today, -1);
      return { from: iso(y), to: iso(y) };
    }
    case "7d":
      return { from: iso(shiftDays(today, -6)), to: iso(today) };
    case "30d":
      return { from: iso(shiftDays(today, -29)), to: iso(today) };
    case "month":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    case "today":
    default:
      return { from: iso(today), to: iso(today) };
  }
}

function downloadCsv(filename: string, rows: FinanceRow[]) {
  const head = ["Order", "Vendor", "Date", "Time", "Payment", "Customer Paid", "Platform Fee", "Vendor Gets", "Status"];
  const body = rows.map((r) => {
    const d = new Date(r.createdAt);
    return [
      r.orderNumber, r.vendorName, d.toLocaleDateString(), d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      r.paymentMethod, r.customerPaid, r.platformFee, r.vendorGets, r.status,
    ];
  });
  const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [head, ...body].map((row) => row.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Finance() {
  const [preset, setPreset] = useState<PresetKey>("today");
  const [range, setRange] = useState(() => rangeForPreset("today"));
  const [query, setQuery] = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-finance", range.from, range.to],
    queryFn: () => api<FinanceData>(`/api/admin/finance?from=${range.from}&to=${range.to}`, { auth: true }),
  });

  function applyPreset(key: PresetKey) {
    setPreset(key);
    if (key !== "custom") setRange(rangeForPreset(key));
  }
  function setCustom(field: "from" | "to", value: string) {
    setPreset("custom");
    setRange((r) => {
      const next = { ...r, [field]: value };
      if (next.from > next.to) next.to = next.from; // keep from <= to
      return next;
    });
  }

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter(
      (r) => r.vendorName.toLowerCase().includes(q) || r.orderNumber.toLowerCase().includes(q)
    );
  }, [data, query]);

  const rangeLabel =
    data && data.from === data.to
      ? new Date(data.from).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : data
      ? `${new Date(data.from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(data.to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Finance" subtitle="Collections, commission and vendor payouts across any date range." />
        {data && (
          <button
            onClick={() => downloadCsv(`presnag-finance_${data.from}_to_${data.to}.csv`, filteredRows)}
            disabled={filteredRows.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        )}
      </div>

      {/* ---- Date range toolbar ---- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                preset === p.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setCustom("from", e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              max={iso(new Date())}
              onChange={(e) => setCustom("to", e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            {isFetching && <Spinner className="h-4 w-4 text-slate-400" />}
          </div>
        </div>
        {data && (
          <p className="mt-3 text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600">{rangeLabel}</span> · {data.totals.orders} paid order{data.totals.orders === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : (
        <>
          {/* ---- Primary totals ---- */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TotalCard icon={IndianRupee} label="Total Collection" value={m(data.totals.collection)} sub={`${data.totals.orders} paid order${data.totals.orders === 1 ? "" : "s"}`} />
            <TotalCard icon={Percent} label={`PreSnag Commission (${data.feeRatePct}%)`} value={m(data.totals.platformCommission)} sub="Gross platform earnings" tone="indigo" />
            <TotalCard icon={Wallet} label="Vendor Payout Due" value={m(data.totals.vendorPayoutDue)} sub="Total owed to vendors" tone="amber" />
            <TotalCard icon={TrendingUp} label="Net Profit" value={m(data.totals.netProfit)} sub="Commission kept by PreSnag" highlight />
          </div>

          {/* ---- Secondary metrics ---- */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat icon={ShoppingBag} label="Paid Orders" value={String(data.totals.orders)} />
            <MiniStat icon={Calculator} label="Avg Order Value" value={m(data.totals.avgOrderValue)} />
            <MiniStat icon={Clock} label="Pending Payout" value={m(data.totals.pendingPayout)} tone="amber" />
            <MiniStat icon={CheckCircle2} label="Settled Payout" value={m(data.totals.settledPayout)} tone="emerald" />
          </div>

          {/* ---- Per-vendor breakdown ---- */}
          {data.byVendor.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <Store className="h-4 w-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-900">By Vendor</h3>
                <span className="ml-auto text-xs text-slate-400">{data.byVendor.length} vendor{data.byVendor.length === 1 ? "" : "s"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-2.5">Vendor</th>
                      <th className="px-3 py-2.5 text-right">Orders</th>
                      <th className="px-3 py-2.5 text-right">Collection</th>
                      <th className="px-3 py-2.5 text-right">Commission</th>
                      <th className="px-5 py-2.5 text-right">Vendor Gets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.byVendor.map((v) => (
                      <tr key={v.vendorName} className="hover:bg-slate-50/50">
                        <td className="px-5 py-2.5 font-semibold text-slate-800">{v.vendorName}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{v.orders}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{m(v.collection)}</td>
                        <td className="px-3 py-2.5 text-right text-indigo-600">{m(v.commission)}</td>
                        <td className="px-5 py-2.5 text-right font-bold text-emerald-700">{m(v.payout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-vendor pending payouts — totals + one-click "settle all" per vendor. */}
          <SettlementsPanel />

          {/* ---- Per-order table ---- */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <Receipt className="h-4 w-4 text-brand-500" />
              <h3 className="text-sm font-bold text-slate-900">Orders</h3>
              <span className="text-xs text-slate-400">{rangeLabel}</span>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vendor or order…"
                  className="h-8 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            {filteredRows.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-400">
                {data.rows.length === 0 ? "No paid orders in this range." : "No orders match your search."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-2.5">Order</th>
                      <th className="px-3 py-2.5">Vendor</th>
                      <th className="px-3 py-2.5">Pay</th>
                      <th className="px-3 py-2.5 text-right">Customer Paid</th>
                      <th className="px-3 py-2.5 text-right">Platform Fee ({data.feeRatePct}%)</th>
                      <th className="px-3 py-2.5 text-right">Vendor Gets</th>
                      <th className="px-5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRows.map((r) => (
                      <tr key={r.orderNumber} className="hover:bg-slate-50/50">
                        <td className="px-5 py-2.5">
                          <div className="font-mono text-xs font-bold text-slate-800">{r.orderNumber}</div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(r.createdAt).toLocaleDateString([], { day: "2-digit", month: "short" })}{" "}
                            {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{r.vendorName}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            r.paymentMethod === "COD" ? "bg-slate-100 text-slate-600" : "bg-sky-100 text-sky-700"
                          )}>{r.paymentMethod === "COD" ? "COD" : "Online"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{m(r.customerPaid)}</td>
                        <td className="px-3 py-2.5 text-right text-indigo-600">− {m(r.platformFee)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{m(r.vendorGets)}</td>
                        <td className="px-5 py-2.5">
                          <span className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            r.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-100 bg-slate-50/60 text-sm font-bold">
                    <tr>
                      <td className="px-5 py-3 text-slate-500" colSpan={3}>
                        Totals {query && <span className="font-normal text-slate-400">(filtered)</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-900">{m(filteredRows.reduce((s, r) => s + r.customerPaid, 0))}</td>
                      <td className="px-3 py-3 text-right text-indigo-600">− {m(filteredRows.reduce((s, r) => s + r.platformFee, 0))}</td>
                      <td className="px-3 py-3 text-right text-emerald-700">{m(filteredRows.reduce((s, r) => s + r.vendorGets, 0))}</td>
                      <td className="px-5 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-slate-400">
            PreSnag's {data.feeRatePct}% commission is the only deduction per order; the vendor receives the
            remaining {100 - data.feeRatePct}%. Use the Vendor Settlements panel above to mark a vendor's pending payout as settled.
          </p>
        </>
      )}
    </div>
  );
}

function TotalCard({
  icon: Icon, label, value, sub, highlight, tone,
}: { icon: any; label: string; value: string; sub: string; highlight?: boolean; tone?: "rose" | "indigo" | "amber" }) {
  const toneCls = { rose: "text-rose-600", indigo: "text-indigo-600", amber: "text-amber-600" }[tone || "amber"];
  return (
    <div className={cn(
      "rounded-2xl border p-5 shadow-sm transition hover:shadow-md",
      highlight ? "border-transparent bg-gradient-to-br from-emerald-500 to-emerald-600 text-white" : "border-slate-200 bg-white"
    )}>
      <div className={cn("flex items-center gap-2 text-xs font-medium", highlight ? "text-emerald-50" : "text-slate-500")}>
        <Icon className={cn("h-4 w-4", highlight ? "" : tone ? toneCls : "")} /> {label}
      </div>
      <div className={cn("mt-2 text-2xl font-extrabold", highlight ? "text-white" : "text-slate-900")}>{value}</div>
      <div className={cn("mt-0.5 text-[11px]", highlight ? "text-emerald-50/80" : "text-slate-400")}>{sub}</div>
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: string; tone?: "amber" | "emerald" }) {
  const toneCls = tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-400";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50", toneCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-slate-500">{label}</div>
        <div className="truncate text-lg font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
