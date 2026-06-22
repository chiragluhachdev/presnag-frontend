import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, MapPin, Plus, Minus, ShoppingBag, ArrowLeft, Trash2, SlidersHorizontal, UtensilsCrossed, X, Info } from "lucide-react";
import { api } from "@/lib/api";
import { Vendor, Category, MenuItem, SelectedAddon } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { Button, Spinner, Badge, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { useCart } from "@/store/cartStore";
import { rupees, cn } from "@/lib/utils";

interface VendorData {
  vendor: Vendor;
  categories: Category[];
  items: MenuItem[];
}

export default function VendorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);
  
  // New states for redesign
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);

  const cart = useCart();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor", slug],
    queryFn: () => api<VendorData>(`/api/public/vendors/${slug}`),
    enabled: !!slug,
  });

  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const bannerHeight = bannerRef.current?.clientHeight || 288;
      setIsScrolled(window.scrollY > bannerHeight - 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll slightly down on load to scroll past the image part of the banner
  // leaving the back button and vendor name visible at the top.
  useEffect(() => {
    if (data && !isLoading) {
      setTimeout(() => {
        // Only auto-scroll if the user hasn't already scrolled down
        if (window.scrollY < 10) {
          const bannerHeight = bannerRef.current?.clientHeight || 288;
          const targetY = bannerHeight - 110;
          
          // Custom smooth scroll animation for a guaranteed smooth effect
          const startY = window.scrollY;
          const distance = targetY - startY;
          let startTime: number | null = null;
          const duration = 600; // 600ms duration for a faster but still smooth scroll

          const animationStep = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // easeInOutQuart easing function for a very smooth start and end
            const ease = progress < 0.5 
              ? 8 * progress * progress * progress * progress 
              : 1 - Math.pow(-2 * progress + 2, 4) / 2;
            
            window.scrollTo(0, startY + distance * ease);
            
            if (timeElapsed < duration) {
              window.requestAnimationFrame(animationStep);
            }
          };
          
          window.requestAnimationFrame(animationStep);
        }
      }, 1);
    }
  }, [data, isLoading]);

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (el) {
      // offset for sticky header + sticky search (~130px)
      const y = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    setMenuSheetOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Vendor not found.</p>
        <Link to="/" className="text-brand-600 underline">Back to home</Link>
      </div>
    );
  }

  const { vendor, categories, items } = data;
  const matchesQuery = (i: MenuItem) => !q || i.name.toLowerCase().includes(q.toLowerCase());
  const visibleItems = items.filter(matchesQuery);

  const catIds = new Set(categories.map((c) => c._id));
  const groupedSections = [
    ...categories.map((c) => ({ id: c._id, name: c.name, list: visibleItems.filter((i) => i.categoryId === c._id) })),
    { id: "__other", name: "More", list: visibleItems.filter((i) => !catIds.has(i.categoryId)) },
  ].filter((s) => s.list.length > 0);

  const subtotal = cart.subtotal();

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-slate-50 pb-28 lg:pb-0 relative">
      <SiteHeader />

      {/* 1. Normal Flow Banner (Scrolls away naturally) */}
      <div ref={bannerRef} className="relative w-full overflow-hidden h-72 sm:h-80 lg:h-96">
        {vendor.banner ? (
          <img src={vendor.banner} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand-500 to-orange-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <Link
            to="/shops"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-2xl font-extrabold drop-shadow-md sm:text-3xl">{vendor.name}</h1>
          <p className="mt-0.5 line-clamp-1 text-sm text-white/90">{vendor.description}</p>
        </div>
      </div>

      {/* 2. Sticky Info Strip & Search */}
      <div className="sticky top-0 z-30 flex w-full flex-col bg-white shadow-sm border-b border-slate-100">
        <div className="flex flex-col gap-2 px-4 py-3">
          {/* Compact Title (Shows when scrolled past banner) */}
          {isScrolled && (
            <div className="flex items-center gap-2 mb-1 animate-in fade-in slide-in-from-top-2">
              <Link to="/shops" className="text-slate-500 hover:text-slate-800"><ArrowLeft className="h-5 w-5" /></Link>
              <h1 className="text-lg font-bold text-slate-900 truncate">{vendor.name}</h1>
            </div>
          )}

          {/* Info Strip (Shows when NOT scrolled) */}
          {!isScrolled && (
            <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs text-slate-600 sm:text-sm animate-in fade-in">
              <div className="flex items-center gap-3 font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-slate-400" /> {vendor.prepTime} mins
                </span>
                {vendor.address && (
                  <span className="flex items-center gap-1 max-w-[150px] truncate sm:max-w-xs">
                    <MapPin className="h-4 w-4 text-slate-400" /> {vendor.address}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  vendor.isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", vendor.isOpen ? "bg-green-500" : "bg-red-500")} />
                {vendor.isOpen ? "Open" : "Closed"}
              </span>
            </div>
          )}

          {/* Sticky Search Bar */}
          <div className="mt-1 flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/50 px-3 py-2.5 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 transition-colors">
            <Search className="h-4 w-4 shrink-0 text-brand-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search in menu..."
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pt-4 md:px-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
          {/* Menu */}
          <div className="min-w-0 relative">
            {!vendor.isOpen && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800 flex items-start gap-2">
                <Info className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                <p>This store is currently closed. You cannot add items to your cart or place orders.</p>
              </div>
            )}

            {/* Items */}
            <div className="space-y-8">
              {groupedSections.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">No items found.</p>
              )}
              {groupedSections.map((section) => (
                <section key={section.id} id={`cat-${section.id}`} className="scroll-mt-36">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-slate-900">
                    {section.name}
                    <span className="text-sm font-semibold text-slate-400">({section.list.length})</span>
                  </h3>
                  {/* Changed to flex col for rows */}
                  <div className="flex flex-col gap-0 sm:gap-2">
                    {section.list.map((item) => (
                      <ItemCard key={item._id} item={item} vendor={vendor} onCustomize={setCustomizeItem} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {/* Cart (desktop) */}
          <div className="hidden lg:block relative">
            <div className="sticky top-32">
              <CartPanel onCheckout={() => navigate("/checkout")} isOpen={vendor.isOpen} />
            </div>
          </div>
        </div>
      </main>

      {/* Floating Menu Button */}
      {groupedSections.length > 0 && !q && (
        <button
          onClick={() => setMenuSheetOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8"
        >
          <UtensilsCrossed className="h-4 w-4" /> Menu
        </button>
      )}

      {/* Menu Bottom Sheet */}
      {menuSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setMenuSheetOpen(false)} />
          <div className="relative z-10 flex max-h-[70vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-lg font-extrabold text-slate-900">Menu</h3>
              <button onClick={() => setMenuSheetOpen(false)} className="rounded-full bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {groupedSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToCategory(section.id)}
                  className="flex w-full items-center justify-between rounded-xl p-4 text-left font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {section.name}
                  <span className="text-sm font-semibold text-slate-400">{section.list.length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile cart bar */}
      {cart.count() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:hidden">
          <Button 
            className="flex w-full items-center justify-between h-14 rounded-xl text-base bg-brand-600 hover:bg-brand-700" 
            size="lg" 
            onClick={() => setCartOpen(true)}
          >
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-medium text-brand-100">{cart.count()} ITEM{cart.count() > 1 ? 'S' : ''}</span>
              <span className="font-bold text-white">{rupees(subtotal)}</span>
            </div>
            <span className="flex items-center gap-1 font-bold text-white">
              View Cart <ArrowLeft className="h-4 w-4 rotate-180" />
            </span>
          </Button>
        </div>
      )}

      {/* Mobile cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] flex flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex-shrink-0 pt-4 pb-2 flex justify-center bg-white rounded-t-3xl border-b border-slate-100">
              <div className="h-1.5 w-12 rounded-full bg-slate-300 mb-2" />
              <button onClick={() => setCartOpen(false)} className="absolute right-4 top-4 rounded-full bg-slate-100 p-1 text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 pb-8 flex-1">
              <CartPanel onCheckout={() => navigate("/checkout")} isOpen={vendor.isOpen} />
            </div>
          </div>
        </div>
      )}

      {customizeItem && (
        <CustomizeModal
          item={customizeItem}
          onClose={() => setCustomizeItem(null)}
          onAdd={(addons) => {
            cart.add(vendor.slug, vendor.name, customizeItem, addons);
            setCustomizeItem(null);
          }}
        />
      )}
    </div>
  );
}

function ItemCard({
  item, vendor, onCustomize,
}: { item: MenuItem; vendor: Vendor; onCustomize: (item: MenuItem) => void }) {
  const cart = useCart();
  const hasCustom = (item.customizations?.length ?? 0) > 0;
  const plainLine = !hasCustom ? cart.lines.find((l) => l.lineKey === item._id) : undefined;
  const itemLines = cart.lines.filter((l) => l.itemId === item._id);
  const customQty = hasCustom ? itemLines.reduce((s, l) => s + l.qty, 0) : 0;

  function decrementCustom() {
    const last = itemLines[itemLines.length - 1];
    if (last) cart.setQty(last.lineKey, last.qty - 1);
  }

  // Determine current quantity for this item overall
  const qty = hasCustom ? customQty : (plainLine?.qty || 0);
  
  // Optional check for veg/non-veg tag if available. Zomato usually has a green/red dot.
  const isVegTag = (item as any).isVeg; // Cast to any to check if it might exist in data

  return (
    <div
      onClick={() => onCustomize(item)}
      className="flex w-full cursor-pointer items-start justify-between gap-4 border-b border-slate-200/60 bg-white pb-6 pt-4 px-2 sm:px-4 last:border-0 hover:bg-slate-50/50 transition-colors sm:rounded-xl sm:border"
    >
      {/* Left side: Info */}
      <div className="flex min-w-0 flex-1 flex-col pt-1">
        {isVegTag !== undefined && (
          <div className="flex items-center gap-2 mb-1">
            {isVegTag ? (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-green-600">
                 <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
              </span>
            ) : (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-red-600">
                 <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
              </span>
            )}
          </div>
        )}
        <h4 className="text-[15px] font-bold text-slate-800 sm:text-lg leading-tight">{item.name}</h4>
        <div className="mt-1 text-sm font-semibold text-slate-800">{rupees(item.price)}</div>
        
        {item.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-[1.4] text-slate-500 sm:text-sm sm:max-w-[85%]">
            {item.description}
          </p>
        )}
      </div>

      {/* Right side: Image + Add Button or just Add Button */}
      {item.image ? (
        <div className="relative flex shrink-0 flex-col items-center justify-end w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] mt-1">
          <img
            src={item.image}
            alt={item.name}
            className={cn(
              "absolute inset-0 h-full w-full rounded-[14px] object-cover shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
              !item.isAvailable && "grayscale opacity-70"
            )}
          />
          {/* Add Button overlapping the bottom */}
          <div className="absolute -bottom-3 z-10 w-[90px] sm:w-[100px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            {!item.isAvailable ? (
              <div className="flex h-9 w-full items-center justify-center rounded-xl border border-red-100 bg-red-50 text-[11px] font-bold text-red-500">
                Unavailable
              </div>
            ) : qty > 0 ? (
              <div className="flex h-9 w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-1 sm:h-10 sm:px-2">
                <button
                  onClick={(e) => { e.stopPropagation(); hasCustom ? decrementCustom() : cart.setQty(item._id, plainLine!.qty - 1); }}
                  disabled={!vendor.isOpen}
                  className="flex h-full w-7 sm:w-8 items-center justify-center text-brand-600 disabled:opacity-50 hover:bg-brand-100 rounded-lg transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-bold text-brand-700 text-sm">{qty}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); hasCustom ? onCustomize(item) : cart.setQty(item._id, plainLine!.qty + 1); }}
                  disabled={!vendor.isOpen}
                  className="flex h-full w-7 sm:w-8 items-center justify-center text-brand-600 disabled:opacity-50 hover:bg-brand-100 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); hasCustom ? onCustomize(item) : cart.add(vendor.slug, vendor.name, item); }}
                disabled={!vendor.isOpen}
                className="group relative flex h-9 w-full items-center justify-center overflow-hidden rounded-xl border border-brand-200 bg-brand-50/50 font-extrabold text-brand-600 transition-all hover:bg-brand-100 disabled:opacity-50 sm:h-10"
              >
                <span className="text-[13px] tracking-wide">ADD</span>
                {hasCustom && (
                   <span className="absolute right-1.5 top-1 text-[10px] text-brand-500 font-bold">+</span>
                )}
              </button>
            )}
          </div>
          {hasCustom && (
            <span className="absolute -bottom-7 text-[10px] text-slate-400 font-medium text-center w-full">Customizable</span>
          )}
        </div>
      ) : (
        <div className="relative flex shrink-0 flex-col items-center justify-center w-[90px] sm:w-[100px] mt-1 self-center">
          <div className="z-10 w-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            {!item.isAvailable ? (
              <div className="flex h-9 w-full items-center justify-center rounded-xl border border-red-100 bg-red-50 text-[11px] font-bold text-red-500">
                Unavailable
              </div>
            ) : qty > 0 ? (
              <div className="flex h-9 w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-1 sm:h-10 sm:px-2">
                <button
                  onClick={(e) => { e.stopPropagation(); hasCustom ? decrementCustom() : cart.setQty(item._id, plainLine!.qty - 1); }}
                  disabled={!vendor.isOpen}
                  className="flex h-full w-7 sm:w-8 items-center justify-center text-brand-600 disabled:opacity-50 hover:bg-brand-100 rounded-lg transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-bold text-brand-700 text-sm">{qty}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); hasCustom ? onCustomize(item) : cart.setQty(item._id, plainLine!.qty + 1); }}
                  disabled={!vendor.isOpen}
                  className="flex h-full w-7 sm:w-8 items-center justify-center text-brand-600 disabled:opacity-50 hover:bg-brand-100 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); hasCustom ? onCustomize(item) : cart.add(vendor.slug, vendor.name, item); }}
                disabled={!vendor.isOpen}
                className="group relative flex h-9 w-full items-center justify-center overflow-hidden rounded-xl border border-brand-200 bg-brand-50/50 font-extrabold text-brand-600 transition-all hover:bg-brand-100 disabled:opacity-50 sm:h-10"
              >
                <span className="text-[13px] tracking-wide">ADD</span>
                {hasCustom && (
                   <span className="absolute right-1.5 top-1 text-[10px] text-brand-500 font-bold">+</span>
                )}
              </button>
            )}
          </div>
          {hasCustom && (
            <span className="absolute -bottom-4 text-[10px] text-slate-400 font-medium text-center w-full">Customizable</span>
          )}
        </div>
      )}
    </div>
  );
}

