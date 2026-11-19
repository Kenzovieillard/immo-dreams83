import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase";

export default async function LegacyOfferNegotiationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data } = await supabase
      .from("negotiations")
      .select("id")
      .eq("offer_id", id)
      .maybeSingle();
    if (data) redirect(`/commercial/negociations/${data.id}`);
  }

  redirect("/commercial/negociations");
}
