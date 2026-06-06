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
import { Checkbox } from "@/components/ui/checkbox";
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
  ArrowUpDown,
  TrendingUp,
  Upload,
  AlertCircle,
  Check,
  ListChecks,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Entities ─────────────────────────────────────────────────────────────────

type EntityType = "phc" | "pfi" | "personal";
type ActiveView  = EntityType | "all";

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

// ─── Payment Accounts ────────────────────────────────────────────────────────

interface PaymentAccount {
  id: string;
  abbr: string;   // e.g. "BofA", "Amex", "Chase"
  last4: string;  // last 4 digits
  type: "bank" | "credit";
}

const BANK_OPTIONS: { abbr: string; full: string; type: "bank" | "credit" }[] = [
  { abbr: "BofA",    full: "Bank of America",  type: "bank"   },
  { abbr: "Chase",   full: "Chase",            type: "bank"   },
  { abbr: "WF",      full: "Wells Fargo",      type: "bank"   },
  { abbr: "Citi",    full: "Citi",             type: "credit" },
  { abbr: "Amex",    full: "American Express", type: "credit" },
  { abbr: "CapOne",  full: "Capital One",      type: "credit" },
  { abbr: "Disc",    full: "Discover",         type: "credit" },
  { abbr: "USBank",  full: "US Bank",          type: "bank"   },
  { abbr: "TD",      full: "TD Bank",          type: "bank"   },
  { abbr: "PNC",     full: "PNC",              type: "bank"   },
  { abbr: "NavyFed", full: "Navy Federal",     type: "bank"   },
  { abbr: "USAA",    full: "USAA",             type: "bank"   },
  { abbr: "PayPal",  full: "PayPal",           type: "bank"   },
  { abbr: "Venmo",   full: "Venmo",            type: "bank"   },
];

function acctLabel(a: PaymentAccount) {
  return `${a.abbr} ••••${a.last4}`;
}

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
  accountId?: string;
}

interface ImportRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  entity?: EntityType;  // stamped in handleFile after parse
  accountId?: string;
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


// ─── PDF Parser ────────────────────────────────────────────────────────────────
// Uses pdfjs-dist (loaded lazily) to extract text then applies regex heuristics
// to match common bank statement transaction line formats.

