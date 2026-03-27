"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type Variant = {
  _id: string;
  name: string;
  price: number;
  category: string;
  type?: string;
  vendorUrl: string;
  pinType: string;
  componentId: string;
  pins?: Array<{ pinType: string; ioType: string; name: string }>;
};

type SortKey = "name" | "category" | "price" | "pinType" | "pinCount";

export default function KnowledgebasePage() {
  const [variantsByCategory, setVariantsByCategory] = useState<Record<string, Variant[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pinTypeFilter, setPinTypeFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  useEffect(() => {
    const load = async () => {
      setError("");
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/knowledgebase/variants`);
        if (!response.ok) {
          throw new Error("Unable to load knowledgebase variants.");
        }

        const data = (await response.json()) as Array<Variant>;
        const grouped = data.reduce<Record<string, Variant[]>>((acc, variant) => {
          const category = (variant.category ?? "unknown").toLowerCase();
          const list = acc[category] ?? [];
          list.push(variant);
          acc[category] = list;
          return acc;
        }, {});

        Object.keys(grouped).forEach((category) => {
          grouped[category] = [...grouped[category]].sort((a, b) => a.price - b.price);
        });

        setVariantsByCategory(grouped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load knowledgebase.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const totalVariants = useMemo(
    () => Object.values(variantsByCategory).reduce((sum, list) => sum + list.length, 0),
    [variantsByCategory]
  );

  const componentCategories = useMemo(
    () => Object.keys(variantsByCategory).sort((a, b) => a.localeCompare(b)),
    [variantsByCategory]
  );

  const allVariants = useMemo(
    () => Object.values(variantsByCategory).flat(),
    [variantsByCategory]
  );

  const filtered = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    return allVariants.filter((variant) => {
      if (categoryFilter !== "all" && variant.category.toLowerCase() !== categoryFilter) {
        return false;
      }
      if (pinTypeFilter !== "all" && variant.pinType !== pinTypeFilter) {
        return false;
      }
      if (Number.isFinite(min) && variant.price < (min ?? 0)) {
        return false;
      }
      if (Number.isFinite(max) && variant.price > (max ?? 0)) {
        return false;
      }
      if (!search) {
        return true;
      }
      const pinNames = (variant.pins ?? []).map((pin) => pin.name).join(" ");
      return (
        variant.name.toLowerCase().includes(search) ||
        variant.category.toLowerCase().includes(search) ||
        variant.componentId.toLowerCase().includes(search) ||
        pinNames.toLowerCase().includes(search)
      );
    });
  }, [allVariants, categoryFilter, pinTypeFilter, minPrice, maxPrice, searchTerm]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const multiplier = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * multiplier;
        case "category":
          return a.category.localeCompare(b.category) * multiplier;
        case "pinType":
          return a.pinType.localeCompare(b.pinType) * multiplier;
        case "pinCount":
          return ((a.pins?.length ?? 1) - (b.pins?.length ?? 1)) * multiplier;
        case "price":
        default:
          return (a.price - b.price) * multiplier;
      }
    });
    return next;
  }, [filtered, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, pinTypeFilter, minPrice, maxPrice, sortKey, sortDir, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortLabel = (key: SortKey, label: string) => {
    if (sortKey !== key) {
      return label;
    }
    return `${label} ${sortDir === "asc" ? "↑" : "↓"}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Knowledgebase</p>
          <h1 className="font-display text-2xl text-ink">Component variants</h1>
        </div>
        <span className="rounded-full border border-ink/10 bg-mist/80 px-3 py-2 text-xs font-semibold text-ink/70">
          {isLoading ? "Syncing variants..." : `${totalVariants} variants synced`}
        </span>
      </header>

      {error ? (
        <div className="rounded-2xl border border-ember/30 bg-white px-4 py-3 text-sm text-ember">
          {error}
        </div>
      ) : null}

      <Card className="border-ink/10 bg-white/95">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Variant catalog</CardTitle>
            <p className="mt-1 text-xs text-ink/60">
              {isLoading ? "Loading knowledgebase..." : `${sorted.length} results`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-10 rounded-2xl border border-ink/20 bg-white/90 px-3 text-sm"
              placeholder="Search name, category, ID, pins"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <select
              className="h-10 rounded-2xl border border-ink/20 bg-white/90 px-3 text-sm"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {componentCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-2xl border border-ink/20 bg-white/90 px-3 text-sm"
              value={pinTypeFilter}
              onChange={(event) => setPinTypeFilter(event.target.value)}
            >
              <option value="all">All pin types</option>
              <option value="digital">Digital</option>
              <option value="analog">Analog</option>
            </select>
            <input
              type="number"
              min={0}
              className="h-10 w-24 rounded-2xl border border-ink/20 bg-white/90 px-3 text-sm"
              placeholder="Min $"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
            <input
              type="number"
              min={0}
              className="h-10 w-24 rounded-2xl border border-ink/20 bg-white/90 px-3 text-sm"
              placeholder="Max $"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
            <select
              className="h-10 rounded-2xl border border-ink/20 bg-white/90 px-3 text-sm"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {[8, 12, 20, 40].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="hidden rounded-2xl border border-ink/10 bg-mist/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/50 lg:grid lg:grid-cols-[1.2fr_1.4fr_1fr_1fr_1.2fr_1fr_auto]">
            <button type="button" className="text-left" onClick={() => toggleSort("category")}>
              {sortLabel("category", "Category")}
            </button>
            <button type="button" className="text-left" onClick={() => toggleSort("name")}>
              {sortLabel("name", "Variant")}
            </button>
            <button type="button" className="text-left" onClick={() => toggleSort("price")}>
              {sortLabel("price", "Price")}
            </button>
            <button type="button" className="text-left" onClick={() => toggleSort("pinType")}>
              {sortLabel("pinType", "Pin Type")}
            </button>
            <button type="button" className="text-left" onClick={() => toggleSort("pinCount")}>
              {sortLabel("pinCount", "Pins")}
            </button>
            <div>Component ID</div>
            <div className="text-right">Vendor</div>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-ink/10 bg-mist/60 px-4 py-6 text-sm text-ink/70">
              Fetching knowledgebase variants...
            </div>
          ) : paged.length === 0 ? (
            <div className="rounded-2xl border border-ink/10 bg-mist/60 px-4 py-6 text-sm text-ink/70">
              No variants match the current filters.
            </div>
          ) : (
            paged.map((variant) => {
              const pins = variant.pins ?? [];
              return (
                <div
                  key={variant._id}
                  className="grid gap-3 rounded-2xl border border-ink/10 bg-white/90 p-4 lg:grid-cols-[1.2fr_1.4fr_1fr_1fr_1.2fr_1fr_auto]"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
                    {variant.category}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{variant.name}</p>
                    <p className="mt-1 text-xs text-ink/60">{variant.type}</p>
                  </div>
                  <div className="text-xs text-ink/70">
                    <p className="font-semibold text-ink">${variant.price.toFixed(2)}</p>
                  </div>
                  <div className="text-xs font-semibold text-ink/60">{variant.pinType}</div>
                  <div className="text-xs text-ink/70">
                    {pins.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {pins.map((pin, index) => (
                          <span
                            key={`${variant._id}-pin-${index}`}
                            className="rounded-full border border-ink/10 bg-mist/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60"
                          >
                            {pin.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink/50">1 pin</span>
                    )}
                  </div>
                  <div className="text-xs text-ink/60">
                    <span className="font-semibold text-ink">ID</span>
                    <p className="mt-1 break-all text-ink/60">{variant.componentId}</p>
                  </div>
                  <div className="flex items-center justify-end">
                    {variant.vendorUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={variant.vendorUrl} target="_blank" rel="noreferrer">
                          Buy
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-ink/40">No link</span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink/60">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
