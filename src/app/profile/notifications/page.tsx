import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getUserNotificationPreferences } from "@/lib/notification-service";
import { PreferencesForm } from "./preferences-form";

export default async function ProfileNotificationsPage() {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string | null; email?: string | null; status?: string } | undefined;
  if (!user?.id || user.status !== "ACTIVE") {
    redirect("/login");
  }

  const prefsData = await getUserNotificationPreferences(user.id);
  const displayName = user.name || user.email?.split("@")[0] || "Pengguna";

  return (
    <AppShell>
      <div className="h-full flex flex-col bg-slate-50/50">
        <PreferencesForm
          userName={displayName}
          initialScope={prefsData.scope}
          initialFocusUntil={prefsData.focusUntil ? prefsData.focusUntil.toISOString() : null}
          initialIsFocusActive={prefsData.isFocusActive}
          initialPreferences={prefsData.preferences}
        />
      </div>
    </AppShell>
  );
}
