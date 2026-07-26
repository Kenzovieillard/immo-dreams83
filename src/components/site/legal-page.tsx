import { ReactNode } from "react";
import { agencyContact } from "./site-config";

type LegalSection = { title: string; content: ReactNode };

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <section className="bg-[#fbf9f4] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[80rem]">
          <p className="text-xs font-bold uppercase text-orange-600">
            Informations officielles
          </p>
          <h1 className="mt-4 max-w-[51rem] text-[2.55rem] font-black leading-tight text-[#111111] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-[46rem] text-base leading-7 text-gray-600">
            {intro}
          </p>
        </div>
      </section>

      <section className="bg-[#fbf9f4] px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto grid max-w-[80rem] gap-7 lg:grid-cols-[20rem_1fr] lg:items-start">
          <nav
            className="rounded-lg bg-[#111111] p-6 text-white lg:sticky lg:top-28"
            aria-label={`Sommaire de ${title}`}
          >
            <h2 className="text-lg font-black">Sur cette page</h2>
            <ol className="mt-6 grid gap-1">
              {sections.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#legal-section-${index + 1}`}
                    className="flex gap-3 rounded-lg px-2 py-3 text-sm text-white/72 transition hover:bg-white/10 hover:text-white"
                  >
                    <span className="font-bold text-orange-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="rounded-lg bg-white px-6 py-2 shadow-sm ring-1 ring-orange-100 sm:px-10">
            {sections.map((section, index) => (
              <section
                id={`legal-section-${index + 1}`}
                key={section.title}
                className="scroll-mt-28 border-b border-orange-200 py-10 last:border-b-0"
              >
                <h2 className="text-2xl font-black leading-tight text-[#111111]">
                  <span className="mr-3 text-orange-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-5 grid gap-3 text-sm leading-7 text-gray-700 sm:text-base">
                  {section.content}
                </div>
              </section>
            ))}

            <div className="mb-10 rounded-lg bg-orange-50 p-6">
              <p className="text-lg font-black text-[#111111]">
                Une question sur ces informations ?
              </p>
              <a
                href={agencyContact.emailHref}
                className="mt-3 inline-block break-all text-sm font-semibold text-orange-700 hover:underline"
              >
                {agencyContact.email}
              </a>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
