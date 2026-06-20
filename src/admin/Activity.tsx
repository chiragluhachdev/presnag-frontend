import { useQuery } from "@tanstack/react-query";
import { MessageCircle, CheckCircle2, XCircle, Bell, Ban, Store, User } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, Spinner } from "@/components/ui";
import { timeAgo, cn } from "@/lib/utils";
import { PageHeader } from "./Overview";

interface Activity {
  _id: string;
  type: "vendor_alert" | "confirmation" | "declined" | "cancellation";
  channel: string;
  audience: "customer" | "vendor";
  status: "sent" | "failed";
  orderNumber?: string;
  vendorName?: string;
  customerName?: string;
  recipient?: string;
  detail?: string;
  createdAt: string;
}

const META: Record<Activity["type"], { label: string; icon: any; color: string }> = {
  vendor_alert: { label: "Vendor alerted", icon: Bell, color: "text-blue-600 bg-blue-50" },
  confirmation: { label: "Order confirmed", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
  declined: { label: "Order declined", icon: Ban, color: "text-rose-600 bg-rose-50" },
  cancellation: { label: "Order cancelled", icon: XCircle, color: "text-amber-600 bg-amber-50" },
};

export default function Activity() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-activities"],
    queryFn: () => api<Activity[]>("/api/admin/activities?limit=200", { auth: true }),
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" subtitle="Every WhatsApp notification sent across the platform." />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
          No notifications yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Vendor</th>
                <th className="px-5 py-3">Sent to</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((a) => {
                const meta = META[a.type] || META.confirmation;
                return (
                  <tr key={a._id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.color)}>
                          <meta.icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="font-semibold text-slate-800">{meta.label}</div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <MessageCircle className="h-3 w-3" /> WhatsApp
                            {a.audience === "vendor" ? <><Store className="ml-1 h-3 w-3" /> vendor</> : <><User className="ml-1 h-3 w-3" /> customer</>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs font-bold text-slate-700">{a.orderNumber || "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{a.vendorName || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="text-slate-700">{a.recipient || "—"}</div>
                      {a.customerName && a.audience === "customer" && <div className="text-[11px] text-slate-400">{a.customerName}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge color={a.status === "sent" ? "green" : "red"}>{a.status}</Badge>
                      {a.status === "failed" && a.detail && (
                        <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-rose-400" title={a.detail}>{a.detail}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">{timeAgo(a.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
