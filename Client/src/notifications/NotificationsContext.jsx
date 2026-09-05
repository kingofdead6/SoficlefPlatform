import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { notificationsApi } from '../api/notifications.js';
import { useAuth } from '../auth/AuthContext.jsx';

const NotificationsContext = createContext(null);

const POLL_INTERVAL_MS = 30_000;

/**
 * Single source of truth for notifications, shared by the top-bar bell and the
 * full notifications page so marking one read updates the other immediately,
 * and polled on an interval so new notifications show up without a reload.
 */
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await notificationsApi.list();
      setNotifications(data ?? []);
    } catch {
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return undefined;
    }
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [user, load]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationsApi.markRead(id);
    } catch {
      load();
    }
  }, [load]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markRead();
    } catch {
      load();
    }
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, loading, error, unreadCount, load, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationsProvider');
  return context;
}
