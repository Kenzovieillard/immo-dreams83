export const propertyDraftBucket = "crm-property-drafts";

export function propertyDraftAssetPath(
  authorId: string,
  draftId: string,
  assetId = "",
) {
  return `drafts/${authorId}/${draftId}${assetId ? `/${assetId}` : ""}`;
}
