export const adminRoles = [
  "ADMIN",
  "DIRECTOR",
  "AGENT",
  "ASSISTANT",
  "MARKETING",
  "READ_ONLY",
] as const;

export type AdminRole = (typeof adminRoles)[number];

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminSession = {
  user: {
    id: string;
    email: string;
  };
  profile: AdminProfile;
};

export const adminRoleLabels: Record<AdminRole, string> = {
  ADMIN: "Administrateur",
  DIRECTOR: "Direction",
  AGENT: "Agent",
  ASSISTANT: "Assistant",
  MARKETING: "Marketing",
  READ_ONLY: "Lecture seule",
};
