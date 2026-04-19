"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AdminAlert {
  id: string;
  type: "overlap-same" | "overlap-cross" | "inconsistency" | "no-show" | "multi-day";
  message: string;
  personName: string;
  otherPerson?: string;
  date: string;
  timestamp: string;
  resolved: boolean;
  entryRowIndex?: number;
  approvedBy?: string;
  approvalDate?: string;
}

interface AdminContextType {
  isAdmin: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  alerts: AdminAlert[];
  addAlert: (alert: Omit<AdminAlert, "id" | "timestamp" | "resolved">) => void;
  resolveAlert: (id: string) => void;
  clearAlerts: () => void;
}

const ADMIN_PASSWORD = "admin2026";
const STORAGE_KEY = "labhora_admin";
const ALERTS_KEY = "labhora_admin_alerts";

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setIsAdmin(true);
    const storedAlerts = localStorage.getItem(ALERTS_KEY);
    if (storedAlerts) {
      try { setAlerts(JSON.parse(storedAlerts)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }, [alerts]);

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      localStorage.setItem(STORAGE_KEY, "true");
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const addAlert = (alert: Omit<AdminAlert, "id" | "timestamp" | "resolved">) => {
    const newAlert: AdminAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    setAlerts((prev) => [newAlert, ...prev]);
  };

  const resolveAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
  };

  const clearAlerts = () => {
    setAlerts((prev) => prev.filter((a) => !a.resolved));
  };

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout, alerts, addAlert, resolveAlert, clearAlerts }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
