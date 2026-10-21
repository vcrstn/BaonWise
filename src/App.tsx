import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Page = "Dashboard" | "Affordability" | "Expenses" | "Budget Planner" | "Reports" | "Settings";
type Category = "Food" | "Transportation" | "School" | "Personal" | "Others";
type AllowancePeriod = "Daily" | "Weekly" | "Monthly";
type AvatarTheme = "buttermilk" | "blue" | "green" | "coral";
type Expense = { id: number; name: string; amount: number; category: Category; date: string };

type UserAccount = {
  email: string;
  name: string;
  picture?: string;
  provider: "google" | "email";
  googleVerified: boolean;
  googleEmail?: string;
};

type StoredAccount = UserAccount & {
  password?: string;
};

type NotificationPrefs = {
  dailyReminder: boolean;
  lowBalanceAlert: boolean;
  lowBalanceThreshold: number;
  weeklySummary: boolean;
};

type UserBudgetData = {
  hasSetup: boolean;
  expenses: Expense[];
  allowance: number;
  allowancePeriod: AllowancePeriod;
  schoolDaysPerWeek: number;
  essentialBudget: number;
  savingsGoal: number;
  profileName: string;
  schoolName: string;
  avatarTheme: AvatarTheme;
  notifications: NotificationPrefs;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const categories: Category[] = ["Food", "Transportation", "School", "Personal", "Others"];
const allowancePeriods: AllowancePeriod[] = ["Daily", "Weekly", "Monthly"];

const categoryColors: Record<Category, string> = {
  Food: "#7FAE99",
  Transportation: "#8BAFC4",
  School: "#E6C968",
  Personal: "#D8927F",
  Others: "#A79AA3",
};

const avatarThemeColors: Record<AvatarTheme, { bg: string; label: string }> = {
  buttermilk: { bg: "#fff1b5", label: "Buttermilk" },
  blue: { bg: "#c1dbe8", label: "Sky Blue" },
  green: { bg: "#cfe8d9", label: "Sage Green" },
  coral: { bg: "#f5cfc6", label: "Warm Coral" },
};

const defaultNotifications: NotificationPrefs = {
  dailyReminder: true,
  lowBalanceAlert: true,
  lowBalanceThreshold: 20,
  weeklySummary: true,
};

function getStoredAccounts(): Record<string, StoredAccount> {
  try {
    return JSON.parse(localStorage.getItem("baonwise-v2-accounts") || "{}") || {};
  } catch {
    return {};
  }
}

function saveStoredAccounts(accounts: Record<string, StoredAccount>) {
  localStorage.setItem("baonwise-v2-accounts", JSON.stringify(accounts));
}

function loadUserData(email: string, fallbackName: string): UserBudgetData {
  const key = `baonwise-v2-data:${email.toLowerCase()}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        hasSetup: Boolean(parsed.hasSetup),
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        allowance: Number(parsed.allowance) || 0,
        allowancePeriod: allowancePeriods.includes(parsed.allowancePeriod) ? parsed.allowancePeriod : "Weekly",
        schoolDaysPerWeek: [5, 6, 7].includes(Number(parsed.schoolDaysPerWeek)) ? Number(parsed.schoolDaysPerWeek) : 7,
        essentialBudget: Number(parsed.essentialBudget) || 0,
        savingsGoal: Number(parsed.savingsGoal) || 0,
        profileName: parsed.profileName || fallbackName || "Student",
        schoolName: parsed.schoolName || "",
        avatarTheme: parsed.avatarTheme in avatarThemeColors ? parsed.avatarTheme : "buttermilk",
        notifications: { ...defaultNotifications, ...(parsed.notifications || {}) },
      };
    }
  } catch {
    // ignore parse errors and fall back
  }

  // Migrate any existing global v2 data if this is the first time loading per-user storage
  const legacySetup = localStorage.getItem("baonwise-v2-setup") === "true";
  if (legacySetup) {
    let legacyExpenses: Expense[] = [];
    try { legacyExpenses = JSON.parse(localStorage.getItem("baonwise-v2-expenses") || "[]") || []; } catch { legacyExpenses = []; }
    const legacyPeriod = localStorage.getItem("baonwise-v2-period") as AllowancePeriod;
    const legacyDays = Number(localStorage.getItem("baonwise-v2-schooldays"));
    const legacyAvatar = localStorage.getItem("baonwise-v2-avatar") as AvatarTheme;
    let legacyNotifs = defaultNotifications;
    try { legacyNotifs = { ...defaultNotifications, ...JSON.parse(localStorage.getItem("baonwise-v2-notifications") || "{}") }; } catch { /* ignore */ }

    const migrated: UserBudgetData = {
      hasSetup: true,
      expenses: legacyExpenses,
      allowance: Number(localStorage.getItem("baonwise-v2-allowance")) || 0,
      allowancePeriod: allowancePeriods.includes(legacyPeriod) ? legacyPeriod : "Weekly",
      schoolDaysPerWeek: [5, 6, 7].includes(legacyDays) ? legacyDays : 7,
      essentialBudget: Number(localStorage.getItem("baonwise-v2-essential")) || 0,
      savingsGoal: Number(localStorage.getItem("baonwise-v2-savings")) || 0,
      profileName: localStorage.getItem("baonwise-v2-name") || fallbackName || "Student",
      schoolName: localStorage.getItem("baonwise-v2-school") || "",
      avatarTheme: legacyAvatar && legacyAvatar in avatarThemeColors ? legacyAvatar : "buttermilk",
      notifications: legacyNotifs,
    };
    localStorage.setItem(key, JSON.stringify(migrated));
    localStorage.removeItem("baonwise-v2-setup");
    return migrated;
  }

  return {
    hasSetup: false,
    expenses: [],
    allowance: 0,
    allowancePeriod: "Weekly",
    schoolDaysPerWeek: 7,
    essentialBudget: 0,
    savingsGoal: 0,
    profileName: fallbackName || "Student",
    schoolName: "",
    avatarTheme: "buttermilk",
    notifications: defaultNotifications,
  };
}

const iconPaths: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  wallet: <><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V7" /><path d="M16 14h.01" /></>,
  receipt: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" /><path d="M9 7h6M9 11h6M9 15h3" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m7 16 4-5 3 3 5-7" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3V10h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  arrow: <path d="m9 18 6-6-6-6" />,
  edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" /><path d="m13.5 6.5 3.5 3.5" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  download: <><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z" />
    </svg>
  );
}

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function SelectField({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span><select {...props}>{children}</select></label>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function UserAvatar({ name, picture, bg, className }: { name: string; picture?: string; bg: string; className: string }) {
  if (picture) {
    return <img src={picture} alt={name} className={`${className} avatar-img`} referrerPolicy="no-referrer" />;
  }
  return <div className={className} style={{ background: bg }}>{(name || "S").slice(0, 1).toUpperCase()}</div>;
}

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem("baonwise-v2-user");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        googleVerified: Boolean(parsed.googleVerified),
      };
    } catch {
      return null;
    }
  });

  const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    return envClientId || localStorage.getItem("baonwise-v2-google-client-id") || "";
  });
  const [googleConnectModalOpen, setGoogleConnectModalOpen] = useState(false);

  const initialData = useMemo(() => {
    if (!currentUser) {
      return {
        hasSetup: false,
        expenses: [] as Expense[],
        allowance: 0,
        allowancePeriod: "Weekly" as AllowancePeriod,
        schoolDaysPerWeek: 7,
        essentialBudget: 0,
        savingsGoal: 0,
        profileName: "Student",
        schoolName: "",
        avatarTheme: "buttermilk" as AvatarTheme,
        notifications: defaultNotifications,
      };
    }
    return loadUserData(currentUser.email, currentUser.name);
  }, [currentUser?.email]);

  const [page, setPage] = useState<Page>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasSetup, setHasSetup] = useState<boolean>(initialData.hasSetup);
  const [allowanceModalOpen, setAllowanceModalOpen] = useState<boolean>(Boolean(currentUser && !initialData.hasSetup));
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [expenses, setExpenses] = useState<Expense[]>(initialData.expenses);
  const [allowance, setAllowance] = useState<number>(initialData.allowance);
  const [allowancePeriod, setAllowancePeriod] = useState<AllowancePeriod>(initialData.allowancePeriod);
  const [schoolDaysPerWeek, setSchoolDaysPerWeek] = useState<number>(initialData.schoolDaysPerWeek);
  const [essentialBudget, setEssentialBudget] = useState<number>(initialData.essentialBudget);
  const [savingsGoal, setSavingsGoal] = useState<number>(initialData.savingsGoal);
  const [profileName, setProfileName] = useState<string>(initialData.profileName);
  const [schoolName, setSchoolName] = useState<string>(initialData.schoolName);
  const [avatarTheme, setAvatarTheme] = useState<AvatarTheme>(initialData.avatarTheme);
  const [notifications, setNotifications] = useState<NotificationPrefs>(initialData.notifications);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [toast, setToast] = useState("");

  // Sync user budget state when switching accounts
  const applyUserSession = (user: UserAccount) => {
    const data = loadUserData(user.email, user.name);
    setCurrentUser(user);
    setHasSetup(data.hasSetup);
    setExpenses(data.expenses);
    setAllowance(data.allowance);
    setAllowancePeriod(data.allowancePeriod);
    setSchoolDaysPerWeek(data.schoolDaysPerWeek);
    setEssentialBudget(data.essentialBudget);
    setSavingsGoal(data.savingsGoal);
    setProfileName(data.profileName || user.name || "Student");
    setSchoolName(data.schoolName);
    setAvatarTheme(data.avatarTheme);
    setNotifications(data.notifications);
    setAllowanceModalOpen(!data.hasSetup);
    setPage("Dashboard");
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("baonwise-v2-user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("baonwise-v2-user");
    }
  }, [currentUser]);

  // Persist current user's budget data whenever any field changes
  useEffect(() => {
    if (!currentUser) return;
    const key = `baonwise-v2-data:${currentUser.email.toLowerCase()}`;
    const payload: UserBudgetData = {
      hasSetup,
      expenses,
      allowance,
      allowancePeriod,
      schoolDaysPerWeek,
      essentialBudget,
      savingsGoal,
      profileName,
      schoolName,
      avatarTheme,
      notifications,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [
    currentUser,
    hasSetup,
    expenses,
    allowance,
    allowancePeriod,
    schoolDaysPerWeek,
    essentialBudget,
    savingsGoal,
    profileName,
    schoolName,
    avatarTheme,
    notifications,
  ]);

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 2600); return () => clearTimeout(timer); } }, [toast]);

  const spent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = allowance - spent;
  const reservedTotal = essentialBudget + savingsGoal;
  const daysInPeriod = allowancePeriod === "Daily" ? 1 : allowancePeriod === "Weekly" ? schoolDaysPerWeek : 30;
  const dailyBudget = Math.max((remaining - savingsGoal) / daysInPeriod, 0);

  const openExpense = (expense?: Expense) => { setEditing(expense || null); setModalOpen(true); };
  const navigate = (destination: Page) => { setPage(destination); setSidebarOpen(false); setNotifOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const completeVerifiedGoogleSignIn = (googleProfile: { email: string; name: string; given_name?: string; picture?: string }) => {
    const cleanEmail = googleProfile.email.trim().toLowerCase();
    const firstName = googleProfile.given_name || googleProfile.name.split(" ")[0] || "Student";
    const accounts = getStoredAccounts();

    // If user is already logged in (e.g. linking Google from Settings), update their account record
    const targetEmail = currentUser ? currentUser.email.toLowerCase() : cleanEmail;
    const existing = accounts[targetEmail];

    const updatedAccount: StoredAccount = {
      email: targetEmail,
      name: existing?.name || firstName,
      password: existing?.password,
      picture: googleProfile.picture,
      provider: "google",
      googleVerified: true,
      googleEmail: cleanEmail,
    };

    accounts[targetEmail] = updatedAccount;
    // Also index by Google email so future "Continue with Google" logs into the same account
    if (cleanEmail !== targetEmail && !accounts[cleanEmail]) {
      accounts[cleanEmail] = { ...updatedAccount, email: cleanEmail };
    }
    saveStoredAccounts(accounts);

    const sessionUser: UserAccount = {
      email: updatedAccount.email,
      name: updatedAccount.name,
      picture: updatedAccount.picture,
      provider: "google",
      googleVerified: true,
      googleEmail: cleanEmail,
    };

    if (currentUser) {
      setCurrentUser(sessionUser);
    } else {
      applyUserSession(sessionUser);
    }
    setGoogleConnectModalOpen(false);
    setToast(`Verified Google account: ${cleanEmail}`);
  };

  const triggerGoogleOAuth = (customClientId?: string) => {
    const activeClientId = (customClientId ?? googleClientId).trim();
    if (!activeClientId) {
      setGoogleConnectModalOpen(true);
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      setToast("Google Identity Services script is not loaded yet. Check your internet connection.");
      return;
    }
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: "openid email profile",
        callback: async (tokenResponse) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            setToast("Google sign-in was cancelled or failed.");
            return;
          }
          try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            if (!res.ok) throw new Error("Failed to fetch Google userinfo");
            const profile = await res.json();
            completeVerifiedGoogleSignIn({
              email: profile.email,
              name: profile.name || profile.given_name || "Student",
              given_name: profile.given_name,
              picture: profile.picture,
            });
          } catch {
            setToast("Could not verify Google profile info.");
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch {
      setGoogleConnectModalOpen(true);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setNotifOpen(false);
    setSidebarOpen(false);
    setToast("Signed out");
  };

  const handleSaveAllowanceSetup = (data: { name: string; allowance: number; period: AllowancePeriod; essentialBudget: number }) => {
    const cleanName = data.name.trim() || "Student";
    setProfileName(cleanName);
    if (currentUser) {
      const updatedUser = { ...currentUser, name: cleanName };
      setCurrentUser(updatedUser);
      const accounts = getStoredAccounts();
      const key = currentUser.email.toLowerCase();
      if (accounts[key]) {
        accounts[key] = { ...accounts[key], name: cleanName };
        saveStoredAccounts(accounts);
      }
    }
    setAllowance(data.allowance);
    setAllowancePeriod(data.period);
    setEssentialBudget(data.essentialBudget);
    setHasSetup(true);
    setAllowanceModalOpen(false);
    setToast(hasSetup ? "Allowance updated" : "Welcome to BaonWise!");
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      setToast("No expenses to export yet");
      return;
    }
    const headers = ["Date", "Item", "Category", "Amount (PHP)"];
    const rows = expenses.map((e) => [
      e.date,
      `"${e.name.replace(/"/g, '""')}"`,
      e.category,
      String(e.amount),
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `baonwise-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Expenses exported to CSV");
  };

  const handleClearExpenses = () => {
    if (expenses.length === 0) {
      setToast("Expense list is already empty");
      return;
    }
    if (window.confirm("Start a new allowance cycle and clear all recorded expenses? Your profile and budget settings will be kept.")) {
      setExpenses([]);
      setToast("Expenses cleared for new cycle");
    }
  };

  const handleResetData = () => {
    if (window.confirm("Reset all allowance, profile, and expense data for this account?")) {
      if (currentUser) {
        localStorage.removeItem(`baonwise-v2-data:${currentUser.email.toLowerCase()}`);
      }
      setExpenses([]);
      setAllowance(0);
      setAllowancePeriod("Weekly");
      setSchoolDaysPerWeek(7);
      setEssentialBudget(0);
      setSavingsGoal(0);
      setProfileName(currentUser?.name || "Student");
      setSchoolName("");
      setAvatarTheme("buttermilk");
      setNotifications(defaultNotifications);
      setHasSetup(false);
      setAllowanceModalOpen(true);
      setToast("Account budget data reset");
    }
  };

  const activeNotifs = useMemo(() => {
    const list: { id: string; title: string; message: string; tone: "info" | "warn" | "good" }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const spentToday = expenses.filter((e) => e.date === todayStr).reduce((s, e) => s + e.amount, 0);

    if (notifications.lowBalanceAlert && allowance > 0) {
      const remainingPct = Math.round((remaining / allowance) * 100);
      if (remainingPct <= notifications.lowBalanceThreshold) {
        list.push({
          id: "low-balance",
          title: "Low balance alert",
          message: `You have ${formatPeso(Math.max(remaining, 0))} left (${Math.max(remainingPct, 0)}% of your allowance, below your ${notifications.lowBalanceThreshold}% alert threshold).`,
          tone: "warn",
        });
      }
    }

    if (notifications.dailyReminder) {
      list.push({
        id: "daily-reminder",
        title: "Daily budget reminder",
        message: allowance > 0
          ? `Your daily limit is ${formatPeso(dailyBudget)}. You’ve spent ${formatPeso(spentToday)} today.`
          : "Set your starting allowance to get personalized daily spending targets.",
        tone: spentToday > dailyBudget && allowance > 0 ? "warn" : "info",
      });
    }

    if (notifications.weeklySummary) {
      list.push({
        id: "weekly-summary",
        title: `${allowancePeriod} summary`,
        message: expenses.length > 0
          ? `You’ve logged ${expenses.length} transaction${expenses.length === 1 ? "" : "s"} totaling ${formatPeso(spent)}.`
          : "No expenses recorded yet in this cycle.",
        tone: "good",
      });
    }

    return list;
  }, [notifications, allowance, remaining, dailyBudget, expenses, spent, allowancePeriod]);

  const hasWarningNotif = activeNotifs.some((n) => n.tone === "warn");
  const avatarBg = avatarThemeColors[avatarTheme].bg;

  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onAuthenticated={(user, isNewAccount) => {
            applyUserSession(user);
            setToast(isNewAccount ? `Account created for ${user.email}` : `Signed in as ${user.email}`);
          }}
          onGoogleClick={() => triggerGoogleOAuth()}
        />
        {googleConnectModalOpen && (
          <GoogleConnectModal
            initialClientId={googleClientId}
            envConfigured={Boolean(envClientId)}
            onClose={() => setGoogleConnectModalOpen(false)}
            onSaveClientIdAndLaunch={(clientId) => {
              localStorage.setItem("baonwise-v2-google-client-id", clientId);
              setGoogleClientId(clientId);
              setGoogleConnectModalOpen(false);
              setTimeout(() => triggerGoogleOAuth(clientId), 100);
            }}
          />
        )}
        {toast && <div className="toast"><span><Icon name="check" size={16} /></span>{toast}</div>}
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><span>₱</span></div><div><strong>BaonWise</strong><small>Spend smart. Live well.</small></div></div>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><Icon name="close" /></button>
        <nav>
          <p className="nav-label">Overview</p>
          {[
            ["Dashboard", "grid"], ["Affordability", "wallet"], ["Expenses", "receipt"], ["Budget Planner", "target"], ["Reports", "chart"],
          ].map(([item, icon]) => <button key={item} className={page === item ? "active" : ""} onClick={() => navigate(item as Page)}><Icon name={icon} /><span>{item === "Affordability" ? "Can I Afford This?" : item}</span>{page === item && <i />}</button>)}
          <p className="nav-label account-label">Account</p>
          <button className={page === "Settings" ? "active" : ""} onClick={() => navigate("Settings")}><Icon name="settings" /><span>Settings</span>{page === "Settings" && <i />}</button>
        </nav>
        <div className="sidebar-tip">
          <div className="tip-icon"><Icon name="target" /></div>
          <strong>Small choices add up.</strong>
          <p>{allowance > 0 ? `You have ${formatPeso(Math.max(remaining, 0))} left in your current allowance.` : "Set your starting allowance to track your daily spending limit."}</p>
        </div>
        <div className="sidebar-profile">
          <UserAvatar name={profileName} picture={currentUser.picture} bg={avatarBg} className="avatar" />
          <div className="sidebar-user-info">
            <strong>{profileName}</strong>
            <small title={currentUser.googleEmail || currentUser.email}>{schoolName.trim() || currentUser.googleEmail || currentUser.email}</small>
          </div>
          <button className="logout-icon-btn" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>
      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <div className="top-search">
            <Icon name="search" size={18} />
            <input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim() && page !== "Expenses") {
                  setPage("Expenses");
                }
              }}
            />
          </div>
          <div className="top-actions">
            <div className="notif-wrapper">
              <button
                aria-label="Notifications"
                onClick={() => setNotifOpen((o) => !o)}
                className={notifOpen ? "active" : ""}
              >
                <Icon name="bell" />
                {activeNotifs.length > 0 && <span className={`notif-dot ${hasWarningNotif ? "warn" : ""}`} />}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <strong>Notifications</strong>
                    <button className="text-action" onClick={() => navigate("Settings")}>Preferences</button>
                  </div>
                  {activeNotifs.length > 0 ? (
                    <div className="notif-list">
                      {activeNotifs.map((item) => (
                        <div key={item.id} className={`notif-item ${item.tone}`}>
                          <strong>{item.title}</strong>
                          <p>{item.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="notif-empty">All notifications are turned off in Settings.</p>
                  )}
                </div>
              )}
            </div>
            <div onClick={() => navigate("Settings")} title="Profile & Settings">
              <UserAvatar name={profileName} picture={currentUser.picture} bg={avatarBg} className="top-avatar" />
            </div>
          </div>
        </header>
        <div className="content" onClick={() => { if (notifOpen) setNotifOpen(false); }}>
          {page === "Dashboard" && (
            <Dashboard
              name={profileName}
              allowance={allowance}
              period={allowancePeriod}
              daysInPeriod={daysInPeriod}
              dailyBudget={dailyBudget}
              spent={spent}
              remaining={remaining}
              expenses={expenses}
              navigate={navigate}
              openExpense={() => openExpense()}
              openAllowanceModal={() => setAllowanceModalOpen(true)}
            />
          )}
          {page === "Affordability" && <Affordability remaining={remaining} essentialBudget={reservedTotal} dailyBudget={dailyBudget} />}
          {page === "Expenses" && <ExpensesPage expenses={expenses} searchQuery={searchQuery} setSearchQuery={setSearchQuery} openExpense={openExpense} removeExpense={(id) => { setExpenses(expenses.filter((e) => e.id !== id)); setToast("Expense removed"); }} />}
          {page === "Budget Planner" && <BudgetPlanner allowance={allowance} setAllowance={setAllowance} period={allowancePeriod} setPeriod={setAllowancePeriod} essentialBudget={essentialBudget} setEssentialBudget={setEssentialBudget} savingsGoal={savingsGoal} setSavingsGoal={setSavingsGoal} spent={spent} onSave={() => { setHasSetup(true); setToast("Budget plan updated"); }} />}
          {page === "Reports" && <Reports expenses={expenses} spent={spent} />}
          {page === "Settings" && (
            <Settings
              user={currentUser}
              name={profileName}
              setName={(val) => {
                setProfileName(val);
                setCurrentUser({ ...currentUser, name: val });
              }}
              school={schoolName}
              setSchool={setSchoolName}
              avatarTheme={avatarTheme}
              setAvatarTheme={setAvatarTheme}
              period={allowancePeriod}
              setPeriod={setAllowancePeriod}
              schoolDays={schoolDaysPerWeek}
              setSchoolDays={setSchoolDaysPerWeek}
              savingsGoal={savingsGoal}
              setSavingsGoal={setSavingsGoal}
              notifications={notifications}
              setNotifications={setNotifications}
              expenseCount={expenses.length}
              hasClientId={Boolean(googleClientId.trim())}
              onSave={() => setToast("Settings saved")}
              onConnectGoogle={() => triggerGoogleOAuth()}
              onConfigureClientId={() => setGoogleConnectModalOpen(true)}
              onDisconnectGoogle={() => {
                const updated: UserAccount = {
                  ...currentUser,
                  provider: "email",
                  googleVerified: false,
                  googleEmail: undefined,
                  picture: undefined,
                };
                setCurrentUser(updated);
                const accounts = getStoredAccounts();
                const key = currentUser.email.toLowerCase();
                if (accounts[key]) {
                  accounts[key] = { ...accounts[key], provider: "email", googleVerified: false, googleEmail: undefined, picture: undefined };
                  saveStoredAccounts(accounts);
                }
                setToast("Google OAuth unlinked");
              }}
              onLogout={handleLogout}
              onExportCSV={handleExportCSV}
              onClearExpenses={handleClearExpenses}
              onReset={handleResetData}
            />
          )}
        </div>
      </main>
      {allowanceModalOpen && (
        <AllowanceSetupModal
          isInitial={!hasSetup}
          initialName={profileName === "Student" ? currentUser.name : profileName}
          initialAllowance={allowance}
          initialPeriod={allowancePeriod}
          initialEssential={essentialBudget}
          onClose={hasSetup ? () => setAllowanceModalOpen(false) : undefined}
          onSave={handleSaveAllowanceSetup}
        />
      )}
      {googleConnectModalOpen && (
        <GoogleConnectModal
          initialClientId={googleClientId}
          envConfigured={Boolean(envClientId)}
          onClose={() => setGoogleConnectModalOpen(false)}
          onSaveClientIdAndLaunch={(clientId) => {
            localStorage.setItem("baonwise-v2-google-client-id", clientId);
            setGoogleClientId(clientId);
            setGoogleConnectModalOpen(false);
            setTimeout(() => triggerGoogleOAuth(clientId), 100);
          }}
        />
      )}
      {modalOpen && <ExpenseModal expense={editing} onClose={() => setModalOpen(false)} onSave={(expense) => { setExpenses(editing ? expenses.map((e) => e.id === expense.id ? expense : e) : [expense, ...expenses]); setModalOpen(false); setToast(editing ? "Expense updated" : "Expense added"); }} />}
      {toast && <div className="toast"><span><Icon name="check" size={16} /></span>{toast}</div>}
    </div>
  );
}

function AuthScreen({
  onAuthenticated,
  onGoogleClick,
}: {
  onAuthenticated: (user: UserAccount, isNewAccount: boolean) => void;
  onGoogleClick: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return;

    const accounts = getStoredAccounts();
    const existing = accounts[cleanEmail];

    if (mode === "signup") {
      if (existing) {
        setError("An account with this email already exists. Please switch to 'Sign in'.");
        return;
      }
      const cleanName = name.trim() || cleanEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Student";
      const newAccount: StoredAccount = {
        email: cleanEmail,
        name: cleanName,
        password,
        provider: "email",
        googleVerified: false,
      };
      accounts[cleanEmail] = newAccount;
      saveStoredAccounts(accounts);
      onAuthenticated(
        {
          email: newAccount.email,
          name: newAccount.name,
          provider: "email",
          googleVerified: false,
        },
        true
      );
    } else {
      if (!existing) {
        setError("No account found for this email. Switch to 'Create account' to register first.");
        return;
      }
      if (!existing.password) {
        setError("This account was created with Google Sign-In. Please click 'Continue with Google'.");
        return;
      }
      if (existing.password !== password) {
        setError("Incorrect password. Please try again.");
        return;
      }
      onAuthenticated(
        {
          email: existing.email,
          name: existing.name,
          picture: existing.picture,
          provider: existing.provider,
          googleVerified: Boolean(existing.googleVerified),
          googleEmail: existing.googleEmail,
        },
        false
      );
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-showcase">
        <div className="brand">
          <div className="brand-mark"><span>₱</span></div>
          <div><strong>BaonWise</strong><small>Spend smart. Live well.</small></div>
        </div>
        <div className="auth-hero">
          <p className="eyebrow">Smart student budgeting</p>
          <h1>Make every peso of your baon count.</h1>
          <p className="page-description">
            Track daily expenses, set aside money for commute and meals, and check if you can afford purchases before you spend.
          </p>
          <div className="auth-features">
            <div className="auth-feature-item">
              <div className="icon-box"><Icon name="wallet" size={18} /></div>
              <div>
                <strong>Daily, Weekly, or Monthly Baon</strong>
                <span>Automatically calculates your safe daily spending limit.</span>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="icon-box"><Icon name="target" size={18} /></div>
              <div>
                <strong>“Can I Afford This?” Checker</strong>
                <span>Instant reality check before tapping or paying.</span>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="icon-box"><Icon name="chart" size={18} /></div>
              <div>
                <strong>Google OAuth 2.0 Support</strong>
                <span>Sign in with Google Identity Services or create a local email account.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <Card className="auth-card">
          <div className="auth-card-header">
            <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Get started"}</p>
            <h2>{mode === "signin" ? "Sign in to BaonWise" : "Create your student account"}</h2>
            <p>Use Google Sign-In (OAuth 2.0) or your email and password.</p>
          </div>

          <button type="button" className="google-auth-btn" onClick={onGoogleClick}>
            <GoogleLogo size={18} />
            <span>Continue with Google</span>
          </button>

          <div className="auth-divider"><span>or use email &amp; password</span></div>

          <div className="segmented auth-segmented">
            <button
              type="button"
              className={mode === "signin" ? "active" : ""}
              onClick={() => { setMode("signin"); setError(""); }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => { setMode("signup"); setError(""); }}
            >
              Create account
            </button>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <form onSubmit={submit}>
            {mode === "signup" && (
              <Field
                label="First name"
                placeholder="e.g. Mika"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <Field
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              required
            />
            <Field
              label="Password"
              type="password"
              placeholder="••••••••"
              minLength={4}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              required
            />
            <Button type="submit" className="auth-submit-btn">
              {mode === "signin" ? "Sign in" : "Create account"} <Icon name="arrow" size={16} />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function GoogleConnectModal({
  initialClientId,
  envConfigured,
  onClose,
  onSaveClientIdAndLaunch,
}: {
  initialClientId: string;
  envConfigured: boolean;
  onClose: () => void;
  onSaveClientIdAndLaunch: (clientId: string) => void;
}) {
  const [clientId, setClientId] = useState(initialClientId);

  const handleOAuthSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (clientId.trim()) {
      onSaveClientIdAndLaunch(clientId.trim());
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Google Identity Services (OAuth 2.0)</p>
            <h2>Configure Google Sign-In</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <form onSubmit={handleOAuthSubmit}>
          <p className="modal-subtitle">
            Real Google authentication requires an OAuth 2.0 Web Client ID from <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong> (with your local URL, e.g. <code>http://localhost:5173</code>, added under <em>Authorized JavaScript origins</em>).
          </p>
          <p className="modal-subtitle">
            You can set <code>VITE_GOOGLE_CLIENT_ID</code> in a <code>.env</code> file {envConfigured ? "(currently detected from .env)" : "(not yet set in .env)"} or paste your Client ID below:
          </p>
          <Field
            label="Google OAuth 2.0 Client ID"
            placeholder="1234567890-abc.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            autoFocus
          />
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit"><GoogleLogo size={15} /> Save &amp; Launch Google OAuth</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Dashboard({
  name,
  allowance,
  period,
  daysInPeriod,
  dailyBudget,
  spent,
  remaining,
  expenses,
  navigate,
  openExpense,
  openAllowanceModal,
}: {
  name: string;
  allowance: number;
  period: AllowancePeriod;
  daysInPeriod: number;
  dailyBudget: number;
  spent: number;
  remaining: number;
  expenses: Expense[];
  navigate: (page: Page) => void;
  openExpense: () => void;
  openAllowanceModal: () => void;
}) {
  const percent = allowance > 0 ? Math.min((spent / allowance) * 100, 100) : 0;
  const todayFormatted = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const periodLabel = period === "Daily" ? "Today" : period === "Weekly" ? "This week" : "This month";
  const windowLabel = period === "Daily" ? "1-day budget window" : `${daysInPeriod}-day budget window`;
  const dailySubLabel = period === "Daily" ? "For today" : `Across ${daysInPeriod} active days`;

  const weekly = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const exp of expenses) {
      const d = new Date(`${exp.date}T00:00:00`);
      if (!isNaN(d.getTime())) {
        const dayIndex = (d.getDay() + 6) % 7;
        totals[dayIndex] += exp.amount;
      }
    }
    return totals;
  }, [expenses]);

  const max = Math.max(...weekly, 1);
  const peakIndex = weekly.some((v) => v > 0) ? weekly.indexOf(Math.max(...weekly)) : -1;

  return <>
    <div className="dashboard-greeting">
      <div>
        <p className="eyebrow">{todayFormatted}</p>
        <h1>Magandang araw, {name}!</h1>
        <p className="page-description">
          {allowance > 0
            ? `Here’s how your ${period.toLowerCase()} allowance is looking.`
            : "Start by setting your allowance so we can calculate your daily budget."}
        </p>
      </div>
      <div className="greeting-actions">
        <Button variant="secondary" onClick={openAllowanceModal}>
          <Icon name="wallet" size={18} /> {allowance > 0 ? "Edit allowance" : "Set allowance"}
        </Button>
        <Button onClick={openExpense}><Icon name="plus" size={18} /> Add expense</Button>
      </div>
    </div>
    <div className="stat-grid">
      <Card className="stat-card blue clickable-card" >
        <div className="stat-top">
          <span>Total allowance</span>
          <button className="icon-box card-action-btn" onClick={openAllowanceModal} aria-label="Edit allowance" title="Edit allowance">
            <Icon name="edit" size={16} />
          </button>
        </div>
        <strong>{formatPeso(allowance)}</strong>
        <small>{allowance > 0 ? `${periodLabel} (${period.toLowerCase()})` : "Tap edit to set amount"}</small>
      </Card>
      <Card className="stat-card green">
        <div className="stat-top"><span>Remaining balance</span><div className="icon-box"><Icon name="wallet" /></div></div>
        <strong>{formatPeso(remaining)}</strong>
        <small className={remaining >= 0 && allowance > 0 ? "positive" : ""}>
          {allowance === 0 ? "No allowance set yet" : remaining >= 0 ? "You’re on track" : "Over budget"}
        </small>
      </Card>
      <Card className="stat-card coral">
        <div className="stat-top"><span>Total expenses</span><div className="icon-box"><Icon name="receipt" /></div></div>
        <strong>{formatPeso(spent)}</strong>
        <small>{allowance > 0 ? `${Math.round(percent)}% of allowance` : `${expenses.length} recorded`}</small>
      </Card>
      <Card className="stat-card yellow">
        <div className="stat-top"><span>Daily spending limit</span><div className="icon-box"><Icon name="calendar" /></div></div>
        <strong>{formatPeso(dailyBudget)}</strong>
        <small>{dailySubLabel}</small>
      </Card>
    </div>
    <div className="dashboard-grid">
      <div className="main-column">
        <Card className="budget-card">
          <div className="section-heading">
            <div><p className="eyebrow">{period} budget</p><h2>Spending overview</h2></div>
            <span className="status-pill">{allowance === 0 ? "Not set" : remaining >= 0 ? "On track" : "Over budget"}</span>
          </div>
          <div className="budget-numbers"><div><strong>{formatPeso(spent)}</strong><span>spent of {formatPeso(allowance)}</span></div><strong>{Math.round(percent)}%</strong></div>
          <div className="progress"><span style={{ width: `${percent}%` }} /></div>
          <div className="budget-footer"><span>{formatPeso(Math.max(remaining, 0))} left</span><span>{windowLabel}</span></div>
        </Card>
        <Card className="chart-card">
          <div className="section-heading"><div><p className="eyebrow">Activity</p><h2>Weekly spending</h2></div><button className="text-action" onClick={() => navigate("Reports")}>View report <Icon name="arrow" size={15} /></button></div>
          <div className="bar-chart">
            {weekly.map((value, index) => <div className="bar-item" key={index}><span className="bar-value">{formatPeso(value)}</span><div className="bar-track"><i style={{ height: `${value > 0 ? (value / max) * 100 : 4}%` }} className={index === peakIndex ? "peak" : ""} /></div><small>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</small></div>)}
          </div>
        </Card>
      </div>
      <div className="side-column">
        <Card className="afford-card">
          <div className="afford-orbit"><span>?</span></div><p className="eyebrow">Smart spending tool</p><h2>Can I afford this?</h2><p>Check before you spend. We’ll look at your balance and upcoming needs.</p><Button onClick={() => navigate("Affordability")}>Check an item <Icon name="arrow" size={16} /></Button>
        </Card>
        <Card className="recent-card">
          <div className="section-heading"><div><p className="eyebrow">Latest</p><h2>Recent expenses</h2></div><button className="text-action" onClick={() => navigate("Expenses")}>See all</button></div>
          {expenses.length > 0 ? (
            <div className="transaction-list">{expenses.slice(0, 4).map((expense) => <Transaction key={expense.id} expense={expense} />)}</div>
          ) : (
            <div className="empty-recent">
              <p>No expenses recorded yet.</p>
              <Button variant="secondary" onClick={openExpense}><Icon name="plus" size={15} /> Log first expense</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  </>;
}

function Transaction({ expense, actions }: { expense: Expense; actions?: ReactNode }) {
  return <div className="transaction"><div className="category-icon" style={{ background: `${categoryColors[expense.category]}24`, color: categoryColors[expense.category] }}><Icon name={expense.category === "Transportation" ? "wallet" : expense.category === "School" ? "receipt" : "target"} size={18} /></div><div className="transaction-info"><strong>{expense.name}</strong><span>{expense.category} · {new Date(`${expense.date}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span></div><strong className="amount">−{formatPeso(expense.amount)}</strong>{actions}</div>;
}

