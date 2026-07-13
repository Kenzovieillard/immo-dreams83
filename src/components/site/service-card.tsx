import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ServiceCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function ServiceCard({ title, description, icon: Icon }: ServiceCardProps) {
  return (
    <Card className="border-orange-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-200/40">
      <CardHeader>
        <span className="flex size-11 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <CardTitle className="pt-4 text-xl font-black text-[#111111]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
}

