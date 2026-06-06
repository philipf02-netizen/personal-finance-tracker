"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Plus,
  Trash,
  Pencil,
  X,
  DollarSign,
  Activity,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Upload,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Entities ─────────────────────────────────────────────────────────────────

type EntityType = "phc" | "pfi" | "personal";

const ENTITIES: Array<{
  id: EntityType;
  label: string;
  short: string;
  activeBg: string;
  accentText: string;
}> = [
  { id: "phc",      label: "Performance Hearing Center", short: "PHC",          activeBg: "bg-blue-600",    accentText: "text-blue-400" },
  { id: "pfi",      label: "Philip Fernandes Insurance", short: "PF Insurance", activeBg: "bg-purple-600",  accentText: "text-purple-400" },
  { id: "personal", label: "Personal Household",         short: "Personal",     activeBg: "bg-emerald-600", accentText: "text-emerald-400" },
];

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  type: "income" | "expense";
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  date: string;
  entity: EntityType;
}

interface ImportRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  entity?: EntityType;  // stamped in handleFile after parse
  skip: boolean; // auto-flagged payments/transfers
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  "Housing",
  "Food & Dining",
  "Transportation",
  "Entertainment",
  "Healthcare",
  "Education",
  "Shopping",
  "Utilities",
  "Insurance",
  "Other",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Business",
  "Bonus",
  "Other",
];

type SubcategoryMap = Record<string, string[]>;

const EXPENSE_SUBCATEGORIES: SubcategoryMap = {
  "Housing":        ["Rent/Mortgage", "HOA Fees", "Repairs & Maintenance", "Furniture", "Supplies"],
  "Food & Dining":  ["Groceries", "Restaurants", "Fast Food", "Coffee Shops", "Food Delivery"],
  "Transportation": ["Gas", "Car Payment", "Car Insurance", "Parking", "Rideshare", "Public Transit", "Maintenance"],
  "Entertainment":  ["Streaming Services", "Movies & Theater", "Concerts & Events", "Hobbies", "Sports"],
  "Healthcare":     ["Doctor Visits", "Dentist", "Pharmacy", "Health Insurance", "Gym & Fitness"],
  "Education":      ["Tuition", "Books & Supplies", "Online Courses", "Tutoring"],
  "Shopping":       ["Clothing", "Electronics", "Home Goods", "Personal Care", "Gifts"],
  "Utilities":      ["Electric", "Gas/Heating", "Water", "Internet", "Phone/Mobile", "Cable/Streaming"],
  "Insurance":      ["Health Insurance", "Auto Insurance", "Home Insurance", "Life Insurance"],
  "Other":          [],
};

const INCOME_SUBCATEGORIES: SubcategoryMap = {
  "Salary":     ["Regular Pay", "Overtime", "Commission", "Tips"],
  "Freelance":  ["Design", "Writing", "Development", "Consulting", "Other Projects"],
  "Investment": ["Dividends", "Capital Gains", "Interest", "Rental Income"],
  "Business":   ["Sales Revenue", "Service Revenue", "Reimbursement"],
  "Bonus":      ["Performance Bonus", "Holiday Bonus", "Referral"],
  "Other":      [],
};

const CAT_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

const today = new Date().toISOString().split("T")[0];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: "1", type: "income",  category: "Salary",         description: "Monthly salary",       amount: 5000, date: today, entity: "personal" },
  { id: "2", type: "expense", category: "Housing",        description: "Rent",                 amount: 1500, date: today, entity: "personal" },
  { id: "3", type: "expense", category: "Food & Dining",  description: "Groceries",            amount: 380,  date: today, entity: "personal" },
  { id: "4", type: "expense", category: "Transportation", description: "Car payment + gas",    amount: 420,  date: today, entity: "personal" },
  { id: "5", type: "expense", category: "Entertainment",  description: "Streaming + dining",   amount: 120,  date: today, entity: "personal" },
  { id: "6", type: "expense", category: "Utilities",      description: "Electric & internet",  amount: 160,  date: today, entity: "personal" },
  { id: "7", type: "expense", category: "Healthcare",     description: "Gym membership",       amount: 50,   date: today, entity: "personal" },
  { id: "8", type: "income",  category: "Freelance",      description: "Side project",         amount: 800,  date: today, entity: "personal" },
];

// ─── CSV Parsing Utilities ────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

type BankType = "chase" | "bofa-cc" | "bofa-checking" | "citi" | "amex" | "unknown";

