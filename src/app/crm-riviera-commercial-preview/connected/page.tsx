import { notFound } from "next/navigation";
import { CommercialConnectedPreview } from "./preview";

// Developer-only visual harness. Never exposes fixtures as a live CRM route.
export default async function ConnectedPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.CRM_UI_FIXTURE_MODE !== "true" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:9"
  )
    notFound();
  const { screen } = await searchParams;
  return <CommercialConnectedPreview screen={screen ?? "estimations"} />;
}
