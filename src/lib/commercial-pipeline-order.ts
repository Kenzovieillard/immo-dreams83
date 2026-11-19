// Relative insertion preserves the relative order of all other cards, even filtered ones.
export function reorderPipelineCards<T extends { id: string; stage: string }>(
  cards: T[],
  id: string,
  targetId: string,
  placement: "before" | "after",
): T[] {
  const moving = cards.find((card) => card.id === id);
  const target = cards.find((card) => card.id === targetId);
  if (!moving || !target || id === targetId || moving.stage !== target.stage)
    return cards;
  const result = cards.filter((card) => card.id !== id);
  const index = result.findIndex((card) => card.id === targetId);
  result.splice(index + Number(placement === "after"), 0, moving);
  return result;
}