function Affordability({ remaining, essentialBudget, dailyBudget }: { remaining: number; essentialBudget: number; dailyBudget: number }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [checked, setChecked] = useState(false);
  const amount = Number(price);
  const safeToSpend = Math.max(remaining - essentialBudget, 0);
  const affordable = amount > 0 && amount <= safeToSpend && amount <= dailyBudget * 2;
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim() && amount > 0) setChecked(true); };
  return <>
    <PageHeader eyebrow="Spend with confidence" title="Can I afford this?" description="A quick reality check before you tap, swipe, or pay." />
    <div className="checker-grid">
      <Card className="checker-form">
        <div className="checker-icon"><Icon name="wallet" size={27} /></div><h2>Tell us what you’re eyeing</h2><p>We’ll compare it with your balance, essentials, and daily limit.</p>
        <form onSubmit={submit}><Field label="Item name" placeholder="e.g. New headphones" value={name} onChange={(e) => { setName(e.target.value); setChecked(false); }} required /><Field label="Price" type="number" min="1" placeholder="₱ 0.00" value={price} onChange={(e) => { setPrice(e.target.value); setChecked(false); }} required /><Button type="submit">Check affordability <Icon name="arrow" size={16} /></Button></form>
      </Card>
      <div className="checker-result">
        {!checked ? <Card className="empty-result"><div className="result-illustration"><span>₱</span></div><h2>Your answer will appear here</h2><p>Enter an item and its price to get a clear, personalized recommendation.</p></Card> :
          <Card className={`result-card ${affordable ? "yes" : "no"}`}><div className="result-badge"><Icon name={affordable ? "check" : "close"} size={26} /></div><p className="eyebrow">{affordable ? "Looks good" : "Pause and reconsider"}</p><h2>{affordable ? `Yes, you can afford the ${name}.` : `The ${name} may stretch your budget.`}</h2><p>{affordable ? "This purchase fits your current plan without touching money set aside for essentials or savings." : "Buying this now would dip into your essentials/savings or exceed a healthy daily spend."}</p><div className="result-math"><div><span>After purchase</span><strong>{formatPeso(remaining - amount)}</strong></div><div><span>Reserved (needs + ipon)</span><strong>{formatPeso(essentialBudget)}</strong></div><div><span>Comfortable spend</span><strong>{formatPeso(safeToSpend)}</strong></div></div><div className="recommendation"><strong>{affordable ? "BaonWise tip" : "A wiser move"}</strong><p>{affordable ? "You can go for it, but keep your next meal and commute costs in mind." : `Save ${formatPeso(Math.max(amount - safeToSpend, amount * 0.25))} more or wait until your next allowance.`}</p></div></Card>}
      </div>
    </div>
  </>;
}

