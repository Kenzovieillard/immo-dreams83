"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { CrmMobileNavigation, type CrmTab } from "@/components/admin/crm-mobile-navigation";
import { CrmRivieraHeader } from "@/components/admin/crm-riviera-header";
import { CrmRivieraOnboarding } from "@/components/admin/crm-riviera-onboarding";

const crmRivieraStyle = {
  "--crm-riviera-bg-canvas": "#f6f4ef",
  "--crm-riviera-bg-surface": "#fbfaf7",
  "--crm-riviera-bg-header": "#17221e",
  "--crm-riviera-bg-action": "#2f493a",
  "--crm-riviera-bg-accent": "#dce5d7",
  "--crm-riviera-text-primary": "#18211f",
  "--crm-riviera-text-secondary": "#66716c",
  "--crm-riviera-text-action": "#2f493a",
  "--crm-riviera-border-default": "#dfddd4",
  "--crm-riviera-status-success": "#4d7a5c",
  "--crm-riviera-status-warning": "#c28b2c",
  "--crm-riviera-status-danger": "#a94d43",
  "--crm-riviera-shadow-card": "0 2px 8px rgb(23 34 30 / 0.07)",
} as CSSProperties;

export default function CrmRivieraOnboardingPreviewPage() {
  const [activeTab, setActiveTab] = useState<CrmTab>("overview");
  const [contactSearch, setContactSearch] = useState("");

  function open(tab: CrmTab) {
    setActiveTab(tab);
  }

  return (
    <main className="crm-riviera min-h-dvh overflow-x-clip bg-[var(--crm-riviera-bg-canvas)] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8" style={crmRivieraStyle}>
      <CrmRivieraHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connected
        loading={false}
        userName="Sophie Leroy"
        priorityCount={0}
        visitCount={0}
        contactsToQualify={0}
        contactsReady={0}
        selectedContact={null}
        onCloseContact={() => undefined}
        contactSearch={contactSearch}
        onContactSearchChange={setContactSearch}
        onCreateContact={() => open("contacts")}
        onLogout={() => undefined}
      />
      <div className="mx-auto w-full min-w-0 px-3 py-4 sm:px-6 sm:py-6 md:ml-60 md:w-[calc(100%-15rem)] lg:px-8 xl:px-10 xl:py-8">
        <CrmRivieraOnboarding
          onOpenProfile={() => open("statistics")}
          onOpenContacts={() => open("contacts")}
          onOpenPipeline={() => open("pipeline")}
          onPlanAppointment={() => open("pipeline")}
        />
      </div>
      <CrmMobileNavigation activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => undefined} />
    </main>
  );
}
