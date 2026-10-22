import type { UserContext } from "@/lib/context";

export async function loadCategories(ctx: UserContext) {
  const { data } = await ctx.supabase.from("categories").select("*").eq("user_id", ctx.user.id).order("sort_order").order("name");
  return data ?? [];
}
