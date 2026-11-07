import { db } from "@/db";
import { areas, marketNews } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PublicPropertyPortal } from "@/components/public-property-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicListingsPage() {
  const [rows, newsRows] = await Promise.all([
    db.select().from(areas).where(eq(areas.status, "disponivel")).orderBy(desc(areas.featured), desc(areas.updatedAt)),
    db.select().from(marketNews).orderBy(desc(marketNews.day), desc(marketNews.fetchedAt)).limit(1),
  ]);
  const market = newsRows[0] ?? null;
  const ids = rows.map((row) => row.id);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY;
  let photoMap = new Map<number, { id: number; url: string; name: string }[]>();
  if (url && key && ids.length) {
    const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await admin.from("media").select("id,area_id,name,kind,sort_order").in("area_id", ids).eq("kind", "photo").order("sort_order", { ascending: true });
    for (const item of data ?? []) {
      const list = photoMap.get(item.area_id) ?? [];
      list.push({ id: item.id, url: "/api/public/media/" + item.id, name: item.name });
      photoMap.set(item.area_id, list);
    }
  }
  const listings = rows.map((row) => ({
    id: row.id, code: row.code, name: row.name, kind: row.kind, transaction: row.transaction, featured: row.featured, status: row.status,
    city: row.city, neighborhood: row.neighborhood, address: row.address, description: row.description,
    zoning: row.zoning, zoningNotes: row.zoningNotes, environmentalRestriction: row.environmentalRestriction, environmentalNotes: row.environmentalNotes, lat: row.lat, lng: row.lng, geometry: row.geometry, landAreaM2: row.landAreaM2, builtAreaM2: row.builtAreaM2,
    pricePerM2: row.pricePerM2, totalPrice: row.totalPrice, photos: photoMap.get(row.id) ?? [],
  }));
  return <PublicPropertyPortal listings={listings} market={market ? { day: market.day, source: market.source, fetchedAt: market.fetchedAt.toISOString(), indices: market.indices, items: market.items } : null} />;
}
