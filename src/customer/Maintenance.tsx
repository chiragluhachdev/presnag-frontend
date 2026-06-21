import { Wrench, Phone, Mail, ShieldCheck } from "lucide-react";

const SUPPORT_EMAIL = "support@presnag.com";
const OWNER_PHONE = "8130809374";

export default function Maintenance() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-50 px-4 py-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
        {/* Brand */}
        <p className="text-base font-black tracking-tight">
          <span className="text-slate-900">Pre</span><span className="text-brand-500">Snag</span>
        </p>

        {/* Icon */}
        <div className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Wrench className="h-6 w-6" />
        </div>

        <h1 className="mt-3 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
          🚧 We're Making PreSnag Better
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-500">
          PreSnag is undergoing scheduled maintenance to improve performance, reliability, and your
          overall experience. <span className="font-semibold text-slate-700">We'll be back online shortly.</span>
        </p>
        <p className="mt-2 text-[12px] text-slate-400">
          Thank you for your patience — Team PreSnag
        </p>

        {/* Payment / refund reassurance */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-left">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-[12px] leading-relaxed text-emerald-800">
            Recently paid? Don't worry — any successful payment not processed due to maintenance is{" "}
            <span className="font-semibold">automatically refunded</span> to your original payment
            method within <span className="font-semibold">12 hours</span>.
          </p>
        </div>

        {/* Contact support */}
        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Need help? Contact support
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.99]"
          >
            <Mail className="h-4 w-4" /> Email us
          </a>
          <a
            href={`tel:${OWNER_PHONE}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-600 active:scale-[0.99]"
          >
            <Phone className="h-4 w-4" /> Call us
          </a>
        </div>

        <p className="mt-4 text-[10px] text-slate-400">
          © {new Date().getFullYear()} PreSnag. All rights reserved.
        </p>
      </div>
    </div>
  );
}