function detectBank(headers: string[]): BankType {
  const h = headers.map((s) => s.toLowerCase().replace(/['"]/g, "").trim());
  if (h.some((v) => v === "transaction date") && h.some((v) => v === "post date")) return "chase";
  // BofA CC: "Posted Date" (or "Posting Date") + "Reference Number"
  if (
    h.some((v) => v === "posted date" || v === "posting date") &&
    h.some((v) => v.includes("reference number"))
  ) return "bofa-cc";
  // BofA Checking: has "Running Bal." column
  if (h.some((v) => v.includes("running bal"))) return "bofa-checking";
  if (h.some((v) => v === "debit") && h.some((v) => v === "credit") && h.some((v) => v === "status")) return "citi";
  if (h.some((v) => v.includes("extended details")) || h.some((v) => v.includes("appears on your statement"))) return "amex";
  // Fallback: generic CSV with date + amount (treat as BofA Checking layout)
  if (h.some((v) => v === "date") && h.some((v) => v.includes("amount"))) return "bofa-checking";
  return "unknown";
}

const BANK_CATEGORY_MAP: Record<string, string> = {
  "food & drink": "Food & Dining",
  "food and drink": "Food & Dining",
  "groceries": "Food & Dining",
  "restaurants": "Food & Dining",
  "dining": "Food & Dining",
  "supermarkets": "Food & Dining",
  "gas": "Transportation",
  "gas stations": "Transportation",
  "travel": "Transportation",
  "auto & transport": "Transportation",
  "auto and transport": "Transportation",
  "airlines": "Transportation",
  "parking": "Transportation",
  "rideshare": "Transportation",
  "entertainment": "Entertainment",
  "arts": "Entertainment",
  "movies": "Entertainment",
  "music": "Entertainment",
  "shopping": "Shopping",
  "merchandise & supplies": "Shopping",
  "merchandise and supplies": "Shopping",
  "retail": "Shopping",
  "bills & utilities": "Utilities",
  "bills and utilities": "Utilities",
  "utilities": "Utilities",
  "cable & internet": "Utilities",
  "cable and internet": "Utilities",
  "telephone": "Utilities",
  "health & wellness": "Healthcare",
  "health and wellness": "Healthcare",
  "medical services": "Healthcare",
  "healthcare": "Healthcare",
  "pharmacy": "Healthcare",
  "personal care": "Healthcare",
  "gym": "Healthcare",
  "education": "Education",
  "tuition": "Education",
  "home": "Housing",
  "mortgage & rent": "Housing",
  "mortgage and rent": "Housing",
  "insurance": "Insurance",
};

const DESC_PATTERN_MAP: Array<[RegExp, string]> = [
  [/restaurant|cafe|coffee|pizza|mcdonald|starbucks|chipotle|doordash|uber eats|grubhub|panera|subway|chick.fil|taco bell|burger king|wendy|olive garden|applebee|denny|ihop|waffle house|five guys|in.n.out|shake shack|panda express|noodles/i, "Food & Dining"],
  [/grocery|safeway|kroger|whole foods|trader joe|aldi|publix|heb |food lion|smart & final|vons|ralphs|sprouts|costco food|walmart grocery|target grocery/i, "Food & Dining"],
  [/netflix|hulu|spotify|disney\+|hbo|apple tv|peacock|paramount\+|youtube premium|sling |fubo|crunchyroll|amazon prime/i, "Entertainment"],
  [/amazon(?! web services)(?! aws)|walmart(?! grocery)|target(?! grocery)|costco|best buy|home depot|lowes|tj maxx|marshalls|nordstrom|macy|gap |old navy|h&m|zara|wayfair|ikea|ebay/i, "Shopping"],
  [/\buber(?! eats)\b|lyft|shell |chevron|bp (?!harris|biden)|exxon|mobil|marathon|sunoco|speedway|citgo|arco |kwik|circle k|gas station|speedway|pilot flying|loves travel/i, "Transportation"],
  [/at&t|verizon|t-mobile|comcast|xfinity|spectrum |cox |centurylink|frontier comm|pg&e|southern cal edison|con edison|duke energy|dominion energy|internet service/i, "Utilities"],
  [/cvs |walgreen|rite aid |pharmacy|urgent care|planet fitness|24 hour fitness|la fitness|ymca|equinox|anytime fitness|crunch fitness|orange theory/i, "Healthcare"],
  [/rent |mortgage|landlord|apartment|hoa |homeowners assoc/i, "Housing"],
  [/state farm|allstate|geico |progressive |liberty mutual|usaa insurance|travelers insurance|farmers insurance/i, "Insurance"],
];

function guessExpenseCategory(bankCat: string, description: string): string {
  const catKey = bankCat.toLowerCase().trim();
  if (BANK_CATEGORY_MAP[catKey]) return BANK_CATEGORY_MAP[catKey];
  for (const [re, cat] of DESC_PATTERN_MAP) {
    if (re.test(description)) return cat;
  }
  return "Other";
}

function guessIncomeCategory(description: string): string {
  const d = description.toUpperCase();
  if (/PAYROLL|SALARY|DIRECT DEP|EMPLOYER|PAYCHEX|ADP |INTUIT PAY/.test(d)) return "Salary";
  if (/FREELANCE|CONSULTING|INVOICE|UPWORK|FIVERR/.test(d)) return "Freelance";
  if (/DIVIDEND|INTEREST|FIDELITY|VANGUARD|SCHWAB|ROBINHOOD|COINBASE|INVESTMENT/.test(d)) return "Investment";
  if (/BONUS/.test(d)) return "Bonus";
  return "Other";
}

function isSkippable(description: string, chaseType?: string): boolean {
  if (chaseType === "Payment") return true;
  const d = description.toUpperCase();
  return /PAYMENT THANK YOU|AUTOPAY PAYMENT|ONLINE PMT|MOBILE PAYMENT|ONLINE PAYMENT|AUTOMATIC PAYMENT|AUTO PAY/.test(d) &&
    !/DOWN PAYMENT/.test(d);
}

function formatDate(raw: string): string {
  // Convert MM/DD/YYYY → YYYY-MM-DD
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return raw;
}

function parseChase(rows: string[][], headers: string[]): ImportRow[] {
  const h = headers.map((s) => s.toLowerCase().trim());
  const idx = {
    date: h.findIndex((v) => v.includes("transaction date")),
    desc: h.findIndex((v) => v === "description"),
    cat: h.findIndex((v) => v === "category"),
    type: h.findIndex((v) => v === "type"),
    amount: h.findIndex((v) => v === "amount"),
  };
  return rows
    .filter((r) => r.length > 3 && r[idx.amount])
    .map((row) => {
      const rawAmount = parseFloat((row[idx.amount] || "0").replace(/[$,\s]/g, ""));
      const chaseType = (row[idx.type] || "").trim();
      const description = (row[idx.desc] || "").trim();
      const bankCat = (row[idx.cat] || "").trim();
      const isExpense = rawAmount < 0;
      return {
        id: crypto.randomUUID(),
        date: formatDate((row[idx.date] || "").trim()),
        description,
        amount: Math.abs(rawAmount),
        type: isExpense ? "expense" : "income",
        category: isExpense ? guessExpenseCategory(bankCat, description) : guessIncomeCategory(description),
        skip: isSkippable(description, chaseType),
      };
    });
}

function parseBofACC(rows: string[][], headers: string[]): ImportRow[] {
  const h = headers.map((s) => s.toLowerCase().trim());
  const idx = {
    // Accept "Posted Date" or "Posting Date"
    date: h.findIndex((v) => v.includes("posted date") || v.includes("posting date")),
    // Accept "Payee", "Description", or "Merchant Name"
    payee: h.findIndex((v) => v === "payee" || v === "description" || v.includes("merchant")),
    amount: h.findIndex((v) => v === "amount"),
  };
  return rows
    .filter((r) => r.length > 2 && idx.amount >= 0 && r[idx.amount])
    .map((row) => {
      const rawAmount = parseFloat((row[idx.amount] || "0").replace(/[$,\s]/g, ""));
      const description = (idx.payee >= 0 ? row[idx.payee] : "").trim();
      const isExpense = rawAmount > 0; // BofA CC: positive = charge
      return {
        id: crypto.randomUUID(),
        date: formatDate((idx.date >= 0 ? row[idx.date] : "").trim()),
        description,
        amount: Math.abs(rawAmount),
        type: isExpense ? "expense" : "income",
        category: isExpense ? guessExpenseCategory("", description) : guessIncomeCategory(description),
        skip: isSkippable(description),
      };
    });
}

function parseBofAChecking(rows: string[][], headers: string[]): ImportRow[] {
  const h = headers.map((s) => s.toLowerCase().trim());
  const dateIdx = h.findIndex((v) => v === "date" || v.includes("trans date") || v.includes("transaction date"));
  const descIdx = h.findIndex((v) => v === "description" || v === "payee" || v.includes("merchant"));
  const amtIdx  = h.findIndex((v) => v === "amount" || v.includes("debit amount") || v.includes("credit amount"));
  return rows
    .filter((r) => r.length > 2 && amtIdx >= 0 && r[amtIdx])
    .map((row) => {
      const rawAmount = parseFloat((row[amtIdx] || "0").replace(/[$,\s]/g, ""));
      const description = (descIdx >= 0 ? row[descIdx] : "").trim();
      const isExpense = rawAmount < 0; // BofA checking: negative = debit
      return {
        id: crypto.randomUUID(),
        date: formatDate((dateIdx >= 0 ? row[dateIdx] : "").trim()),
        description,
        amount: Math.abs(rawAmount),
        type: isExpense ? "expense" : "income",
        category: isExpense ? guessExpenseCategory("", description) : guessIncomeCategory(description),
        skip: isSkippable(description),
      };
    });
}

function parseCiti(rows: string[][], headers: string[]): ImportRow[] {
  const h = headers.map((s) => s.toLowerCase().trim());
  const idx = {
    date: h.findIndex((v) => v === "date"),
    desc: h.findIndex((v) => v === "description"),
    debit: h.findIndex((v) => v === "debit"),
    credit: h.findIndex((v) => v === "credit"),
  };
  return rows
    .filter((r) => r.length > 2)
    .map((row) => {
      const debit = parseFloat((row[idx.debit] || "0").replace(/[$,\s]/g, "")) || 0;
      const credit = parseFloat((row[idx.credit] || "0").replace(/[$,\s]/g, "")) || 0;
      const description = (row[idx.desc] || "").trim();
      const isExpense = debit > 0;
      const amount = isExpense ? debit : credit;
      return {
        id: crypto.randomUUID(),
        date: formatDate((row[idx.date] || "").trim()),
        description,
        amount,
        type: isExpense ? "expense" : "income",
        category: isExpense ? guessExpenseCategory("", description) : guessIncomeCategory(description),
        skip: !isExpense && isSkippable(description),
      };
    });
}

function parseAmex(rows: string[][], headers: string[]): ImportRow[] {
  const h = headers.map((s) => s.toLowerCase().trim());
  const idx = {
    date: h.findIndex((v) => v === "date"),
    desc: h.findIndex((v) => v === "description"),
    amount: h.findIndex((v) => v === "amount"),
    cat: h.findIndex((v) => v === "category"),
  };
  return rows
    .filter((r) => r.length > 2 && r[idx.amount])
    .map((row) => {
      const rawAmount = parseFloat((row[idx.amount] || "0").replace(/[$,\s]/g, ""));
      const description = (row[idx.desc] || "").trim();
      const bankCat = idx.cat >= 0 ? (row[idx.cat] || "").trim() : "";
      const isExpense = rawAmount > 0; // Amex: positive = charge
      return {
        id: crypto.randomUUID(),
        date: formatDate((row[idx.date] || "").trim()),
        description,
        amount: Math.abs(rawAmount),
        type: isExpense ? "expense" : "income",
        category: isExpense ? guessExpenseCategory(bankCat, description) : guessIncomeCategory(description),
        skip: isSkippable(description),
      };
    });
}

const BANK_DISPLAY_NAMES: Record<string, string> = {
  chase: "Chase",
  "bofa-cc": "Bank of America (Credit Card)",
  "bofa-checking": "Bank of America (Checking)",
  citi: "Citi",
  amex: "American Express",
};

function parseCSV(text: string): { bank: string; rows: ImportRow[]; error?: string } {
  // Strip BOM
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { bank: "", rows: [], error: "File appears empty or contains no data rows." };

  // ── Find the real header row ──────────────────────────────────────────────
  // BofA (and some other banks) prepend metadata lines before the CSV header.
  // Scan up to the first 10 lines and use the first one that is recognized.
  let headerLineIdx = 0;
  let bank: BankType = "unknown";
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const candidate = parseCSVLine(lines[i]);
    const detected = detectBank(candidate);
    if (detected !== "unknown") {
      headerLineIdx = i;
      bank = detected;
      break;
    }
  }

  const headers = parseCSVLine(lines[headerLineIdx]);

  if (bank === "unknown") {
    return {
      bank: "",
      rows: [],
      error: "Bank format not recognized. Supported: Chase, Bank of America (Checking & Credit Card), Citi, American Express.",
    };
  }

  const dataRows = lines.slice(headerLineIdx + 1).map((l) => parseCSVLine(l));
  let rows: ImportRow[] = [];

  switch (bank) {
    case "chase": rows = parseChase(dataRows, headers); break;
    case "bofa-cc": rows = parseBofACC(dataRows, headers); break;
    case "bofa-checking": rows = parseBofAChecking(dataRows, headers); break;
    case "citi": rows = parseCiti(dataRows, headers); break;
    case "amex": rows = parseAmex(dataRows, headers); break;
  }

  // Remove zero-amount rows
  rows = rows.filter((r) => r.amount > 0);

  if (rows.length === 0) {
    return { bank: BANK_DISPLAY_NAMES[bank] || bank, rows: [], error: "No transactions found in this file." };
  }

  // Sort newest first
  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { bank: BANK_DISPLAY_NAMES[bank] || bank, rows };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BudgetTracker() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    subcategory: "",
    description: "",
    amount: "",
    date: today,
  });

  // CSV import state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvStep, setCsvStep] = useState<"upload" | "review">("upload");
  const [csvRows, setCsvRows] = useState<ImportRow[]>([]);
  const [csvBank, setCsvBank] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Entity & edit state ────────────────────────────────────────────────
  const [activeEntity, setActiveEntity] = useState<EntityType>("personal");
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Custom categories ───────────────────────────────────────────────────
  const [customExpenseCats, setCustomExpenseCats] = useState<string[]>([]);
  const [customIncomeCats, setCustomIncomeCats]  = useState<string[]>([]);
  const [addingCategory, setAddingCategory]      = useState(false);
  const [newCatInput, setNewCatInput]            = useState("");
  const [customExpenseSubcats, setCustomExpenseSubcats] = useState<SubcategoryMap>({});
  const [customIncomeSubcats, setCustomIncomeSubcats]   = useState<SubcategoryMap>({});
  const [addingSubcategory, setAddingSubcategory]       = useState(false);
  const [newSubcatInput, setNewSubcatInput]             = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ft-transactions");
    setTransactions(saved ? JSON.parse(saved) : DEFAULT_TRANSACTIONS);
    const savedExpCats = localStorage.getItem("ft-custom-expense-cats");
    const savedIncCats = localStorage.getItem("ft-custom-income-cats");
    if (savedExpCats) setCustomExpenseCats(JSON.parse(savedExpCats));
    if (savedIncCats) setCustomIncomeCats(JSON.parse(savedIncCats));
    const savedExpSubcats = localStorage.getItem("ft-custom-expense-subcats");
    const savedIncSubcats = localStorage.getItem("ft-custom-income-subcats");
    if (savedExpSubcats) setCustomExpenseSubcats(JSON.parse(savedExpSubcats));
    if (savedIncSubcats) setCustomIncomeSubcats(JSON.parse(savedIncSubcats));
  }, []);

  useEffect(() => {
    localStorage.setItem("ft-transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("ft-custom-expense-cats", JSON.stringify(customExpenseCats));
  }, [customExpenseCats]);

  useEffect(() => {
    localStorage.setItem("ft-custom-income-cats", JSON.stringify(customIncomeCats));
  }, [customIncomeCats]);

  useEffect(() => {
    localStorage.setItem("ft-custom-expense-subcats", JSON.stringify(customExpenseSubcats));
  }, [customExpenseSubcats]);

  useEffect(() => {
    localStorage.setItem("ft-custom-income-subcats", JSON.stringify(customIncomeSubcats));
  }, [customIncomeSubcats]);

  // ── Filter transactions to active entity (existing data defaults to "personal") ──
  const filteredTransactions = useMemo(
    () => transactions.filter((t) => (t.entity ?? "personal") === activeEntity),
    [transactions, activeEntity]
  );

  const summary = useMemo(() => {
    const income = filteredTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = filteredTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    return { income, expenses, savings, savingsRate };
  }, [filteredTransactions]);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const monthlyComparison = useMemo(() => {
    return [
      { name: "Income", amount: summary.income, fill: "#10b981" },
      { name: "Expenses", amount: summary.expenses, fill: "#ef4444" },
      { name: "Savings", amount: Math.max(0, summary.savings), fill: "#3b82f6" },
    ];
  }, [summary]);

  const addTransaction = useCallback(() => {
    if (!form.category || !form.description || !form.amount || !form.date) return;
    if (editingId) {
      // ── Edit existing transaction ──────────────────────────────────────
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                type: form.type,
                category: form.category,
                subcategory: form.subcategory || undefined,
                description: form.description,
                amount: parseFloat(form.amount),
                date: form.date,
              }
            : t
        )
      );
      setEditingId(null);
    } else {
      // ── Add new transaction ────────────────────────────────────────────
      const t: Transaction = {
        id: crypto.randomUUID(),
        type: form.type,
        category: form.category,
        subcategory: form.subcategory || undefined,
        description: form.description,
        amount: parseFloat(form.amount),
        date: form.date,
        entity: activeEntity,
      };
      setTransactions((prev) => [t, ...prev]);
    }
    setAddingSubcategory(false);
    setNewSubcatInput("");
    setForm({ type: "expense", category: "", subcategory: "", description: "", amount: "", date: today });
    setOpen(false);
  }, [form, editingId, activeEntity]);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startEdit = useCallback((t: Transaction) => {
    setForm({
      type: t.type,
      category: t.category,
      subcategory: t.subcategory ?? "",
      description: t.description,
      amount: t.amount.toString(),
      date: t.date,
    });
    setEditingId(t.id);
    setOpen(true);
  }, []);

  const clearAll = useCallback(() => {
    setTransactions((prev) => prev.filter((t) => (t.entity ?? "personal") !== activeEntity));
  }, [activeEntity]);

  // ── CSV import handlers ──────────────────────────────────────────────────

  const resetCsvDialog = useCallback(() => {
    setCsvOpen(false);
    setCsvStep("upload");
    setCsvRows([]);
    setCsvBank("");
    setCsvError(null);
    setSelectedIds(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    setCsvError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || "";
        const { bank, rows, error } = parseCSV(text);
        if (error) { setCsvError(error); return; }
        setCsvBank(bank);
        const stamped = rows.map((r) => ({ ...r, entity: activeEntity }));
        setCsvRows(stamped);
        setSelectedIds(new Set(stamped.filter((r) => !r.skip).map((r) => r.id)));
        setCsvStep("review");
      } catch {
        setCsvError("Failed to parse the file. Please try a different export.");
      }
    };
    reader.readAsText(file);
  }, []);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateRowCategory = useCallback((id: string, category: string) => {
    setCsvRows((prev) => prev.map((r) => (r.id === id ? { ...r, category } : r)));
  }, []);

  const updateRowEntity = useCallback((id: string, entity: EntityType) => {
    setCsvRows((prev) => prev.map((r) => (r.id === id ? { ...r, entity } : r)));
  }, []);

  const assignAllEntity = useCallback((entity: EntityType) => {
    setCsvRows((prev) => prev.map((r) => ({ ...r, entity })));
  }, []);

  const importSelected = useCallback(() => {
    const toImport: Transaction[] = csvRows
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({
        id: crypto.randomUUID(),
        type: r.type,
        category: r.category,
        description: r.description,
        amount: r.amount,
        date: r.date,
        entity: r.entity ?? activeEntity,
      }));
    if (toImport.length === 0) return;
    setTransactions((prev) => [...toImport, ...prev]);
    resetCsvDialog();
  }, [csvRows, selectedIds, resetCsvDialog, activeEntity]);

  const categories = form.type === "income"
    ? [...INCOME_CATEGORIES, ...customIncomeCats]
    : [...EXPENSE_CATEGORIES, ...customExpenseCats];

  const addCustomCategory = useCallback(() => {
    const name = newCatInput.trim();
    if (!name) return;
    if (form.type === "expense") {
      setCustomExpenseCats((prev) => prev.includes(name) ? prev : [...prev, name]);
    } else {
      setCustomIncomeCats((prev) => prev.includes(name) ? prev : [...prev, name]);
    }
    setForm((f) => ({ ...f, category: name }));
    setAddingCategory(false);
    setNewCatInput("");
  }, [newCatInput, form.type]);

  // ── Sub-category helpers ──────────────────────────────────────────────────
  const getSubcategories = useCallback((type: "income" | "expense", category: string): string[] => {
    const builtIn = (type === "expense" ? EXPENSE_SUBCATEGORIES : INCOME_SUBCATEGORIES)[category] ?? [];
    const custom  = (type === "expense" ? customExpenseSubcats  : customIncomeSubcats)[category]  ?? [];
    return [...builtIn, ...custom];
  }, [customExpenseSubcats, customIncomeSubcats]);

  const addCustomSubcategory = useCallback(() => {
    const name = newSubcatInput.trim();
    if (!name || !form.category) return;
    const setter = form.type === "expense" ? setCustomExpenseSubcats : setCustomIncomeSubcats;
    setter((prev) => ({
      ...prev,
      [form.category]: prev[form.category]?.includes(name)
        ? prev[form.category]
        : [...(prev[form.category] ?? []), name],
    }));
    setForm((f) => ({ ...f, subcategory: name }));
    setAddingSubcategory(false);
    setNewSubcatInput("");
  }, [newSubcatInput, form.category, form.type]);

  const activeEntityMeta = ENTITIES.find((e) => e.id === activeEntity)!;

  return (
    <div className="space-y-6">
      {/* ── Entity Switcher ─────────────────────────────────────────────── */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
        {ENTITIES.map((e) => (
          <button
            key={e.id}
            onClick={() => setActiveEntity(e.id)}
            className={cn(
              "flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-all duration-200",
              activeEntity === e.id
                ? `${e.activeBg} text-white shadow-sm`
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            <span className="hidden md:inline">{e.label}</span>
            <span className="md:hidden">{e.short}</span>
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: "Total Income",
            value: `$${summary.income.toLocaleString()}`,
            icon: ArrowUp,
            color: "text-emerald-400",
            iconColor: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Total Expenses",
            value: `$${summary.expenses.toLocaleString()}`,
            icon: ArrowDown,
            color: "text-red-400",
            iconColor: "text-red-500",
            bg: "bg-red-500/10",
          },
          {
            label: "Net Savings",
            value: `$${summary.savings.toLocaleString()}`,
            icon: DollarSign,
            color: summary.savings >= 0 ? "text-blue-400" : "text-red-400",
            iconColor: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Savings Rate",
            value: `${summary.savingsRate.toFixed(1)}%`,
            icon: TrendingUp,
            color: summary.savingsRate >= 20 ? "text-emerald-400" : summary.savingsRate >= 10 ? "text-yellow-400" : "text-red-400",
            iconColor: "text-purple-500",
            bg: "bg-purple-500/10",
          },
        ].map((card) => (
          <Card key={card.label} className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-400">{card.label}</CardTitle>
              <div className={cn("p-1.5 rounded-lg", card.bg)}>
                <card.icon className={cn("h-3.5 w-3.5", card.iconColor)} />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className={cn("text-xl sm:text-2xl font-bold", card.color)}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Pie Chart */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expensesByCategory.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`$${val.toLocaleString()}`, ""]}
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend
                    formatter={(val) => (
                      <span style={{ color: "#9ca3af", fontSize: "11px" }}>{val}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
                No expenses yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income vs Expenses Bar */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyComparison} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, ""]}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {monthlyComparison.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Savings progress bar */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Budget used</span>
                <span>
                  {summary.income > 0
                    ? `${Math.min(((summary.expenses / summary.income) * 100), 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    summary.expenses / summary.income > 0.9
                      ? "bg-red-500"
                      : summary.expenses / summary.income > 0.7
                      ? "bg-yellow-500"
                      : "bg-emerald-500"
                  )}
                  style={{
                    width: `${summary.income > 0 ? Math.min((summary.expenses / summary.income) * 100, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Bars */}
      {expensesByCategory.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Category Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {expensesByCategory.map((cat, i) => (
                <div key={cat.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }}
                      />
                      <span className="text-gray-300">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">${cat.value.toLocaleString()}</span>
                      <span className="text-gray-500 text-xs w-10 text-right">
                        {summary.expenses > 0
                          ? `${((cat.value / summary.expenses) * 100).toFixed(0)}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${summary.expenses > 0 ? (cat.value / summary.expenses) * 100 : 0}%`,
                        backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
<CardTitle className="text-white text-base flex items-center gap-2">Transactions<span className={cn("text-xs font-normal px-2 py-0.5 rounded-full", activeEntityMeta.activeBg + "/20", activeEntityMeta.accentText)}>{activeEntityMeta.short}</span></CardTitle>
          <div className="flex gap-2 items-center">
            {transactions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-gray-500 hover:text-red-400 text-xs"
              >
                Clear All
              </Button>
            )}

            {/* Import CSV button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCsvOpen(true)}
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Import
            </Button>

            {/* Add Transaction button */}
            <Dialog open={open} onOpenChange={(o) => {
                setOpen(o);
                if (!o) {
                  setEditingId(null);
                  setAddingCategory(false);
                  setNewCatInput("");
                  setAddingSubcategory(false);
    setNewSubcatInput("");
    setForm({ type: "expense", category: "", subcategory: "", description: "", amount: "", date: today });
                }
              }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">{editingId ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className={cn(
                        "border-gray-700",
                        form.type === "income"
                          ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                      )}
                      onClick={() => setForm((f) => ({ ...f, type: "income", category: "", subcategory: "" }))}
                    >
                      <ArrowUp className="h-4 w-4 mr-1" /> Income
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "border-gray-700",
                        form.type === "expense"
                          ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                      )}
                      onClick={() => setForm((f) => ({ ...f, type: "expense", category: "", subcategory: "" }))}
                    >
                      <ArrowDown className="h-4 w-4 mr-1" /> Expense
                    </Button>
                  </div>

                  <div>
                    <Label className="text-gray-300 text-sm">Category</Label>
                    <Select
                      value={addingCategory ? "" : form.category}
                      onValueChange={(v) => {
                        if (v === "__add_new__") {
                          setAddingCategory(true);
                          setNewCatInput("");
                        } else {
                          setForm((f) => ({ ...f, category: v, subcategory: "" }));
                          setAddingCategory(false);
                          setAddingSubcategory(false);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                        <SelectValue placeholder={addingCategory ? "Adding new category…" : "Select category"} />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {categories.map((c) => (
                          <SelectItem key={c} value={c} className="text-white focus:bg-gray-700">
                            {c}
                          </SelectItem>
                        ))}
                        <Separator className="my-1 bg-gray-700" />
                        <SelectItem value="__add_new__" className="text-blue-400 focus:bg-gray-700 focus:text-blue-300">
                          + New category…
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Inline new-category input */}
                    {addingCategory && (
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newCatInput}
                          onChange={(e) => setNewCatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addCustomCategory();
                            if (e.key === "Escape") { setAddingCategory(false); setNewCatInput(""); }
                          }}
                          placeholder="Category name…"
                          autoFocus
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={addCustomCategory}
                          disabled={!newCatInput.trim()}
                          className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setAddingCategory(false); setNewCatInput(""); }}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* ── Sub-category (visible whenever a category is selected) ── */}
                  {form.category && (
                    <div>
                      <div className="flex items-center justify-between mt-0">
                        <Label className="text-gray-300 text-sm">
                          Sub-category <span className="text-gray-500 font-normal">(optional)</span>
                        </Label>
                        {/* Always-visible add button — avoids Radix Select onValueChange quirks */}
                        {!addingSubcategory && (
                          <button
                            type="button"
                            onClick={() => { setAddingSubcategory(true); setNewSubcatInput(""); }}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            + New
                          </button>
                        )}
                      </div>

                      {/* Pick from existing sub-categories */}
                      {!addingSubcategory && getSubcategories(form.type, form.category).length > 0 && (
                        <Select
                          value={form.subcategory || "__none__"}
                          onValueChange={(v) =>
                            setForm((f) => ({ ...f, subcategory: v === "__none__" ? "" : v }))
                          }
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                            <SelectValue placeholder="Select sub-category" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="__none__" className="text-gray-400 focus:bg-gray-700">— None —</SelectItem>
                            <Separator className="my-1 bg-gray-700" />
                            {getSubcategories(form.type, form.category).map((s) => (
                              <SelectItem key={s} value={s} className="text-white focus:bg-gray-700">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* No sub-categories yet — show hint */}
                      {!addingSubcategory && getSubcategories(form.type, form.category).length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">No sub-categories yet — click <span className="text-blue-400">+ New</span> to add one.</p>
                      )}

                      {/* Inline new sub-category input */}
                      {addingSubcategory && (
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={newSubcatInput}
                            onChange={(e) => setNewSubcatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addCustomSubcategory();
                              if (e.key === "Escape") { setAddingSubcategory(false); setNewSubcatInput(""); }
                            }}
                            placeholder="Sub-category name…"
                            autoFocus
                            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={addCustomSubcategory}
                            disabled={!newSubcatInput.trim()}
                            className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setAddingSubcategory(false); setNewSubcatInput(""); }}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label className="text-gray-300 text-sm">Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="What was this for?"
                      className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-300 text-sm">Amount ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00"
                        className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm">Date</Label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className="bg-gray-800 border-gray-700 text-white mt-1"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={addTransaction}
                    className={cn(
                      "w-full",
                      form.type === "income"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    )}
                    disabled={!form.category || !form.description || !form.amount}
                  >
{editingId ? "Save Changes" : `Add ${form.type === "income" ? "Income" : "Expense"}`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-72">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No transactions yet. Add one or import a statement to get started!
              </div>
            ) : (
              <div>
                {filteredTransactions.map((t, idx) => (
                  <div key={t.id}>
                    {idx > 0 && <Separator className="bg-gray-800" />}
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-1 h-10 rounded-full flex-shrink-0",
                            t.type === "income" ? "bg-emerald-500" : "bg-red-500"
                          )}
                        />
                        <div>
                          <div className="text-sm font-medium text-white">{t.description}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge
                              variant="secondary"
                              className="text-xs bg-gray-800 text-gray-400 border-0 py-0 px-1.5"
                            >
                              {t.category}
                            </Badge>
                            {t.subcategory && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-gray-700/60 text-gray-400 border-0 py-0 px-1.5"
                              >
                                › {t.subcategory}
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500">{t.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={cn(
                            "font-semibold text-sm",
                            t.type === "income" ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {t.type === "income" ? "+" : "−"}${t.amount.toLocaleString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(t)}
                          className="text-gray-600 hover:text-blue-400 hover:bg-transparent p-1 h-auto"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTransaction(t.id)}
                          className="text-gray-600 hover:text-red-400 hover:bg-transparent p-1 h-auto"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── CSV Import Dialog ─────────────────────────────────────────────── */}
      <Dialog open={csvOpen} onOpenChange={(open) => { if (!open) resetCsvDialog(); }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {csvStep === "upload" ? (
    "Import Bank Statement — " + activeEntityMeta.short
              ) : (
                <>
                  Review Transactions
                  <span className="text-blue-400 text-sm font-normal">— {csvBank}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {csvStep === "upload" ? (
            /* ── Step 1: Upload ── */
            <div className="space-y-4 pt-2">
              <div
                className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-colors group"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              >
                <Upload className="h-10 w-10 text-gray-500 group-hover:text-blue-400 mx-auto mb-3 transition-colors" />
                <p className="text-white font-medium mb-1">Drop your CSV file here</p>
                <p className="text-gray-400 text-sm">or click to browse</p>
                <div className="flex gap-2 justify-center mt-4 flex-wrap">
                  {["Chase", "Bank of America", "Citi", "American Express"].map((b) => (
                    <span key={b} className="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full">{b}</span>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>

              {csvError && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {csvError}
                </div>
              )}

              <div className="bg-gray-800/60 rounded-lg p-4 text-xs text-gray-400 space-y-1.5">
                <p className="font-medium text-gray-300 mb-2">How to export your CSV:</p>
                <p><span className="text-white">Chase:</span> Sign in → Account Activity → Download → CSV</p>
                <p><span className="text-white">Bank of America:</span> Online Banking → Download → Microsoft Excel format (.csv)</p>
                <p><span className="text-white">Citi:</span> Account Activity → Download → CSV</p>
                <p><span className="text-white">American Express:</span> Statements → Download → CSV</p>
              </div>
            </div>
          ) : (
            /* ── Step 2: Review ── */
            <div className="pt-2 space-y-3">
              {/* Controls row */}
              <div className="flex items-center justify-between">
                <div className="flex gap-3 text-xs">
                  <button
                    onClick={() => setSelectedIds(new Set(csvRows.map((r) => r.id)))}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-gray-700">·</span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Deselect all
                  </button>
                  <span className="text-gray-700">·</span>
                  <button
                    onClick={() => setSelectedIds(new Set(csvRows.filter((r) => !r.skip).map((r) => r.id)))}
                    className="text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Exclude payments
                  </button>
                </div>
                <span className="text-gray-500 text-xs">
                  {selectedIds.size} of {csvRows.length} selected
                </span>
              </div>

              {/* Bulk entity assign */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 flex-shrink-0">Assign all to:</span>
                {ENTITIES.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => assignAllEntity(e.id)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-colors",
                      e.id === "phc"      && "border-blue-700   text-blue-400   hover:bg-blue-600/20",
                      e.id === "pfi"      && "border-purple-700 text-purple-400 hover:bg-purple-600/20",
                      e.id === "personal" && "border-emerald-700 text-emerald-400 hover:bg-emerald-600/20"
                    )}
                  >
                    {e.short}
                  </button>
                ))}
              </div>

              {/* Transaction rows */}
              <ScrollArea className="h-72 border border-gray-800 rounded-lg">
                <div className="divide-y divide-gray-800">
                  {csvRows.map((row) => {
                    const selected = selectedIds.has(row.id);
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800/40 transition-colors",
                          !selected && "opacity-40"
                        )}
                        onClick={() => toggleRow(row.id)}
                      >
                        {/* Custom checkbox */}
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                            selected ? "bg-blue-600 border-blue-600" : "border-gray-600"
                          )}
                        >
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>

                        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-white text-sm truncate">{row.description}</span>
                            <span
                              className={cn(
                                "font-semibold text-sm flex-shrink-0",
                                row.type === "income" ? "text-emerald-400" : "text-red-400"
                              )}
                            >
                              {row.type === "income" ? "+" : "−"}$
                              {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 text-xs flex-shrink-0">{row.date}</span>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={row.category}
                                onValueChange={(v) => updateRowCategory(row.id, v)}
                              >
                                <SelectTrigger className="h-6 text-xs bg-gray-800 border-gray-700 text-gray-300 w-40 px-2">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700">
                                  {(row.type === "income" ? [...INCOME_CATEGORIES, ...customIncomeCats] : [...EXPENSE_CATEGORIES, ...customExpenseCats]).map((c) => (
                                    <SelectItem key={c} value={c} className="text-white text-xs focus:bg-gray-700">
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Per-row entity pills */}
                            <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              {ENTITIES.map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => updateRowEntity(row.id, e.id)}
                                  className={cn(
                                    "text-xs px-2 py-0.5 rounded-full border transition-all",
                                    row.entity === e.id
                                      ? cn(e.activeBg, "text-white border-transparent")
                                      : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                                  )}
                                >
                                  {e.short}
                                </button>
                              ))}
                            </div>
                            {row.skip && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded flex-shrink-0">
                                payment
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Footer buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCsvStep("upload")}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  ← Back
                </Button>
                <Button
                  onClick={importSelected}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={selectedIds.size === 0}
                >
                  Import {selectedIds.size} Transaction{selectedIds.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
