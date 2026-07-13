import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type LegalSection = { title: string; content: ReactNode };

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <>
      <section className="bg-[#111111] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Badge className="mb-5 border-0 bg-orange-500 text-white">Informations officielles</Badge>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/70">{intro}</p>
        </div>
      </section>
      <section className="bg-orange-50 px-4 py-14 sm:px-6 lg:px-8">
        <Card className="mx-auto max-w-5xl border-orange-100 bg-white shadow-sm">
          <CardContent className="grid gap-8 p-6 sm:p-10">
            {sections.map((section, index) => (
              <div key={section.title}>
                {index > 0 ? <Separator className="mb-8 bg-orange-100" /> : null}
                <h2 className="text-2xl font-black text-[#111111]">{section.title}</h2>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-gray-700">{section.content}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
