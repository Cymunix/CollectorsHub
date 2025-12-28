// lib/useUserProfile.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type UserProfile = {
  userId: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  roleRaw: string; // keep as string for your existing callers
  roleLabel: string;
  shippingAddress: string | null;
  residentialAddress: string | null;
  addressLabel: string;
};

type UseUserProfileState = {
  user: UserProfile | null;
  loading: boolean;
  error?: string | null;
};

function normalizeRoleOrNull(raw: string | null | undefined): string | null {
  const r = String(raw ?? "").trim().toLowerCase();
  return r.length > 0 ? r : null;
}

function roleToLabel(roleRaw: string) {
  return roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export function useUserProfile(): UseUserProfileState {
  const [state, setState] = useState<UseUserProfileState>({
    user: null,
    loading: true,
    error: null,
  });

  const cancelledRef = useRef(false);
  const inflightRef = useRef<Promise<void> | null>(null);

  async function loadProfile(userId: string, email: string | null) {
    // If a load is already running, wait for it instead of bailing.
    if (inflightRef.current) {
      await inflightRef.current;
      return;
    }

    inflightRef.current = (async () => {
      try {
        // ✅ FIX: Supabase PostgrestBuilder is not typed as Promise.
        // Wrap it so withTimeout receives a real Promise.
        const res = await withTimeout(
          (async () => {
            return await supabase
              .from("profiles")
              .select("username, first_name, last_name, role, shipping_address, residential_address")
              .eq("id", userId)
              .maybeSingle();
          })(),
          3000
        );

        if (cancelledRef.current) return;

        const { data: profileData, error } = res as any;

        // Read failed (RLS/403/etc): keep last-known role if we have one
        if (error) {
          setState((prev) => {
            const prevUser = prev.user?.userId === userId ? prev.user : null;
            const stableRole = prevUser?.roleRaw ?? "collector";
            const stableLabel = roleToLabel(stableRole);

            return {
              user: {
                userId,
                email,
                username: prevUser?.username ?? null,
                firstName: prevUser?.firstName ?? null,
                lastName: prevUser?.lastName ?? null,
                roleRaw: stableRole,
                roleLabel: stableLabel,
                shippingAddress: prevUser?.shippingAddress ?? null,
                residentialAddress: prevUser?.residentialAddress ?? null,
                addressLabel: prevUser?.addressLabel ?? "Set mailing address",
              },
              loading: false,
              error: error.message ?? "Failed to load profile",
            };
          });
          return;
        }

        // maybeSingle() can return { data: null, error: null } when no row found.
        // Do NOT overwrite role to "collector" in that case — keep stable previous.
        if (!profileData) {
          setState((prev) => {
            const prevUser = prev.user?.userId === userId ? prev.user : null;

            // If we have a previous user, keep it. Otherwise create a minimal user.
            if (prevUser) {
              return { user: prevUser, loading: false, error: null };
            }

            return {
              user: {
                userId,
                email,
                username: null,
                firstName: null,
                lastName: null,
                roleRaw: "collector",
                roleLabel: "Collector",
                shippingAddress: null,
                residentialAddress: null,
                addressLabel: "Set mailing address",
              },
              loading: false,
              error: null,
            };
          });
          return;
        }

        const roleOrNull = normalizeRoleOrNull(profileData.role);

        setState((prev) => {
          const prevUser = prev.user?.userId === userId ? prev.user : null;

          // If role is missing, keep the last known role for this user
          const finalRole = roleOrNull ?? prevUser?.roleRaw ?? "collector";
          const roleLabel = roleToLabel(finalRole);

          const shipping = profileData.shipping_address ?? prevUser?.shippingAddress ?? null;
          const residential = profileData.residential_address ?? prevUser?.residentialAddress ?? null;

          const rawAddress = (shipping && String(shipping).trim()) || (residential && String(residential).trim()) || "";
          const addressLabel = rawAddress ? rawAddress.split("\n")[0].trim() : "Set mailing address";

          return {
            user: {
              userId,
              email,
              username: profileData.username ?? prevUser?.username ?? null,
              firstName: profileData.first_name ?? prevUser?.firstName ?? null,
              lastName: profileData.last_name ?? prevUser?.lastName ?? null,
              roleRaw: finalRole,
              roleLabel,
              shippingAddress: shipping,
              residentialAddress: residential,
              addressLabel,
            },
            loading: false,
            error: null,
          };
        });
      } catch (e: any) {
        if (cancelledRef.current) return;

        // Timeout/network stall: keep last-known role if possible
        setState((prev) => {
          const prevUser = prev.user?.userId === userId ? prev.user : null;
          const stableRole = prevUser?.roleRaw ?? "collector";
          const stableLabel = roleToLabel(stableRole);

          return {
            user: {
              userId,
              email,
              username: prevUser?.username ?? null,
              firstName: prevUser?.firstName ?? null,
              lastName: prevUser?.lastName ?? null,
              roleRaw: stableRole,
              roleLabel: stableLabel,
              shippingAddress: prevUser?.shippingAddress ?? null,
              residentialAddress: prevUser?.residentialAddress ?? null,
              addressLabel: prevUser?.addressLabel ?? "Set mailing address",
            },
            loading: false,
            error: e?.message ?? "Failed to load profile",
          };
        });
      } finally {
        inflightRef.current = null;
      }
    })();

    await inflightRef.current;
  }

  useEffect(() => {
    cancelledRef.current = false;

    async function boot() {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 3000);
        if (cancelledRef.current) return;

        const session = (data as any)?.session;
        if (!session?.user) {
          setState({ user: null, loading: false, error: null });
          return;
        }

        await loadProfile(session.user.id, session.user.email ?? null);
      } catch (e: any) {
        if (cancelledRef.current) return;
        setState({ user: null, loading: false, error: e?.message ?? "Auth session error" });
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelledRef.current) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setState({ user: null, loading: false, error: null });
        return;
      }

      // Don’t thrash UI on refresh events — keep existing UI while we refresh in background.
      setState((s) => ({ ...s, error: null }));
      await loadProfile(session.user.id, session.user.email ?? null);
    });

    return () => {
      cancelledRef.current = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