function CustomizeModal({
  item, onClose, onAdd,
}: { item: MenuItem; onClose: () => void; onAdd: (addons: SelectedAddon[]) => void }) {
  const groups = (item.customizations || []).filter(g => g.isActive);
  
  const [picks, setPicks] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    groups.forEach((g) => {
      const defaultOpts = g.options.filter(o => o.isDefault && o.isAvailable && !o.isHidden).map(o => o.id);
      if (defaultOpts.length > 0) {
        init[g.id] = new Set(g.type === "single" ? [defaultOpts[0]] : defaultOpts);
      } else if (g.type === "single" && g.options.length > 0) {
        const firstAvailable = g.options.find(o => o.isAvailable && !o.isHidden);
        init[g.id] = new Set(firstAvailable ? [firstAvailable.id] : []);
      } else {
        init[g.id] = new Set();
      }
    });
    return init;
  });

  function toggle(groupId: string, type: "single" | "multi", optionId: string, max?: number) {
    setPicks((p) => {
      const next = { ...p };
      const set = new Set(next[groupId] || []);
      if (type === "single") {
        next[groupId] = new Set([optionId]);
      } else {
        if (set.has(optionId)) {
          set.delete(optionId);
        } else {
          if (max && set.size >= max) return p; 
          set.add(optionId);
        }
        next[groupId] = set;
      }
      return next;
    });
  }

  const visibleGroups = groups.filter(g => {
    if (g.dependency?.groupId && g.dependency?.optionId) {
      return picks[g.dependency.groupId]?.has(g.dependency.optionId);
    }
    return true;
  });

  const addons: SelectedAddon[] = visibleGroups.flatMap((g) =>
    g.options
      .filter((o) => picks[g.id]?.has(o.id) && o.isAvailable && !o.isHidden)
      .map((o) => {
        return { group: g.name, label: o.label, price: o.priceType === "fixed" ? o.price : 0 };
      })
  );

  const total = item.price + addons.reduce((s, a) => s + a.price, 0);

  const missingRequired = visibleGroups.some((g) => {
    const count = picks[g.id]?.size || 0;
    if (g.required && count === 0) return true;
    if (g.minSelections > 0 && count < g.minSelections) return true;
    return false;
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onAdd(addons)} disabled={missingRequired}>
            <Plus className="h-4 w-4" /> Add — {rupees(total)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
        {visibleGroups.map((g) => (
          <div key={g.id}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-800">{g.name}</h4>
              <span className="text-[10px] font-medium text-slate-400">
                {g.required ? "Required" : g.type === "single" ? "Pick one" : "Optional"}
                {g.type === "multi" && g.maxSelections ? ` (Max ${g.maxSelections})` : ""}
              </span>
            </div>
            {g.description && <p className="text-[11px] text-slate-500 mb-2">{g.description}</p>}
            <div className="space-y-1.5">
              {g.options.filter(o => o.isAvailable && !o.isHidden).map((o) => {
                const checked = picks[g.id]?.has(o.id) ?? false;
                let displayPrice = "";
                if (o.priceType === "fixed" && o.price > 0) displayPrice = `+ ${rupees(o.price)}`;
                if (o.priceType === "free") displayPrice = "Free";

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(g.id, g.type, o.id, g.maxSelections)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                      checked ? "border-brand-500 bg-brand-50/40 ring-1 ring-brand-500" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn(
                        "flex h-4 w-4 items-center justify-center border shrink-0",
                        g.type === "single" ? "rounded-full" : "rounded",
                        checked ? "border-brand-500 bg-brand-500" : "border-slate-300"
                      )}>
                        {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="flex flex-col">
                        <span>{o.label}</span>
                        {o.description && <span className="text-[10px] text-slate-400">{o.description}</span>}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-slate-500">{displayPrice}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}



function CartPanel({ onCheckout, isOpen }: { onCheckout: () => void; isOpen: boolean }) {
  const cart = useCart();
  const subtotal = cart.subtotal();

  if (cart.lines.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-400">
        <ShoppingBag className="mx-auto mb-2 h-8 w-8" />
        Your cart is empty
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
      <h3 className="mb-3 flex items-center justify-between font-bold text-slate-800">
        Your Order
        <button onClick={cart.clear} disabled={!isOpen} className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">
          Clear
        </button>
      </h3>
      <div className="space-y-3">
        {cart.lines.map((l) => (
          <div key={l.lineKey} className="border-b border-slate-100 pb-3 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{l.name}</span>
              <span className="shrink-0 text-sm font-semibold">{rupees(l.price * l.qty)}</span>
            </div>
            {(l.addons ?? []).length > 0 && (
              <p className="mt-0.5 text-[11px] text-slate-400">{(l.addons ?? []).map((a) => a.label).join(", ")}</p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-2 py-1">
                <button onClick={() => cart.setQty(l.lineKey, l.qty - 1)} disabled={!isOpen} className="disabled:opacity-50"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-4 text-center text-sm font-semibold">{l.qty}</span>
                <button onClick={() => cart.setQty(l.lineKey, l.qty + 1)} disabled={!isOpen} className="disabled:opacity-50"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <button onClick={() => cart.remove(l.lineKey)} disabled={!isOpen} className="text-slate-400 hover:text-red-500 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              rows={1}
              placeholder="Special instructions (optional)"
              value={l.instructions}
              onChange={(e) => cart.setInstructions(l.lineKey, e.target.value)}
              disabled={!isOpen}
              className="mt-2 text-xs"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-sm text-slate-500">Subtotal</span>
        <span className="font-bold">{rupees(subtotal)}</span>
      </div>
      <Button className="mt-3 w-full" size="lg" onClick={onCheckout} disabled={!isOpen}>
        {!isOpen ? "Store is Closed" : "Proceed to Checkout"}
      </Button>
    </div>
  );
}
