"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  orderId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationPanel({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [storeSlug]);

  const fetchNotifications = async () => {
    const res = await fetch(`/api/${storeSlug}/notifications`);
    if (res.ok) {
      const data = await res.json();
      setNotifications(data);
    }
    setLoading(false);
  };

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
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {unreadCount} new
          </span>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-500 text-sm">
          No notifications
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`px-6 py-3 ${
                !n.isRead ? "bg-red-50" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        n.type === "DELIVERY_FAILED"
                          ? "bg-red-500"
                          : n.type === "ORDER_PICKED_UP"
                          ? "bg-teal-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {n.type === "DELIVERY_FAILED"
                        ? "Delivery Failed"
                        : n.type === "ORDER_PICKED_UP"
                        ? "Order Picked Up"
                        : "Re-attempt Started"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-3 whitespace-nowrap"
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
