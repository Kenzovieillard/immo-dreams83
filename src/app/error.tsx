"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black text-[#111111]">Une erreur est survenue</h1>
      <p className="mt-4 text-gray-600">
        La page n&apos;a pas pu se charger correctement. Vous pouvez relancer l&apos;affichage.
      </p>
      <Button className="mt-8 bg-orange-500 text-white hover:bg-orange-600" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
