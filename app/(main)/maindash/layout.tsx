import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { trackSecurityEvent, SECURITY_EVENT_TYPES } from "@/services/security-events";

export default async function MainDashLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  void trackSecurityEvent({
    userId: admin.id,
    eventType: SECURITY_EVENT_TYPES.ADMIN_ACCESS,
    severity: "low",
    metadata: { source: "maindash" },
  }).catch(() => {});
  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <AdminNav />
      {children}
    </div>
  );
}
