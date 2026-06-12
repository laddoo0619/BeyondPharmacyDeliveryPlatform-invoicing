"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { card, emptyState, sectionTitle, statusBadgeClasses } from "@/lib/portalStyles";

interface Notification {
  id: string;
  orderId: string | null;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationPanel({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch(`/api/${storeSlug}/notifications`);
    if (res.ok) {
      const data = await res.json();
      setNotifications(data);
    }
    setLoading(false);
  }, [storeSlug]);

  useEffect(() => {
    const initial = setTimeout(fetchNotifications, 0);
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await fetch(`/api/${storeSlug}/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    router.refresh();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) return null;

  return (
    <div className={card}>
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className={sectionTitle}>Notifications</h2>
        {unreadCount > 0 && (
          <span className="bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {unreadCount} new
          </span>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className={emptyState}>
          No <span className="italic text-[#1e3a8a]">notifications</span>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`px-6 py-3 ${
                !n.isRead ? "bg-rose-50/70" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${n.type === "DELIVERY_FAILED" || n.type === "SPOKE_DISPATCH_FAILED" ? "bg-rose-500" : n.type === "ORDER_PICKED_UP" ? "bg-teal-500" : "bg-sky-500"}`}
                    />
                    <span className={statusBadgeClasses(n.type === "DELIVERY_FAILED" || n.type === "SPOKE_DISPATCH_FAILED" ? "FAILED" : n.type === "ORDER_PICKED_UP" ? "PICKED_UP" : "IN_TRANSIT")}>
                      {n.type === "DELIVERY_FAILED"
                        ? "Delivery Failed"
                        : n.type === "SPOKE_DISPATCH_FAILED"
                        ? "Spoke Dispatch Failed"
                        : n.type === "ORDER_PICKED_UP"
                        ? "Order Picked Up"
                      : "Re-attempt Started"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="text-xs text-[#6f8f72] hover:text-[#5f7d62] font-semibold ml-3 whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
