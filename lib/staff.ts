export type StaffProfile = {
  id: string;
  display_name: string;
  role: "staff" | "manager";
};

export function canManage(profile: StaffProfile) {
  return profile.role === "manager";
}
