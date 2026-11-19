import {
  commercialPrimaryButton,
  commercialSecondaryButton,
} from "@/components/commercial/commercial-ui";
import { cn } from "@/lib/utils";

export const propertyPrimaryButton = cn(
  commercialPrimaryButton,
  "min-h-12 rounded-2xl sm:min-h-11",
);
export const propertySecondaryButton = cn(
  commercialSecondaryButton,
  "min-h-12 rounded-2xl border-transparent bg-[#dce5d7] sm:min-h-11",
);