async function parsePDF(
  buffer: ArrayBuffer
): Promise<{ bank: string; rows: ImportRow[]; error?: string }> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const lines: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // Group text items by Y position using a ±2px tolerance band.
      // This is critical: Chase PDFs have slight Y-offset variations between
      // columns on the same visual row, so exact rounding splits rows incorrectly.
      const yGroups: { y: number; items: { str: string; x: number }[] }[] = [];
      for (const item of content.items as { str: string; transform: number[] }[]) {
        const str = item.str.trim();
        if (!str) continue;
        const y = item.transform[5];
        const x = item.transform[4];
        let found = false;
        for (const g of yGroups) {
          if (Math.abs(g.y - y) <= 5) {
            g.items.push({ str, x });
            found = true;
            break;
          }
        }
        if (!found) yGroups.push({ y, items: [{ str, x }] });
      }
      // Sort groups top-to-bottom (higher Y = higher on page in PDF coords)
      yGroups.sort((a, b) => b.y - a.y);
      for (const { items } of yGroups) {
        // Sort items left-to-right within the row
        items.sort((a, b) => a.x - b.x);
        const line = items.map((i) => i.str).join(" ").replace(/\s+/g, " ").replace(/- (\d)/g, "-$1").trim();
        if (line) lines.push(line);
      }
    }

    // ── Bank detection ──────────────────────────────────────────────────────
    const fullText = lines.join(" ").toLowerCase();
    let detectedBank = "PDF Import";
    if (fullText.includes("bank of america"))   detectedBank = "Bank of America (PDF)";
    else if (fullText.includes("jpmorgan") || fullText.includes("chase")) detectedBank = "Chase (PDF)";
    else if (fullText.includes("american express") || fullText.includes("amex")) detectedBank = "American Express (PDF)";
    else if (fullText.includes("citibank") || fullText.includes("citi ")) detectedBank = "Citi (PDF)";
    else if (fullText.includes("wells fargo"))  detectedBank = "Wells Fargo (PDF)";
    else if (fullText.includes("capital one"))  detectedBank = "Capital One (PDF)";

    // ── Year inference ──────────────────────────────────────────────────────
    // Parse statement period header so MM/DD dates get the correct year even
    // when a statement spans a year boundary (e.g. Dec 2025 – Jan 2026).
    const monthYearMap: Record<string, number> = {};
    const MONTH_NAMES: Record<string, string> = {
      january:"01",february:"02",march:"03",april:"04",
      may:"05",june:"06",july:"07",august:"08",
      september:"09",october:"10",november:"11",december:"12",
    };
    // "December 11, 2025 through January 13, 2026"
    const throughRe = /([a-z]+)\s+\d+,?\s+(\d{4})\s+(?:through|to|-)\s+([a-z]+)\s+\d+,?\s+(\d{4})/i;
    const thrMatch = fullText.match(throughRe);
    if (thrMatch) {
      const m1 = MONTH_NAMES[thrMatch[1].toLowerCase()];
      const m2 = MONTH_NAMES[thrMatch[3].toLowerCase()];
      if (m1) monthYearMap[m1] = parseInt(thrMatch[2]);
      if (m2) monthYearMap[m2] = parseInt(thrMatch[4]);
    }
    // "12/11/2025 - 01/13/2026"
    const drRe = /(\d{1,2})\/\d{1,2}\/(\d{4})\s*(?:through|to|-)\s*(\d{1,2})\/\d{1,2}\/(\d{4})/i;
    const drMatch = fullText.match(drRe);
    if (drMatch) {
      monthYearMap[drMatch[1].padStart(2,"0")] = parseInt(drMatch[2]);
      monthYearMap[drMatch[3].padStart(2,"0")] = parseInt(drMatch[4]);
    }

    const inferYear = (mo: string): number => {
      if (monthYearMap[mo] !== undefined) return monthYearMap[mo];
      const entries = Object.entries(monthYearMap);
      if (entries.length >= 2) {
        const years = entries.map(([, v]) => v);
        const minYr = Math.min(...years);
        const maxYr = Math.max(...years);
        if (minYr !== maxYr) {
          // Oct–Dec belong to the earlier year in year-spanning statements
          return parseInt(mo) >= 10 ? minYr : maxYr;
        }
        return minYr;
      }
      return new Date().getFullYear();
    };

    // ── Transaction parsing ─────────────────────────────────────────────────
    const rows: ImportRow[] = [];
    // Transaction line starts with MM/DD (optionally /YY or /YYYY)
    const datePrefixRe = /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s/;
    // Match last 1 or 2 dollar-style amounts at end of line
    // Group 1+2 = two amounts (txn amount + balance); Group 3 = single amount
    const endAmtsRe = /\s(-?\$?[\d,]+\.\d{2})\s+(\$?[\d,]+\.\d{2})\s*$|\s(-?\$?[\d,]+\.\d{2})\s*$/;

    const SKIP_EXACT = new Set([
      "opening balance","closing balance","beginning balance",
      "ending balance","balance brought forward",
    ]);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!datePrefixRe.test(line)) continue;

      // Extract date parts
      const dateMatch = line.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (!dateMatch) continue;

      const mo  = dateMatch[1].padStart(2, "0");
      const day = dateMatch[2].padStart(2, "0");
      let yr: number;
      if (dateMatch[3]) {
        yr = parseInt(dateMatch[3]);
        if (yr < 100) yr += 2000;
      } else {
        yr = inferYear(mo);
      }
      const date = `${yr}-${mo}-${day}`;

      // If this line has no amounts yet, try merging with the next line
      // (Chase sometimes wraps long descriptions onto a second line)
      let fullLine = line;
      if (
        !endAmtsRe.test(line) &&
        i + 1 < lines.length &&
        !datePrefixRe.test(lines[i + 1]) &&
        lines[i + 1].trim().length > 0
      ) {
        fullLine = line + " " + lines[i + 1];
      }

      // Extract the trailing amount(s)
      const amtMatch = fullLine.match(endAmtsRe);
      if (!amtMatch) continue;

      // When two amounts are present: first = txn amount, second = running balance
      const rawAmt = amtMatch[1] !== undefined ? amtMatch[1] : amtMatch[3];

      // Description = text between date and the trailing amounts
      const afterDate = fullLine.replace(/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+/, "");
      const rawDesc = afterDate
        .replace(/\s+-?\$?[\d,]+\.\d{2}\s+\$?[\d,]+\.\d{2}\s*$/, "")
        .replace(/\s+-?\$?[\d,]+\.\d{2}\s*$/, "")
        .trim();

      if (!rawDesc) continue;
      if (SKIP_EXACT.has(rawDesc.toLowerCase())) continue;
      if (/^page \d+/i.test(rawDesc)) continue;

      const aNeg = rawAmt.startsWith("-");
      const aNum = parseFloat(rawAmt.replace(/[^0-9.]/g, ""));
      if (isNaN(aNum) || aNum === 0) continue;

      // Standard bank convention: negative = expense (debit), positive = income (credit)
      const type: "income" | "expense" = aNeg ? "expense" : "income";

      rows.push({
        id: crypto.randomUUID(),
        date,
        description: rawDesc,
        amount: aNum,
        type,
        category: "Other",
        skip: false,
      });
    }

    if (rows.length === 0) {
      return {
        bank: detectedBank,
        rows: [],
        error:
          "No transactions found in this PDF. The format may not be supported — try the CSV export from your bank instead.",
      };
    }

    return { bank: detectedBank, rows };
  } catch (err) {
    console.error("PDF parse error", err);
    return {
      bank: "",
      rows: [],
      error:
        "Failed to read the PDF. Make sure it is a standard bank statement PDF (not a scanned image).",
    };
  }
}

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
    entity: "personal" as EntityType,
    accountId: "",
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
  const [activeView,   setActiveView]   = useState<ActiveView>("personal");
  // activeEntity is the "real" entity for writes — falls back to "personal" when view is "all"
  const activeEntity: EntityType = activeView === "all" ? "personal" : activeView;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  // ── Payment accounts ──────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [addingAccount, setAddingAccount]   = useState(false);
  const [newAcctAbbr,   setNewAcctAbbr]     = useState("");
  const [newAcctLast4,  setNewAcctLast4]    = useState("");
  const [newAcctType,   setNewAcctType]     = useState<"bank" | "credit">("bank");

  // ── Sort & search state ───────────────────────────────────────────────
  const [sortField, setSortField] = useState<"date" | "description" | "amount">("date");
  const [sortDir,   setSortDir]   = useState<"desc" | "asc">("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Batch-edit state ───────────────────────────────────────────────────
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState<{
    type: "income" | "expense" | "";
    category: string;
    subcategory: string;
    entity: EntityType | "";
  }>({ type: "", category: "", subcategory: "", entity: "" });

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
    const savedAccounts = localStorage.getItem("ft-accounts");
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    localStorage.setItem("ft-transactions", JSON.stringify(transactions));
  }, [transactions, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    localStorage.setItem("ft-custom-expense-cats", JSON.stringify(customExpenseCats));
  }, [customExpenseCats, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    localStorage.setItem("ft-custom-income-cats", JSON.stringify(customIncomeCats));
  }, [customIncomeCats, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    localStorage.setItem("ft-custom-expense-subcats", JSON.stringify(customExpenseSubcats));
  }, [customExpenseSubcats, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    localStorage.setItem("ft-custom-income-subcats", JSON.stringify(customIncomeSubcats));
  }, [customIncomeSubcats, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    localStorage.setItem("ft-accounts", JSON.stringify(accounts));
  }, [accounts, storageLoaded]);

  // ── Filter, search, and sort transactions ──────────────────────────────────
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = activeView === "all"
      ? transactions
      : transactions.filter((t) => (t.entity ?? "personal") === activeView);
    if (q) {
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.subcategory ?? "").toLowerCase().includes(q) ||
        t.date.includes(q) ||
        t.amount.toString().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date")             cmp = a.date.localeCompare(b.date);
      else if (sortField === "description") cmp = a.description.toLowerCase().localeCompare(b.description.toLowerCase());
      else if (sortField === "amount")      cmp = a.amount - b.amount;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [transactions, activeView, activeEntity, searchQuery, sortField, sortDir]);

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
                entity: form.entity,
                accountId: form.accountId || undefined,
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
        accountId: form.accountId || undefined,
      };
      setTransactions((prev) => [t, ...prev]);
    }
    setAddingSubcategory(false);
    setNewSubcatInput("");
    setForm({ type: "expense", category: "", subcategory: "", description: "", amount: "", date: today, entity: activeEntity, accountId: "" });
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
      entity: (t.entity ?? "personal") as EntityType,
      accountId: t.accountId ?? "",
    });
    setEditingId(t.id);
    setOpen(true);
  }, []);

  const clearAll = useCallback(() => {
    if (activeView === "all") {
      setTransactions([]);
    } else {
      setTransactions((prev) => prev.filter((t) => (t.entity ?? "personal") !== activeView));
    }
  }, [activeView]);

  // ── Batch-edit helpers ───────────────────────────────────────────────────

  const toggleSelectTx = useCallback((id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedTxIds((prev) =>
      prev.size === filteredTransactions.length
        ? new Set()
        : new Set(filteredTransactions.map((t) => t.id))
    );
  }, [filteredTransactions]);

  const applyBatchEdit = useCallback(() => {
    if (selectedTxIds.size === 0) return;
    setTransactions((prev) =>
      prev.map((t) => {
        if (!selectedTxIds.has(t.id)) return t;
        return {
          ...t,
          ...(batchForm.type      ? { type: batchForm.type }                                  : {}),
          ...(batchForm.category  ? { category: batchForm.category, subcategory: undefined }  : {}),
          ...(batchForm.subcategory && batchForm.category ? { subcategory: batchForm.subcategory } : {}),
          ...(batchForm.entity    ? { entity: batchForm.entity }                               : {}),
        };
      })
    );
    setSelectedTxIds(new Set());
    setBatchOpen(false);
    setBatchForm({ type: "", category: "", subcategory: "", entity: "" });
  }, [selectedTxIds, batchForm]);

  const addAccount = useCallback(() => {
    const abbr  = newAcctAbbr.trim();
    const last4 = newAcctLast4.trim();
    if (!abbr || last4.length !== 4) return;
    const existing = accounts.find((a) => a.abbr === abbr && a.last4 === last4);
    if (!existing) {
      const newAcct: PaymentAccount = { id: crypto.randomUUID(), abbr, last4, type: newAcctType };
      setAccounts((prev) => [...prev, newAcct]);
    }
    setAddingAccount(false);
    setNewAcctAbbr("");
    setNewAcctLast4("");
    setNewAcctType("bank");
  }, [newAcctAbbr, newAcctLast4, newAcctType, accounts]);

  const updateRowAccount = useCallback((id: string, accountId: string) => {
    setCsvRows((prev) => prev.map((r) => (r.id === id ? { ...r, accountId } : r)));
  }, []);

  const assignAllAccount = useCallback((accountId: string) => {
    setCsvRows((prev) => prev.map((r) => ({ ...r, accountId })));
  }, []);

  const toggleSort = useCallback((field: "date" | "description" | "amount") => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "date" ? "desc" : "asc"); }
  }, [sortField]);

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
    const name = file.name.toLowerCase();
    const isCSV = name.endsWith(".csv");
    const isPDF = name.endsWith(".pdf");
    if (!isCSV && !isPDF) {
      setCsvError("Please upload a .csv or .pdf file.");
      return;
    }

    if (isCSV) {
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
          setCsvError("Failed to parse the CSV. Please try a different export.");
        }
      };
      reader.readAsText(file);
    } else {
      // PDF
      setCsvError(null);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const { bank, rows, error } = await parsePDF(buffer);
          if (error) { setCsvError(error); return; }
          setCsvBank(bank);
          const stamped = rows.map((r) => ({ ...r, entity: activeEntity }));
          setCsvRows(stamped);
          setSelectedIds(new Set(stamped.filter((r) => !r.skip).map((r) => r.id)));
          setCsvStep("review");
        } catch {
          setCsvError("Failed to read the PDF. Please try a different file.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, [activeEntity]);

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
        accountId: r.accountId || undefined,
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
            onClick={() => { setActiveView(e.id); setSelectedTxIds(new Set()); setBatchOpen(false); }}
            className={cn(
              "flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-all duration-200",
              activeView === e.id
                ? `${e.activeBg} text-white shadow-sm`
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            <span className="hidden md:inline">{e.label}</span>
            <span className="md:hidden">{e.short}</span>
          </button>
        ))}
        <button
          onClick={() => { setActiveView("all"); setSelectedTxIds(new Set()); setBatchOpen(false); }}
          className={cn(
            "flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-all duration-200",
            activeView === "all"
              ? "bg-gray-600 text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          )}
        >
          <span className="hidden md:inline">All Budgets</span>
          <span className="md:hidden">All</span>
        </button>
      </div>

      {/* ── All-budgets combined summary ──────────────────────────────────── */}
      {activeView === "all" && (() => {
        const allTotals = ENTITIES.map((e) => {
          const etxs = transactions.filter((t) => (t.entity ?? "personal") === e.id);
          const inc  = etxs.filter((t) => t.type === "income" ).reduce((s, t) => s + t.amount, 0);
          const exp  = etxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
          return { ...e, income: inc, expenses: exp, net: inc - exp };
        });
        const grandIncome   = allTotals.reduce((s, e) => s + e.income,   0);
        const grandExpenses = allTotals.reduce((s, e) => s + e.expenses, 0);
        const grandNet      = grandIncome - grandExpenses;
        return (
          <div className="space-y-3">
            {/* Grand total cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Income</p>
                <p className="text-xl font-bold text-emerald-400">${grandIncome.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                <p className="text-xs text-gray-600 mt-0.5">all entities</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
                <p className="text-xl font-bold text-red-400">${grandExpenses.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                <p className="text-xs text-gray-600 mt-0.5">all entities</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Net Savings</p>
                <p className={cn("text-xl font-bold", grandNet >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {grandNet >= 0 ? "+" : "−"}${Math.abs(grandNet).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">income − expenses</p>
              </div>
            </div>

            {/* Per-entity breakdown table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-950 px-4 py-2.5"
                   style={{gridTemplateColumns:"1fr 130px 130px 130px"}}>
                <div>Entity</div>
                <div className="text-right">Income</div>
                <div className="text-right">Expenses</div>
                <div className="text-right">Net</div>
              </div>
              {allTotals.map((e, i) => (
                <div key={e.id}>
                  {i > 0 && <div className="border-t border-gray-800" />}
                  <div className="grid items-center px-4 py-3"
                       style={{gridTemplateColumns:"1fr 130px 130px 130px"}}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", e.activeBg)} />
                      <span className="text-sm text-white font-medium">{e.label}</span>
                    </div>
                    <div className="text-right text-sm text-emerald-400 tabular-nums">
                      ${e.income.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
                    </div>
                    <div className="text-right text-sm text-red-400 tabular-nums">
                      ${e.expenses.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
                    </div>
                    <div className={cn("text-right text-sm tabular-nums font-semibold", e.net >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {e.net >= 0 ? "+" : "−"}${Math.abs(e.net).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
                    </div>
                  </div>
                </div>
              ))}
              {/* Totals row */}
              <div className="border-t-2 border-gray-700 grid items-center px-4 py-3 bg-gray-800/40"
                   style={{gridTemplateColumns:"1fr 130px 130px 130px"}}>
                <div className="text-sm font-bold text-white">Total</div>
                <div className="text-right text-sm font-bold text-emerald-400 tabular-nums">
                  ${grandIncome.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
                <div className="text-right text-sm font-bold text-red-400 tabular-nums">
                  ${grandExpenses.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
                <div className={cn("text-right text-sm font-bold tabular-nums", grandNet >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {grandNet >= 0 ? "+" : "−"}${Math.abs(grandNet).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
        <CardHeader className="flex flex-col gap-3 pb-3">
          <div className="flex flex-row items-center justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              Transactions
              {activeView !== "all" && (
                <span className={cn("text-xs font-normal px-2 py-0.5 rounded-full", activeEntityMeta.activeBg + "/20", activeEntityMeta.accentText)}>
                  {activeEntityMeta.short}
                </span>
              )}
              {activeView === "all" && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
                  All Budgets
                </span>
              )}
            </CardTitle>
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
    setAddingAccount(false);
    setNewAcctAbbr("");
    setNewAcctLast4("");
    setForm({ type: "expense", category: "", subcategory: "", description: "", amount: "", date: today, entity: activeEntity, accountId: "" });
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

                  {editingId && (
                    <div>
                      <Label className="text-gray-300 text-sm">Entity</Label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {ENTITIES.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, entity: e.id }))}
                            className={cn(
                              "rounded-md px-2 py-1.5 text-xs font-medium border transition-colors",
                              form.entity === e.id
                                ? `${e.activeBg} border-transparent text-white`
                                : "border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 bg-transparent"
                            )}
                          >
                            {e.short}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {/* ── Account / Card ─────────────────────────────── */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-300 text-sm">Account / Card</Label>
                      {!addingAccount && (
                        <button type="button"
                          onClick={() => setAddingAccount(true)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                          + Add
                        </button>
                      )}
                    </div>
                    {!addingAccount && (
                      <Select
                        value={form.accountId || "__none__"}
                        onValueChange={(v) => setForm((f) => ({ ...f, accountId: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                          <SelectValue placeholder="Select account (optional)" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="__none__" className="text-gray-400 focus:bg-gray-700">— None —</SelectItem>
                          {accounts.length > 0 && <Separator className="my-1 bg-gray-700" />}
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-white focus:bg-gray-700">
                              {acctLabel(a)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {addingAccount && (
                      <div className="mt-1 space-y-2 p-3 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-gray-400 text-xs">Bank / Card</Label>
                            <Select value={newAcctAbbr} onValueChange={setNewAcctAbbr}>
                              <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1 h-8 text-xs">
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-900 border-gray-700">
                                {BANK_OPTIONS.map((b) => (
                                  <SelectItem key={b.abbr} value={b.abbr} className="text-white focus:bg-gray-700 text-xs">
                                    {b.abbr} <span className="text-gray-500 ml-1">({b.full})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-gray-400 text-xs">Last 4 digits</Label>
                            <Input
                              value={newAcctLast4}
                              onChange={(e) => setNewAcctLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                              placeholder="1234"
                              maxLength={4}
                              className="bg-gray-900 border-gray-600 text-white mt-1 h-8 text-xs placeholder:text-gray-600"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <button type="button"
                            onClick={() => setNewAcctType("bank")}
                            className={cn("text-xs py-1 rounded border transition-colors",
                              newAcctType === "bank" ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:text-white")}>
                            🏦 Bank
                          </button>
                          <button type="button"
                            onClick={() => setNewAcctType("credit")}
                            className={cn("text-xs py-1 rounded border transition-colors",
                              newAcctType === "credit" ? "bg-blue-600 border-blue-600 text-white" : "border-gray-600 text-gray-400 hover:text-white")}>
                            💳 Credit
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={addAccount}
                            disabled={!newAcctAbbr || newAcctLast4.length !== 4}
                            className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40">
                            <Check className="h-3.5 w-3.5 mr-1" /> Save Account
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { setAddingAccount(false); setNewAcctAbbr(""); setNewAcctLast4(""); }}
                            className="h-7 px-2 text-xs text-gray-400 hover:text-white">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

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
          </div>

          {/* ── Search + Sort bar ────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, category, date or amount…"
                className="w-full bg-gray-800 border border-gray-700 rounded-md pl-8 pr-8 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* ── Batch-edit toolbar ─────────────────────────────────────── */}
          {filteredTransactions.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/60">
              <Checkbox
                id="select-all"
                checked={selectedTxIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                onCheckedChange={toggleSelectAll}
                className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label htmlFor="select-all" className="text-xs text-gray-400 cursor-pointer select-none">
                {selectedTxIds.size === 0
                  ? "Select all"
                  : `${selectedTxIds.size} selected`}
              </label>
              {selectedTxIds.size > 0 && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setBatchOpen((o) => !o)}
                    className="ml-2 h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <ListChecks className="h-3.5 w-3.5 mr-1" />
                    Edit {selectedTxIds.size}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setSelectedTxIds(new Set()); setBatchOpen(false); }}
                    className="h-7 px-2 text-xs text-gray-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── Batch-edit panel ──────────────────────────────────────── */}
          {batchOpen && selectedTxIds.size > 0 && (
            <div className="border-b border-blue-800 bg-blue-950/30 px-4 py-3 space-y-3">
              <p className="text-xs text-blue-300 font-medium">
                Apply to {selectedTxIds.size} transaction{selectedTxIds.size > 1 ? "s" : ""} — leave a field blank to keep its current value
              </p>
              <div className="grid grid-cols-2 gap-2">
                {/* Type */}
                <div>
                  <Label className="text-gray-400 text-xs">Type</Label>
                  <Select
                    value={batchForm.type || "__none__"}
                    onValueChange={(v) =>
                      setBatchForm((f) => ({ ...f, type: v === "__none__" ? "" : v as "income" | "expense", category: "", subcategory: "" }))
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1 h-8 text-xs">
                      <SelectValue placeholder="Keep current" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="__none__" className="text-gray-400 focus:bg-gray-700 text-xs">— Keep current —</SelectItem>
                      <SelectItem value="income"  className="text-emerald-400 focus:bg-gray-700 text-xs">Income</SelectItem>
                      <SelectItem value="expense" className="text-red-400   focus:bg-gray-700 text-xs">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Entity */}
                <div>
                  <Label className="text-gray-400 text-xs">Entity</Label>
                  <Select
                    value={batchForm.entity || "__none__"}
                    onValueChange={(v) =>
                      setBatchForm((f) => ({ ...f, entity: v === "__none__" ? "" : v as EntityType }))
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1 h-8 text-xs">
                      <SelectValue placeholder="Keep current" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="__none__"  className="text-gray-400   focus:bg-gray-700 text-xs">— Keep current —</SelectItem>
                      <SelectItem value="phc"       className="text-blue-400   focus:bg-gray-700 text-xs">Performance Hearing Center</SelectItem>
                      <SelectItem value="pfi"       className="text-purple-400 focus:bg-gray-700 text-xs">Philip Fernandes Insurance</SelectItem>
                      <SelectItem value="personal"  className="text-emerald-400 focus:bg-gray-700 text-xs">Personal Household</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Category */}
                <div>
                  <Label className="text-gray-400 text-xs">Category</Label>
                  <Select
                    value={batchForm.category || "__none__"}
                    onValueChange={(v) =>
                      setBatchForm((f) => ({ ...f, category: v === "__none__" ? "" : v, subcategory: "" }))
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1 h-8 text-xs">
                      <SelectValue placeholder="Keep current" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="__none__" className="text-gray-400 focus:bg-gray-700 text-xs">— Keep current —</SelectItem>
                      {batchForm.type !== "income" && (
                        <>
                          <SelectItem value="__hdr_exp__" disabled className="text-gray-500 text-xs font-semibold">── Expenses ──</SelectItem>
                          {[...EXPENSE_CATEGORIES, ...customExpenseCats].map((c) => (
                            <SelectItem key={c} value={c} className="text-white focus:bg-gray-700 text-xs">{c}</SelectItem>
                          ))}
                        </>
                      )}
                      {batchForm.type !== "expense" && (
                        <>
                          <SelectItem value="__hdr_inc__" disabled className="text-gray-500 text-xs font-semibold">── Income ──</SelectItem>
                          {[...INCOME_CATEGORIES, ...customIncomeCats].map((c) => (
                            <SelectItem key={c} value={c} className="text-white focus:bg-gray-700 text-xs">{c}</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {/* Sub-category */}
                <div>
                  <Label className="text-gray-400 text-xs">Sub-category</Label>
                  <Select
                    value={batchForm.subcategory || "__none__"}
                    onValueChange={(v) =>
                      setBatchForm((f) => ({ ...f, subcategory: v === "__none__" ? "" : v }))
                    }
                    disabled={!batchForm.category}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1 h-8 text-xs disabled:opacity-40">
                      <SelectValue placeholder={batchForm.category ? "Keep current" : "Pick category first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="__none__" className="text-gray-400 focus:bg-gray-700 text-xs">— Keep current —</SelectItem>
                      {batchForm.category && (() => {
                        const subs = [
                          ...((batchForm.type === "income" ? INCOME_SUBCATEGORIES : EXPENSE_SUBCATEGORIES)[batchForm.category] ?? []),
                          ...((batchForm.type === "income" ? customIncomeSubcats : customExpenseSubcats)[batchForm.category] ?? []),
                        ];
                        return subs.map((s) => (
                          <SelectItem key={s} value={s} className="text-white focus:bg-gray-700 text-xs">{s}</SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={applyBatchEdit}
                  disabled={!batchForm.type && !batchForm.category && !batchForm.entity}
                  className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setBatchOpen(false); setBatchForm({ type: "", category: "", subcategory: "", entity: "" }); }}
                  className="h-7 px-3 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* ── Table column headers (sortable) ───────────────────────── */}
          <div className="grid items-center border-b border-gray-800 bg-gray-950 px-3"
               style={{gridTemplateColumns: "32px 100px 1fr 120px 68px"}}>
            <div />
            {/* Date header */}
            <button type="button" onClick={() => toggleSort("date")}
              className={cn("flex items-center gap-1 py-2.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                sortField === "date" ? "text-blue-400" : "text-gray-500 hover:text-gray-300")}>
              Date
              {sortField === "date"
                ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                : <ArrowUpDown className="h-3 w-3 opacity-40" />}
            </button>
            {/* Name header */}
            <button type="button" onClick={() => toggleSort("description")}
              className={cn("flex items-center gap-1 py-2.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                sortField === "description" ? "text-blue-400" : "text-gray-500 hover:text-gray-300")}>
              Name / Category
              {sortField === "description"
                ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                : <ArrowUpDown className="h-3 w-3 opacity-40" />}
            </button>
            {/* Amount header */}
            <button type="button" onClick={() => toggleSort("amount")}
              className={cn("flex items-center justify-end gap-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                sortField === "amount" ? "text-blue-400" : "text-gray-500 hover:text-gray-300")}>
              Amount
              {sortField === "amount"
                ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                : <ArrowUpDown className="h-3 w-3 opacity-40" />}
            </button>
            <div />
          </div>

          <ScrollArea className="h-72">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                {searchQuery
                  ? `No transactions match "${searchQuery}"`
                  : "No transactions yet. Add one or import a statement to get started!"}
              </div>
            ) : (
              <div>
                {filteredTransactions.map((t, idx) => (
                  <div key={t.id}>
                    {idx > 0 && <Separator className="bg-gray-800" />}
                    <div className={cn(
                      "grid items-center px-3 py-2.5 transition-colors",
                      selectedTxIds.has(t.id) ? "bg-blue-950/40" : "hover:bg-gray-800/40"
                    )}
                    style={{gridTemplateColumns: "32px 100px 1fr 120px 68px"}}>
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectedTxIds.has(t.id)}
                        onCheckedChange={() => toggleSelectTx(t.id)}
                        className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      {/* Date */}
                      <div className="tabular-nums text-xs text-gray-400 pr-2 leading-tight">
                        {t.date}
                      </div>
                      {/* Name + category */}
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={cn("w-1 h-3.5 rounded-full flex-shrink-0",
                            t.type === "income" ? "bg-emerald-500" : "bg-red-500")} />
                          <span className="text-sm font-medium text-white truncate">{t.description}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap pl-2.5">
                          <Badge variant="secondary" className="text-xs bg-gray-800 text-gray-400 border-0 py-0 px-1.5">
                            {t.category}
                          </Badge>
                          {t.subcategory && (
                            <Badge variant="secondary" className="text-xs bg-gray-700/60 text-gray-400 border-0 py-0 px-1.5">
                              › {t.subcategory}
                            </Badge>
                          )}
                          {t.accountId && (() => {
                            const acct = accounts.find((a) => a.id === t.accountId);
                            return acct ? (
                              <Badge variant="secondary" className="text-xs bg-transparent text-blue-400 border border-gray-700 py-0 px-1.5">
                                {acctLabel(acct)}
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      {/* Amount */}
                      <div className={cn("tabular-nums font-semibold text-sm text-right pr-2",
                        t.type === "income" ? "text-emerald-400" : "text-red-400")}>
                        {t.type === "income" ? "+" : "−"}${t.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(t)}
                          className="text-gray-600 hover:text-blue-400 hover:bg-transparent p-1 h-auto">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteTransaction(t.id)}
                          className="text-gray-600 hover:text-red-400 hover:bg-transparent p-1 h-auto">
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
    `Import Statement (CSV or PDF) — ${activeEntityMeta.short}`
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
                <p className="text-white font-medium mb-1">Drop your CSV or PDF statement here</p>
                <p className="text-gray-400 text-sm">or click to browse</p>
                <div className="flex gap-2 justify-center mt-3 flex-wrap">
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-gray-700">.csv</span>
                  <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-gray-700">.pdf</span>
                </div>
                <div className="flex gap-2 justify-center mt-2 flex-wrap">
                  {["Chase", "BofA", "Citi", "Amex", "Wells Fargo", "Capital One"].map((b) => (
                    <span key={b} className="bg-gray-800/60 text-gray-500 text-xs px-2 py-0.5 rounded-full">{b}</span>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
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

              {/* Bulk account assign */}
              {accounts.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 flex-shrink-0">Account:</span>
                  {accounts.map((a) => (
                    <button key={a.id} onClick={() => assignAllAccount(a.id)}
                      className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-blue-400 hover:border-blue-600 hover:bg-blue-600/10 transition-colors">
                      {acctLabel(a)}
                    </button>
                  ))}
                </div>
              )}

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
                            {/* Per-row account picker */}
                            {accounts.length > 0 && (
                              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={row.accountId || "__none__"}
                                  onValueChange={(v) => updateRowAccount(row.id, v === "__none__" ? "" : v)}
                                >
                                  <SelectTrigger className="h-6 text-xs bg-gray-800 border-gray-700 text-gray-300 w-32 px-2">
                                    <SelectValue placeholder="Acct…" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700">
                                    <SelectItem value="__none__" className="text-gray-400 text-xs focus:bg-gray-700">— None —</SelectItem>
                                    {accounts.map((a) => (
                                      <SelectItem key={a.id} value={a.id} className="text-white text-xs focus:bg-gray-700">
                                        {acctLabel(a)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
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
