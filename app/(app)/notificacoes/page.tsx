import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/ui/display";
import { getSupabase, requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/services/notifications";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const { userId } = await requireUser();
  const items = await listNotifications(await getSupabase(), userId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notificações" />
      <NotificationList items={items} />
    </div>
  );
}
