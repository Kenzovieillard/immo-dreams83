import { Award, Handshake, MapPinned, ScanSearch } from "lucide-react";

const stats = [
  {
    title: "Expertise locale dans le Var",
    description:
      "Une connaissance concrète de Solliès-Pont, Toulon, Hyères, Carqueiranne et des communes voisines.",
    icon: MapPinned,
  },
  {
    title: "Estimation offerte",
    description:
      "Un avis de valeur clair pour décider sereinement avant de vendre.",
    icon: ScanSearch,
  },
  {
    title: "Accompagnement vendeur",
    description:
      "Conseil, valorisation du bien, diffusion, visites et négociation.",
    icon: Handshake,
  },
  {
    title: "Sélection d'acquéreurs qualifiés",
    description:
      "Des contacts mieux ciblés pour limiter les visites inutiles et avancer avec confiance.",
    icon: Award,
  },
];

export function StatsSection() {
  return (
    <section className="bg-[#111111] py-12 text-white sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
            Pourquoi nous faire confiance
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">
            Une méthode locale, simple et rassurante
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 sm:p-6"
            >
              <item.icon className="size-8 text-orange-400" aria-hidden="true" />
              <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/68">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
