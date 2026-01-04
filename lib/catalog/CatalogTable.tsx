"use client";

import React from "react";
import Link from "next/link";
import { ShoppingCart, Box, ExternalLink, TrendingUp } from "lucide-react";
import { CatalogListRow } from "@/lib/catalog/listQuery";

export default function CatalogTable({ items }: { items: CatalogListRow[] }) {
  const formatCurrency = (val: number | null | undefined) => 
    val ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val) : "—";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E9F2] bg-white shadow-sm">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[#E5E9F2] bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            <th className="px-6 py-4">Product</th>
            <th className="px-4 py-4">Franchise / Set</th>
            <th className="px-4 py-4">Classification</th>
            <th className="px-4 py-4">Details</th>
            <th className="px-4 py-4">Market Value</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {items.map((item) => {
            const isLego = item.building_blocks && item.production_status === 'in_production';
            
            return (
              <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                {/* Product Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 flex-shrink-0 rounded-xl border border-slate-100 bg-white p-1">
                      <img src={item.image_url || '/placeholder.png'} className="h-full w-full object-contain" alt="" />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/item/${item.id}`} className="text-sm font-bold text-[#0F172A] hover:text-blue-600 truncate block">
                        {item.name}
                      </Link>
                      <div className="text-[10px] font-mono text-[#64748B]">{item.upc || item.card_number || 'No ID'}</div>
                    </div>
                  </div>
                </td>

                {/* Franchise / Set */}
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-[#0F172A]">{item.franchise_name || "—"}</div>
                  <div className="text-xs text-[#64748B]">{item.card_set_name || "—"}</div>
                </td>

                {/* Classification */}
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {item.genre_names?.slice(0, 2).map((g) => (
                      <span key={g} className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                        {g}
                      </span>
                    ))}
                    {item.age_rating_name && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-black text-blue-700">
                        {item.age_rating_name}
                      </span>
                    )}
                  </div>
                </td>

                {/* Details (Pieces / Date) */}
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-[#0F172A]">
                    {item.building_blocks?.piece_count ? `${item.building_blocks.piece_count} Pieces` : (item.publisher || "—")}
                  </div>
                  <div className="text-xs text-[#64748B]">{item.release_year || "—"}</div>
                </td>

                {/* Market Value */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5 text-sm font-black text-[#0F172A]">
                    <TrendingUp size={14} className="text-green-500" />
                    {formatCurrency(item.avg_value_cad)}
                  </div>
                  <div className="text-[10px] text-[#64748B] font-medium">
                    Retail: {formatCurrency(item.building_blocks?.retail_cad)}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {/* Internal Buy */}
                    <Link href={`/item/${item.id}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-white hover:bg-slate-800 transition-all shadow-sm">
                      <ShoppingCart size={14} />
                    </Link>
                    
                    {/* eBay Search */}
                    <a 
                      href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.name + ' ' + (item.release_year || ''))}`} 
                      target="_blank" 
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E9F2] bg-white text-[11px] font-black text-[#E53238] hover:border-[#E53238]/30 transition-all"
                    >
                      E
                    </a>

                    {/* StockX Search */}
                    <a 
                      href={`https://stockx.com/search?s=${encodeURIComponent(item.name)}`} 
                      target="_blank" 
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E9F2] bg-white text-[10px] font-black text-green-600 hover:border-green-600/30 transition-all"
                    >
                      SX
                    </a>

                    {/* Lego Official (Conditional) */}
                    {isLego && (
                      <a 
                        href={`https://www.lego.com/en-us/search?q=${item.building_blocks?.set_number}`} 
                        target="_blank" 
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFD500] text-black hover:opacity-80 transition-all"
                      >
                        <Box size={14} />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