function ExpensesPage({ expenses, searchQuery, setSearchQuery, openExpense, removeExpense }: { expenses: Expense[]; searchQuery: string; setSearchQuery: (q: string) => void; openExpense: (expense?: Expense) => void; removeExpense: (id: number) => void }) {
  const [filter, setFilter] = useState<"All" | Category>("All");
  const filtered = expenses.filter((item) => {
    const matchesCategory = filter === "All" || item.category === filter;
    const matchesSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  return <>
    <PageHeader eyebrow="Track every peso" title="Expenses" description="See where your money goes and keep your records tidy." action={<Button onClick={() => openExpense()}><Icon name="plus" size={18} /> Add expense</Button>} />
    <div className="filter-row">
      {["All", ...categories].map((category) => <button key={category} className={filter === category ? "active" : ""} onClick={() => setFilter(category as "All" | Category)}>{category}</button>)}
      {searchQuery && <button className="clear-search-pill" onClick={() => setSearchQuery("")}>Clear search: “{searchQuery}” ×</button>}
    </div>
    <Card className="expense-table">
      {filtered.length ? filtered.map((expense) => <Transaction key={expense.id} expense={expense} actions={<div className="row-actions"><button onClick={() => openExpense(expense)} aria-label={`Edit ${expense.name}`}><Icon name="edit" size={17} /></button><button onClick={() => { if (window.confirm(`Delete ${expense.name}?`)) removeExpense(expense.id); }} aria-label={`Delete ${expense.name}`}><Icon name="trash" size={17} /></button></div>} />) : <div className="empty-state"><div><Icon name="receipt" size={28} /></div><h2>No expenses here yet</h2><p>Add your first expense or try another category.</p><Button onClick={() => openExpense()}><Icon name="plus" size={17} /> Add expense</Button></div>}
    </Card>
  </>;
}

function BudgetPlanner({ allowance, setAllowance, period, setPeriod, essentialBudget, setEssentialBudget, savingsGoal, setSavingsGoal, spent, onSave }: { allowance: number; setAllowance: (n: number) => void; period: AllowancePeriod; setPeriod: (p: AllowancePeriod) => void; essentialBudget: number; setEssentialBudget: (n: number) => void; savingsGoal: number; setSavingsGoal: (n: number) => void; spent: number; onSave: () => void }) {
  const flexible = Math.max(allowance - essentialBudget - savingsGoal, 0);
  const essentialPct = allowance > 0 ? Math.min(((essentialBudget + savingsGoal) / allowance) * 100, 100) : 0;
  const spentPct = allowance > 0 ? Math.min((spent / allowance) * 100, 100) : 0;
  return <>
    <PageHeader eyebrow="Plan before you spend" title="Budget planner" description="Give every peso a purpose and make your allowance last." />
    <div className="planner-grid">
      <Card className="planner-form"><h2>Allowance plan</h2><p>Adjust your budget anytime as your needs change.</p><div className="segmented">{allowancePeriods.map((item) => <button key={item} type="button" className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div><Field label={`${period} allowance`} type="number" min="0" value={allowance || ""} placeholder="₱ 0" onChange={(e) => setAllowance(Number(e.target.value))} /><Field label="Reserve for necessities" type="number" min="0" max={allowance} value={essentialBudget || ""} placeholder="₱ 0" onChange={(e) => setEssentialBudget(Number(e.target.value))} /><Field label="Savings goal (ipon target)" type="number" min="0" max={allowance} value={savingsGoal || ""} placeholder="₱ 0" onChange={(e) => setSavingsGoal(Number(e.target.value))} /><Button onClick={onSave}>Save budget plan</Button></Card>
      <Card className="allocation-card"><div className="section-heading"><div><p className="eyebrow">Your allocation</p><h2>{formatPeso(allowance)} total</h2></div><span className="status-pill">{period}</span></div><div className="donut" style={{ background: `conic-gradient(var(--burgundy) 0 ${essentialPct}%, var(--blue) 0 100%)` }}><div><strong>{formatPeso(flexible)}</strong><span>flexible</span></div></div><div className="allocation-legend"><div><span className="dot dark" /><p><strong>Necessities &amp; Ipon</strong><small>{formatPeso(essentialBudget + savingsGoal)}</small></p></div><div><span className="dot blue" /><p><strong>Flexible spending</strong><small>{formatPeso(flexible)}</small></p></div></div><div className="plan-progress"><span>Current spending</span><strong>{formatPeso(spent)} of {formatPeso(allowance)}</strong><div className="progress"><span style={{ width: `${spentPct}%` }} /></div></div></Card>
    </div>
  </>;
}

function Reports({ expenses, spent }: { expenses: Expense[]; spent: number }) {
  const totals = useMemo(() => categories.map((category) => ({ category, total: expenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0) })).sort((a, b) => b.total - a.total), [expenses]);
  const top = totals[0]?.total > 0 ? totals[0] : null;
  return <>
    <PageHeader eyebrow="Know your habits" title="Spending reports" description="Simple patterns and insights to help your allowance go further." />
    <div className="report-summary"><Card><span>Total tracked</span><strong>{formatPeso(spent)}</strong><small>Across {expenses.length} transactions</small></Card><Card><span>Top category</span><strong>{top?.category || "—"}</strong><small>{formatPeso(top?.total || 0)} spent</small></Card><Card><span>Average expense</span><strong>{formatPeso(expenses.length ? spent / expenses.length : 0)}</strong><small>Per transaction</small></Card></div>
    <div className="reports-grid">
      <Card className="category-report"><div className="section-heading"><div><p className="eyebrow">Breakdown</p><h2>Spending by category</h2></div></div>{totals.map(({ category, total }) => <div className="category-bar" key={category}><div><span><i style={{ background: categoryColors[category] }} />{category}</span><strong>{formatPeso(total)}</strong></div><div className="track"><i style={{ width: `${spent ? total / spent * 100 : 0}%`, background: categoryColors[category] }} /></div></div>)}</Card>
      <Card className="insight-card"><div className="insight-mark"><Icon name="chart" size={24} /></div><p className="eyebrow">Smart insight</p><h2>{top ? `Your ${top.category.toLowerCase()} spending is your top category.` : "Start logging expenses to unlock insights."}</h2><p>{top ? `You’ve spent ${formatPeso(top.total)} on ${top.category.toLowerCase()} so far. Keeping an eye on your top category helps stretch your allowance.` : "Once you record a few transactions, BaonWise will highlight your biggest spending habits here."}</p><div className="insight-callout"><strong>Tip of the week</strong><span>Set aside your necessities first so you always know how much is safe to spend.</span></div></Card>
    </div>
  </>;
}

function Settings({
  user,
  name,
  setName,
  school,
  setSchool,
  avatarTheme,
  setAvatarTheme,
  period,
  setPeriod,
  schoolDays,
  setSchoolDays,
  savingsGoal,
  setSavingsGoal,
  notifications,
  setNotifications,
  expenseCount,
  hasClientId,
  onSave,
  onConnectGoogle,
  onConfigureClientId,
  onDisconnectGoogle,
  onLogout,
  onExportCSV,
  onClearExpenses,
  onReset,
}: {
  user: UserAccount;
  name: string;
  setName: (s: string) => void;
  school: string;
  setSchool: (s: string) => void;
  avatarTheme: AvatarTheme;
  setAvatarTheme: (t: AvatarTheme) => void;
  period: AllowancePeriod;
  setPeriod: (p: AllowancePeriod) => void;
  schoolDays: number;
  setSchoolDays: (d: number) => void;
  savingsGoal: number;
  setSavingsGoal: (n: number) => void;
  notifications: NotificationPrefs;
  setNotifications: (n: NotificationPrefs) => void;
  expenseCount: number;
  hasClientId: boolean;
  onSave: () => void;
  onConnectGoogle: () => void;
  onConfigureClientId: () => void;
  onDisconnectGoogle: () => void;
  onLogout: () => void;
  onExportCSV: () => void;
  onClearExpenses: () => void;
  onReset: () => void;
}) {
  const isGoogleVerified = Boolean(user.googleVerified && user.googleEmail);

  return <>
    <PageHeader
      eyebrow="Make it yours"
      title="Settings"
      description="Manage your profile, Google OAuth connection, budget preferences, and data."
      action={<Button variant="secondary" onClick={onLogout}><Icon name="logout" size={16} /> Sign out</Button>}
    />
    <div className="settings-grid">
      <Card className="settings-card">
        <h2>Profile &amp; Google Account</h2>
        <p>How you appear in BaonWise and your Google OAuth status.</p>
        <div className="profile-edit">
          <UserAvatar name={name} picture={user.picture} bg={avatarThemeColors[avatarTheme].bg} className="large-avatar" />
          <div>
            <strong>{name}</strong>
            <span>{school.trim() || user.googleEmail || user.email}</span>
          </div>
        </div>

        <div className="gmail-connection-box">
          <div className="gmail-box-info">
            <GoogleLogo size={20} />
            <div>
              <strong>{isGoogleVerified ? "Verified Google Account" : "Google Account Not Linked"}</strong>
              <span>
                {isGoogleVerified
                  ? `Authenticated via Google OAuth (${user.googleEmail})`
                  : `Signed in locally as ${user.email} (not Google-verified)`}
              </span>
            </div>
          </div>
          <div className="gmail-box-actions">
            {isGoogleVerified ? (
              <>
                <span className="status-pill">Verified</span>
                <button type="button" className="text-action" onClick={onConnectGoogle}>Switch</button>
                <button type="button" className="text-action danger-text" onClick={onDisconnectGoogle}>Unlink</button>
              </>
            ) : (
              <Button variant="secondary" type="button" onClick={onConnectGoogle}>
                <GoogleLogo size={15} /> {hasClientId ? "Verify with Google" : "Set up Google OAuth"}
              </Button>
            )}
          </div>
        </div>
        <div className="oauth-config-hint">
          <button type="button" className="text-action" onClick={onConfigureClientId}>
            {hasClientId ? "Update Google OAuth Client ID" : "Configure Google OAuth Client ID"}
          </button>
        </div>

        <Field label="First name" value={name} placeholder="e.g. Mika" onChange={(e) => setName(e.target.value)} />
        <Field label="School or course (optional)" value={school} placeholder="e.g. BS Computer Science" onChange={(e) => setSchool(e.target.value)} />
        <div className="field">
          <span>Avatar color</span>
          <div className="avatar-swatches">
            {(Object.keys(avatarThemeColors) as AvatarTheme[]).map((themeKey) => (
              <button
                key={themeKey}
                type="button"
                className={`swatch-btn ${avatarTheme === themeKey ? "active" : ""}`}
                style={{ background: avatarThemeColors[themeKey].bg }}
                onClick={() => setAvatarTheme(themeKey)}
                title={avatarThemeColors[themeKey].label}
                aria-label={avatarThemeColors[themeKey].label}
              >
                {avatarTheme === themeKey && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={onSave}>Save profile</Button>
      </Card>

      <Card className="settings-card">
        <h2>Notifications</h2>
        <p>Choose which money nudges appear in your notification bell.</p>
        <Toggle
          title="Daily budget reminder"
          description="A quick note about your daily spending limit."
          checked={notifications.dailyReminder}
          onChange={(checked) => setNotifications({ ...notifications, dailyReminder: checked })}
        />
        <Toggle
          title="Low balance alert"
          description={`Know when your balance drops below ${notifications.lowBalanceThreshold}%.`}
          checked={notifications.lowBalanceAlert}
          onChange={(checked) => setNotifications({ ...notifications, lowBalanceAlert: checked })}
        />
        {notifications.lowBalanceAlert && (
          <div className="threshold-row">
            <span>Alert threshold</span>
            <div className="threshold-pills">
              {[15, 20, 30].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  className={notifications.lowBalanceThreshold === pct ? "active" : ""}
                  onClick={() => setNotifications({ ...notifications, lowBalanceThreshold: pct })}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}
        <Toggle
          title="Cycle summary"
          description="Review your total tracked expenses and habits."
          checked={notifications.weeklySummary}
          onChange={(checked) => setNotifications({ ...notifications, weeklySummary: checked })}
        />
      </Card>

      <Card className="settings-card">
        <h2>Allowance preferences</h2>
        <p>Customize how BaonWise computes your safe daily spending limit.</p>
        <div className="field">
          <span>Default allowance timeframe</span>
          <div className="segmented modal-segmented">
            {allowancePeriods.map((item) => (
              <button
                key={item}
                type="button"
                className={period === item ? "active" : ""}
                onClick={() => setPeriod(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {period === "Weekly" && (
          <div className="field">
            <span>Active spending days per week</span>
            <div className="segmented modal-segmented">
              {[5, 6, 7].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={schoolDays === days ? "active" : ""}
                  onClick={() => setSchoolDays(days)}
                >
                  {days === 5 ? "5 school days" : days === 6 ? "6 days" : "All 7 days"}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field
          label="Savings goal / Ipon target (₱)"
          type="number"
          min="0"
          placeholder="e.g. 200"
          value={savingsGoal || ""}
          onChange={(e) => setSavingsGoal(Math.max(Number(e.target.value) || 0, 0))}
        />
        <Button onClick={onSave}>Save preferences</Button>
      </Card>

      <Card className="settings-card">
        <h2>Data &amp; backup</h2>
        <p>Export your records or start fresh for a new allowance cycle.</p>
        <div className="data-action-row">
          <div>
            <strong>Export expense history</strong>
            <span>Download your {expenseCount} recorded transaction{expenseCount === 1 ? "" : "s"} as a CSV spreadsheet.</span>
          </div>
          <Button variant="secondary" type="button" onClick={onExportCSV}>
            <Icon name="download" size={16} /> Export CSV
          </Button>
        </div>
        <div className="data-action-row">
          <div>
            <strong>Start new allowance cycle</strong>
            <span>Clear recorded expenses while keeping your profile and allowance setup.</span>
          </div>
          <Button variant="secondary" type="button" onClick={onClearExpenses}>
            <Icon name="refresh" size={16} /> Clear expenses
          </Button>
        </div>
        <div className="data-action-row last">
          <div>
            <strong>Factory reset</strong>
            <span>Erase all profile, allowance, and expense data for this account.</span>
          </div>
          <Button variant="danger" type="button" onClick={onReset}>
            <Icon name="trash" size={16} /> Reset all data
          </Button>
        </div>
      </Card>
    </div>
  </>;
}

function Toggle({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="toggle-row"><div><strong>{title}</strong><span>{description}</span></div><button className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} aria-label={`Toggle ${title}`} aria-pressed={checked}><i /></button></div>;
}

function AllowanceSetupModal({
  isInitial,
  initialName,
  initialAllowance,
  initialPeriod,
  initialEssential,
  onClose,
  onSave,
}: {
  isInitial: boolean;
  initialName: string;
  initialAllowance: number;
  initialPeriod: AllowancePeriod;
  initialEssential: number;
  onClose?: () => void;
  onSave: (data: { name: string; allowance: number; period: AllowancePeriod; essentialBudget: number }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [period, setPeriod] = useState<AllowancePeriod>(initialPeriod);
  const [allowance, setAllowance] = useState(initialAllowance > 0 ? String(initialAllowance) : "");
  const [essential, setEssential] = useState(initialEssential > 0 ? String(initialEssential) : "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const allowanceNum = Math.max(Number(allowance) || 0, 0);
    const essentialNum = Math.min(Math.max(Number(essential) || 0, 0), allowanceNum);
    if (allowanceNum > 0) {
      onSave({ name: name.trim() || "Student", allowance: allowanceNum, period, essentialBudget: essentialNum });
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{isInitial ? "Welcome to BaonWise" : "Update budget"}</p>
            <h2>{isInitial ? "Set your starting allowance" : "Edit your allowance"}</h2>
          </div>
          {onClose && <button onClick={onClose} aria-label="Close"><Icon name="close" /></button>}
        </div>
        <p className="modal-subtitle">
          {isInitial
            ? "Tell us your name and how much baon or allowance you have so we can personalize your dashboard."
            : "Update your current allowance timeframe, amount, and reserved budget for essentials."}
        </p>
        <form onSubmit={submit}>
          <Field
            label="Your first name"
            placeholder="e.g. Mika"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <div className="field">
            <span>Allowance timeframe</span>
            <div className="segmented modal-segmented">
              {allowancePeriods.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={period === item ? "active" : ""}
                  onClick={() => setPeriod(item)}
                >
                  {item === "Daily" ? "A Day" : item === "Weekly" ? "A Week" : "A Month"}
                </button>
              ))}
            </div>
          </div>
          <Field
            label={`${period} allowance (₱)`}
            type="number"
            min="1"
            placeholder={period === "Daily" ? "e.g. 250" : period === "Weekly" ? "e.g. 1500" : "e.g. 6000"}
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            required
          />
          <Field
            label="Reserved for necessities like fare & meals (optional, ₱)"
            type="number"
            min="0"
            max={allowance || undefined}
            placeholder={period === "Daily" ? "e.g. 100" : period === "Weekly" ? "e.g. 500" : "e.g. 2000"}
            value={essential}
            onChange={(e) => setEssential(e.target.value)}
          />
          <div className="modal-actions">
            {onClose && <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>}
            <Button type="submit">{isInitial ? "Start tracking" : "Save allowance"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpenseModal({ expense, onClose, onSave }: { expense: Expense | null; onClose: () => void; onSave: (expense: Expense) => void }) {
  const [name, setName] = useState(expense?.name || "");
  const [amount, setAmount] = useState(expense?.amount.toString() || "");
  const [category, setCategory] = useState<Category>(expense?.category || "Food");
  const [date, setDate] = useState(expense?.date || new Date().toISOString().slice(0, 10));
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim() && Number(amount) > 0) onSave({ id: expense?.id || Date.now(), name: name.trim(), amount: Number(amount), category, date }); };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true"><div className="modal-header"><div><p className="eyebrow">{expense ? "Update record" : "Track your spending"}</p><h2>{expense ? "Edit expense" : "Add an expense"}</h2></div><button onClick={onClose} aria-label="Close"><Icon name="close" /></button></div><form onSubmit={submit}><Field label="What did you spend on?" placeholder="e.g. Lunch at canteen" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /><Field label="Amount" type="number" min="1" placeholder="₱ 0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required /><div className="field-pair"><SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>{categories.map((item) => <option key={item}>{item}</option>)}</SelectField><Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div><div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{expense ? "Save changes" : "Add expense"}</Button></div></form></div></div>;
}

export default App;
