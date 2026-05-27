"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  DollarSign,
  Activity,
  ArrowUp,
  ArrowDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  date: string;
}

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
  { id: "1", type: "income", category: "Salary", description: "Monthly salary", amount: 5000, date: today },
  { id: "2", type: "expense", category: "Housing", description: "Rent", amount: 1500, date: today },
  { id: "3", type: "expense", category: "Food & Dining", description: "Groceries", amount: 380, date: today },
  { id: "4", type: "expense", category: "Transportation", description: "Car payment + gas", amount: 420, date: today },
  { id: "5", type: "expense", category: "Entertainment", description: "Streaming + dining out", amount: 120, date: today },
  { id: "6", type: "expense", category: "Utilities", description: "Electric & internet", amount: 160, date: today },
  { id: "7", type: "expense", category: "Healthcare", description: "Gym membership", amount: 50, date: today },
  { id: "8", type: "income", category: "Freelance", description: "Side project", amount: 800, date: today },
];

export function BudgetTracker() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    description: "",
    amount: "",
    date: today,
  });

  useEffect(() => {
    const saved = localStorage.getItem("ft-transactions");
    setTransactions(saved ? JSON.parse(saved) : DEFAULT_TRANSACTIONS);
  }, []);

  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem("ft-transactions", JSON.stringify(transactions));
    }
  }, [transactions]);

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    return { income, expenses, savings, savingsRate };
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const monthlyComparison = useMemo(() => {
    return [
      { name: "Income", amount: summary.income, fill: "#10b981" },
      { name: "Expenses", amount: summary.expenses, fill: "#ef4444" },
      { name: "Savings", amount: Math.max(0, summary.savings), fill: "#3b82f6" },
    ];
  }, [summary]);

  const addTransaction = useCallback(() => {
    if (!form.category || !form.description || !form.amount || !form.date) return;
    const t: Transaction = {
      id: crypto.randomUUID(),
      type: form.type,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
    };
    setTransactions((prev) => [t, ...prev]);
    setForm({ type: "expense", category: "", description: "", amount: "", date: today });
    setOpen(false);
  }, [form]);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setTransactions([]);
    localStorage.removeItem("ft-transactions");
  }, []);

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
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
          <CardTitle className="text-white text-base">Transactions</CardTitle>
          <div className="flex gap-2">
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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">Add Transaction</DialogTitle>
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
                      onClick={() => setForm((f) => ({ ...f, type: "income", category: "" }))}
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
                      onClick={() => setForm((f) => ({ ...f, type: "expense", category: "" }))}
                    >
                      <ArrowDown className="h-4 w-4 mr-1" /> Expense
                    </Button>
                  </div>

                  <div>
                    <Label className="text-gray-300 text-sm">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {categories.map((c) => (
                          <SelectItem key={c} value={c} className="text-white focus:bg-gray-700">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    Add {form.type === "income" ? "Income" : "Expense"}
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
                No transactions yet. Add one to get started!
              </div>
            ) : (
              <div>
                {transactions.map((t, idx) => (
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
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="secondary"
                              className="text-xs bg-gray-800 text-gray-400 border-0 py-0 px-1.5"
                            >
                              {t.category}
                            </Badge>
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
    </div>
  );
}
