// components/catalog/add-item/hooks/useMinifigs.ts
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CatalogMinifig, SelectedMinifig } from "@/lib/catalog/types";
import { normalizeName } from "@/lib/catalog/normalize";
import { uploadToBucket } from "@/lib/catalog/upload";

export function useMinifigs(getSubcategoryId: () => string, getFranchiseId: () => string) {
  const [minifigQuery, setMinifigQuery] = useState("");
  const [minifigSearching, setMinifigSearching] = useState(false);
  const [minifigResults, setMinifigResults] = useState<CatalogMinifig[]>([]);

  // ✅ qty-aware selected list
  const [selectedMinifigs, setSelectedMinifigs] = useState<SelectedMinifig[]>([]);

  // Create-minifig modal state
  const [minifigCreateOpen, setMinifigCreateOpen] = useState(false);
  const [newMinifigNumber, setNewMinifigNumber] = useState("");
  const [newMinifigName, setNewMinifigName] = useState("");
  const [newMinifigImageFile, setNewMinifigImageFile] = useState<File | null>(null);
  const [newMinifigImagePreview, setNewMinifigImagePreview] = useState<string | null>(null);
  const [creatingMinifig, setCreatingMinifig] = useState(false);

  // ✅ Add increments qty if already selected
  const addMinifigToSelection = (mf: CatalogMinifig) => {
    setSelectedMinifigs((prev) => {
      const idx = prev.findIndex((x) => x.id === mf.id);
      if (idx >= 0) {
        const next = [...prev];
        const curQty = Number(next[idx].qty || 1);
        next[idx] = { ...next[idx], qty: Math.min(999, curQty + 1) };
        return next;
      }
      return [...prev, { ...mf, qty: 1 }];
    });
  };

  const removeMinifigFromSelection = (id: string) => {
    setSelectedMinifigs((prev) => prev.filter((x) => x.id !== id));
  };

  // ✅ Set qty directly
  const setMinifigQty = (id: string, qty: number) => {
    const n = Number(qty);
    const clamped = Number.isFinite(n) ? Math.max(1, Math.min(999, Math.floor(n))) : 1;
    setSelectedMinifigs((prev) => prev.map((x) => (x.id === id ? { ...x, qty: clamped } : x)));
  };

  // ✅ +/- helpers
  const bumpMinifigQty = (id: string, delta: number) => {
    setSelectedMinifigs((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const cur = Number(x.qty || 1);
        const next = Math.max(1, Math.min(999, cur + delta));
        return { ...x, qty: next };
      })
    );
  };

  const searchMinifigs = async () => {
    const q = normalizeName(minifigQuery);
    const subcategoryId = getSubcategoryId();

    if (!q) {
      setMinifigResults([]);
      return;
    }
    if (!subcategoryId) {
      alert("Select the Building Blocks brand (subcategory) first.");
      return;
    }

    setMinifigSearching(true);
    try {
      const { data, error } = await supabase
        .from("catalog_minifigs")
        // IMPORTANT: alias DB minifig_id -> id for UI
        .select("id:minifig_id,name,minifig_number,subcategory_id,image_url")
        .eq("subcategory_id", subcategoryId)
        .or(`minifig_number.ilike.%${q}%,name.ilike.%${q}%`)
        .order("minifig_number", { ascending: true })
        .limit(25);

      if (error) throw error;
      setMinifigResults((data ?? []) as CatalogMinifig[]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to search minifigs.");
      setMinifigResults([]);
    } finally {
      setMinifigSearching(false);
    }
  };

  const openCreateMinifig = () => {
    const subcategoryId = getSubcategoryId();
    if (!subcategoryId) return alert("Select the Building Blocks brand (subcategory) first.");

    setNewMinifigNumber("");
    setNewMinifigName("");
    setNewMinifigImageFile(null);
    if (newMinifigImagePreview) URL.revokeObjectURL(newMinifigImagePreview);
    setNewMinifigImagePreview(null);
    setMinifigCreateOpen(true);
  };

  const pickNewMinifigImage = (file: File | null) => {
    setNewMinifigImageFile(file);
    if (newMinifigImagePreview) URL.revokeObjectURL(newMinifigImagePreview);
    if (!file) {
      setNewMinifigImagePreview(null);
      return;
    }
    setNewMinifigImagePreview(URL.createObjectURL(file));
  };

  const createMinifigWithImage = async () => {
    const subcategoryId = getSubcategoryId();
    const franchiseId = (getFranchiseId?.() || "").trim();

    if (!subcategoryId) return alert("Select the Building Blocks brand (subcategory) first.");

    const num = normalizeName(newMinifigNumber);
    const nm = normalizeName(newMinifigName);

    if (!num) return alert("Minifig # is required.");
    if (!nm) return alert("Minifig name is required.");
    if (!newMinifigImageFile) return alert("Minifig image is required.");

    setCreatingMinifig(true);
    try {
      // 1) Create the minifig row first (image_url null)
      const { data, error } = await supabase
        .from("catalog_minifigs")
        .insert({
          subcategory_id: subcategoryId,
          franchise_id: franchiseId || null,
          minifig_number: num,
          name: nm,
          image_url: null,
        })
        .select("id:minifig_id,name,minifig_number,subcategory_id,image_url")
        .single();

      if (error) throw error;

      const mf = data as CatalogMinifig;

      // 2) Upload image under "minifigs/<minifig_id>/..."
      const url = await uploadToBucket(newMinifigImageFile, `minifigs/${mf.id}`);

      // 3) Update minifig with image_url (use real PK column minifig_id)
      const { data: upd, error: updErr } = await supabase
        .from("catalog_minifigs")
        .update({ image_url: url })
        .eq("minifig_id", mf.id)
        .select("id:minifig_id,name,minifig_number,subcategory_id,image_url")
        .single();

      if (updErr) throw updErr;

      const mfFinal = upd as CatalogMinifig;

      // ✅ Add to selected list immediately (qty-aware)
      addMinifigToSelection(mfFinal);

      // close modal + reset fields
      setMinifigCreateOpen(false);
      setNewMinifigNumber("");
      setNewMinifigName("");
      pickNewMinifigImage(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to create minifig.");
    } finally {
      setCreatingMinifig(false);
    }
  };

  const resetMinifigs = () => {
    setMinifigQuery("");
    setMinifigResults([]);
    setSelectedMinifigs([]);
    setMinifigCreateOpen(false);
    setNewMinifigNumber("");
    setNewMinifigName("");
    pickNewMinifigImage(null);
  };

  return {
    minifigQuery,
    setMinifigQuery,
    minifigSearching,
    minifigResults,

    selectedMinifigs,
    addMinifigToSelection,
    removeMinifigFromSelection,

    // ✅ new qty handlers
    setMinifigQty,
    bumpMinifigQty,

    searchMinifigs,

    minifigCreateOpen,
    setMinifigCreateOpen,
    openCreateMinifig,
    newMinifigNumber,
    setNewMinifigNumber,
    newMinifigName,
    setNewMinifigName,
    newMinifigImagePreview,
    pickNewMinifigImage,
    creatingMinifig,
    createMinifigWithImage,

    resetMinifigs,
  };
}
