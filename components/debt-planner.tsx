"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Plus,
  Trash,
  CreditCard,
  TrendingDown,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Receipt,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

interface Payment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  note: string;
}

interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: string;
  monthlyData: Array<{ month: number; balance: number; label: string }>;
  debtOrder: string[];
}

function calculatePayoff(
  debts: Debt[],
  extraPayment: number,
  method: "snowball" | "avalanche"
): PayoffResult {
  if (debts.length === 0) {
    return { months: 0, totalInterest: 0, totalPaid: 0, payoffDate: "", monthlyData: [], debtOrder: [] };
  }

  const sorted = [...debts].sort((a, b) =>
    method === "snowball" ? a.balance - b.balance : b.interestRate - a.interestRate
  );

  const balances = sorted.map((d) => d.balance);
  let totalInterest = 0;
  let months = 0;
  const monthlyData: Array<{ month: number; balance: number; label: string }> = [];

  const initialTotal = balances.reduce((a, b) => a + b, 0);
  monthlyData.push({ month: 0, balance: Math.round(initialTotal), label: "Start" });

  while (balances.some((b) => b > 0.01) && months < 600) {
    months++;

    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue;
      const interest = balances[i] * (sorted[i].interestRate / 100 / 12);
      balances[i] += interest;
      totalInterest += interest;
    }

    let freed = 0;
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) {
        freed += sorted[i].minimumPayment;
        continue;
      }
      const payment = Math.min(sorted[i].minimumPayment, balances[i]);
      balances[i] -= payment;
      if (balances[i] < 0.01) {
        freed += sorted[i].minimumPayment - payment;
        balances[i] = 0;
      }
    }

    let extra = extraPayment + freed;
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue;
      const payment = Math.min(extra, balances[i]);
      balances[i] -= payment;
      extra -= payment;
      if (balances[i] < 0.01) balances[i] = 0;
      if (extra <= 0) break;
    }

    const total = balances.reduce((a, b) => a + b, 0);
    if (months % 3 === 0 || total < 0.01) {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      monthlyData.push({
        month: months,
        balance: Math.round(total),
        label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      });
    }
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  const totalPaid = debts.reduce((sum, d) => sum + d.balance, 0) + totalInterest;

  return {
    months,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(totalPaid),
    payoffDate: payoffDate.toLocaleDateString("default", { month: "long", year: "numeric" }),
    monthlyData,
    debtOrder: sorted.map((d) => d.id),
  };
}

const DEFAULT_DEBTS: Debt[] = [
  { id: "1", name: "Credit Card (Chase)", balance: 6200, interestRate: 22.99, minimumPayment: 124 },
  { id: "2", name: "Student Loan", balance: 18500, interestRate: 5.5, minimumPayment: 220 },
  { id: "3", name: "Car Loan", balance: 9800, interestRate: 6.9, minimumPayment: 280 },
  { id: "4", name: "Medical Debt", balance: 2100, interestRate: 0, minimumPayment: 50 },
];

export function DebtPlanner() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [method, setMethod] = useState<"snowball" | "avalanche">("avalanche");
  const [extraPayment, setExtraPayment] = useState(300);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    balance: "",
    interestRate: "",
    minimumPayment: "",
  });
  const [paymentDialog, setPaymentDialog] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  useEffect(() => {
    const savedDebts = localStorage.getItem("ft-debts");
    const savedMethod = localStorage.getItem("ft-method");
    const savedExtra = localStorage.getItem("ft-extra");
    const savedPayments = localStorage.getItem("ft-payments");
    setDebts(savedDebts ? JSON.parse(savedDebts) : DEFAULT_DEBTS);
    if (savedMethod) setMethod(savedMethod as "snowball" | "avalanche");
    if (savedExtra) setExtraPayment(parseFloat(savedExtra));
    if (savedPayments) setPayments(JSON.parse(savedPayments));
  }, []);

  useEffect(() => {
    localStorage.setItem("ft-debts", JSON.stringify(debts));
  }, [debts]);

  useEffect(() => {
    localStorage.setItem("ft-method", method);
    localStorage.setItem("ft-extra", extraPayment.toString());
  }, [method, extraPayment]);

  useEffect(() => {
    localStorage.setItem("ft-payments", JSON.stringify(payments));
  }, [payments]);

  const avalancheResult = useMemo(
    () => calculatePayoff(debts, extraPayment, "avalanche"),
    [debts, extraPayment]
  );
  const snowballResult = useMemo(
    () => calculatePayoff(debts, extraPayment, "snowball"),
    [debts, extraPayment]
  );
  const currentResult = method === "avalanche" ? avalancheResult : snowballResult;

  const comparisonData = useMemo(() => {
    return [
      {
        name: "Avalanche",
        interest: avalancheResult.totalInterest,
        months: avalancheResult.months,
        fill: "#3b82f6",
      },
      {
        name: "Snowball",
        interest: snowballResult.totalInterest,
        months: snowballResult.months,
        fill: "#10b981",
      },
    ];
  }, [avalancheResult, snowballResult]);

  const interestSaved = snowballResult.totalInterest - avalancheResult.totalInterest;
  const monthsSaved = snowballResult.months - avalancheResult.months;

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinimums = debts.reduce((s, d) => s + d.minimumPayment, 0);

  // Payment-related computed values
  const totalPaidByDebt = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payments) {
      map[p.debtId] = (map[p.debtId] || 0) + p.amount;
    }
    return map;
  }, [payments]);

  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [payments]);

  const addDebt = useCallback(() => {
    if (!form.name || !form.balance || !form.minimumPayment) return;
    const d: Debt = {
      id: crypto.randomUUID(),
      name: form.name,
      balance: parseFloat(form.balance),
      interestRate: parseFloat(form.interestRate) || 0,
      minimumPayment: parseFloat(form.minimumPayment),
    };
    setDebts((prev) => [...prev, d]);
    setForm({ name: "", balance: "", interestRate: "", minimumPayment: "" });
    setOpen(false);
  }, [form]);

  const deleteDebt = useCallback((id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
    setPayments((prev) => prev.filter((p) => p.debtId !== id));
  }, []);

  const openPaymentDialog = useCallback((debtId: string) => {
    setPaymentDialog(debtId);
    setPaymentForm({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
  }, []);

  const logPayment = useCallback(() => {
    if (!paymentDialog || !paymentForm.amount) return;
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) return;

    const payment: Payment = {
      id: crypto.randomUUID(),
      debtId: paymentDialog,
      amount,
      date: paymentForm.date,
      note: paymentForm.note,
    };

    setPayments((prev) => [...prev, payment]);
    setDebts((prev) =>
      prev.map((d) =>
        d.id === paymentDialog
          ? { ...d, balance: Math.max(0, d.balance - amount) }
          : d
      )
    );
    setPaymentForm({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      note: "",
    });
    setPaymentDialog(null);
  }, [paymentDialog, paymentForm]);

  const deletePayment = useCallback(
    (paymentId: string) => {
      const payment = payments.find((p) => p.id === paymentId);
      if (!payment) return;
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      setDebts((prev) =>
        prev.map((d) =>
          d.id === payment.debtId
            ? { ...d, balance: d.balance + payment.amount }
            : d
        )
      );
    },
    [payments]
  );

  const sortedDebts = useMemo(() => {
    return [...debts].sort((a, b) =>
      method === "snowball" ? a.balance - b.balance : b.interestRate - a.interestRate
    );
  }, [debts, method]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: "Total Debt",
            value: `$${totalDebt.toLocaleString()}`,
            sub: `${debts.length} accounts`,
            icon: CreditCard,
            color: "text-red-400",
            iconColor: "text-red-500",
            bg: "bg-red-500/10",
          },
          {
            label: "Monthly Payment",
            value: `$${(totalMinimums + extraPayment).toLocaleString()}`,
            sub: `$${totalMinimums} min + $${extraPayment} extra`,
            icon: DollarSign,
            color: "text-orange-400",
            iconColor: "text-orange-500",
            bg: "bg-orange-500/10",
          },
          {
            label: "Debt Free",
            value: currentResult.payoffDate || "—",
            sub: currentResult.months ? `${currentResult.months} months` : "Add debts",
            icon: Calendar,
            color: "text-blue-400",
            iconColor: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Total Interest",
            value: `$${currentResult.totalInterest.toLocaleString()}`,
            sub: "over loan lifetime",
            icon: TrendingDown,
            color: "text-purple-400",
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
              <div className={cn("text-base sm:text-xl font-bold leading-tight", card.color)}>
                {card.value}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Debt List */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-white text-base">Your Debts</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">Add a Debt</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label className="text-gray-300 text-sm">Debt Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Chase Visa, Student Loan"
                      className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-300 text-sm">Balance ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.balance}
                        onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                        placeholder="5000"
                        className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm">APR (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.interestRate}
                        onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
                        placeholder="22.99"
                        className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Minimum Monthly Payment ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={form.minimumPayment}
                      onChange={(e) => setForm((f) => ({ ...f, minimumPayment: e.target.value }))}
                      placeholder="100"
                      className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
                    />
                  </div>
                  <Button
                    onClick={addDebt}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={!form.name || !form.balance || !form.minimumPayment}
                  >
                    Add Debt
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {debts.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No debts added yet. Add one to start planning!
              </div>
            ) : (
              debts.map((debt) => {
                const paid = totalPaidByDebt[debt.id] || 0;
                const originalBalance = debt.balance + paid;
                const progressPct =
                  originalBalance > 0 ? Math.round((paid / originalBalance) * 100) : 0;
                const isPaidOff = debt.balance <= 0;

                return (
                  <div key={debt.id} className="bg-gray-800 rounded-xl p-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-white text-sm truncate">{debt.name}</div>
                          {isPaidOff && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs shrink-0">
                              Paid Off
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 mt-1">
                          <span
                            className={cn(
                              "font-semibold text-sm",
                              isPaidOff ? "text-emerald-400" : "text-red-400"
                            )}
                          >
                            ${debt.balance.toLocaleString()}
                          </span>
                          <span className="text-gray-400 text-xs">{debt.interestRate}% APR</span>
                          <span className="text-gray-400 text-xs">${debt.minimumPayment}/mo min</span>
                        </div>
                        {paid > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>${paid.toLocaleString()} paid</span>
                              <span>{progressPct}% done</span>
                            </div>
                            <Progress value={progressPct} className="h-1.5 bg-gray-700" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPaymentDialog(debt.id)}
                          className="text-gray-400 hover:text-emerald-400 hover:bg-transparent p-1 h-auto"
                          title="Log a payment"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDebt(debt.id)}
                          className="text-gray-600 hover:text-red-400 hover:bg-transparent p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Strategy Panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Method Selection */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Payoff Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMethod("avalanche")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    method === "avalanche"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">⚡</span>
                    <span className="font-semibold text-white text-sm">Avalanche</span>
                    {method === "avalanche" && (
                      <CheckCircle className="h-3.5 w-3.5 text-blue-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Highest interest rate first. Saves the most money overall.
                  </p>
                  {avalancheResult.months > 0 && (
                    <div className="text-xs text-blue-400 mt-2 font-medium">
                      ${avalancheResult.totalInterest.toLocaleString()} interest · {avalancheResult.months}mo
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setMethod("snowball")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    method === "snowball"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🎯</span>
                    <span className="font-semibold text-white text-sm">Snowball</span>
                    {method === "snowball" && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Smallest balance first. Best for motivation & quick wins.
                  </p>
                  {snowballResult.months > 0 && (
                    <div className="text-xs text-emerald-400 mt-2 font-medium">
                      ${snowballResult.totalInterest.toLocaleString()} interest · {snowballResult.months}mo
                    </div>
                  )}
                </button>
              </div>

              {interestSaved !== 0 && (
                <div
                  className={cn(
                    "flex items-center gap-2 text-xs p-2.5 rounded-lg",
                    interestSaved > 0
                      ? "bg-blue-500/10 text-blue-300"
                      : "bg-emerald-500/10 text-emerald-300"
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {interestSaved > 0
                    ? `Avalanche saves $${interestSaved.toLocaleString()} and ${Math.abs(monthsSaved)} month${Math.abs(monthsSaved) !== 1 ? "s" : ""} vs Snowball`
                    : `Both methods pay off at the same time`}
                </div>
              )}

              <div>
                <Label className="text-gray-300 text-sm">Extra Monthly Payment</Label>
                <div className="flex mt-1">
                  <span className="flex items-center px-3 bg-gray-800 border border-r-0 border-gray-700 rounded-l-md text-gray-400 text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                    className="bg-gray-800 border-gray-700 text-white rounded-l-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Extra amount above minimums directed toward your focus debt each month
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payoff Timeline Chart */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Payoff Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {currentResult.monthlyData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={currentResult.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Remaining Balance"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke={method === "avalanche" ? "#3b82f6" : "#10b981"}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-gray-500 text-sm">
                  Add debts to see your payoff timeline
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Method Comparison Chart */}
      {debts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Interest Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Total Interest"]}
                  />
                  <Bar dataKey="interest" radius={[6, 6, 0, 0]}>
                    {comparisonData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payoff Order */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">
                Payoff Order —{" "}
                <span className={method === "avalanche" ? "text-blue-400" : "text-emerald-400"}>
                  {method === "avalanche" ? "Avalanche" : "Snowball"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {sortedDebts.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">No debts yet</div>
              ) : (
                <div className="space-y-2">
                  {sortedDebts.map((debt, i) => (
                    <div
                      key={debt.id}
                      className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5"
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0",
                          i === 0
                            ? method === "avalanche"
                              ? "bg-blue-600"
                              : "bg-emerald-600"
                            : "bg-gray-600"
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">{debt.name}</div>
                        <div className="text-xs text-gray-400">
                          {method === "snowball"
                            ? `$${debt.balance.toLocaleString()} balance`
                            : `${debt.interestRate}% APR`}
                        </div>
                      </div>
                      {i === 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">
                          Focus
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment History */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowPaymentHistory((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <CardTitle className="text-white text-base">Payment History</CardTitle>
              {payments.length > 0 && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                  {payments.length} payment{payments.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {showPaymentHistory ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {showPaymentHistory && (
          <CardContent className="pt-0">
            {recentPayments.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-6">
                No payments logged yet. Click the{" "}
                <Receipt className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" /> icon on any
                debt to record a payment.
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((payment) => {
                  const debt = debts.find((d) => d.id === payment.debtId);
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5 group"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 flex-shrink-0">
                        <Receipt className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-emerald-400">
                            ${payment.amount.toLocaleString()}
                          </span>
                          <span className="text-sm text-white truncate">
                            {debt?.name ?? "Deleted Debt"}
                          </span>
                          {payment.note && (
                            <span className="text-xs text-gray-500 truncate">· {payment.note}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(payment.date + "T00:00:00").toLocaleDateString("default", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePayment(payment.id)}
                        className="text-gray-600 hover:text-red-400 hover:bg-transparent p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        title="Undo payment"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Log Payment Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={(v) => !v && setPaymentDialog(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              Log Payment —{" "}
              <span className="text-emerald-400">
                {debts.find((d) => d.id === paymentDialog)?.name}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {paymentDialog && (
              <div className="bg-gray-800 rounded-lg p-3 text-sm">
                <span className="text-gray-400">Current balance: </span>
                <span className="text-red-400 font-semibold">
                  ${debts.find((d) => d.id === paymentDialog)?.balance.toLocaleString()}
                </span>
              </div>
            )}
            <div>
              <Label className="text-gray-300 text-sm">Payment Amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="250.00"
                className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Payment Date</Label>
              <Input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Note (optional)</Label>
              <Input
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Extra payment, bonus applied"
                className="bg-gray-800 border-gray-700 text-white mt-1 placeholder:text-gray-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setPaymentDialog(null)}
                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={logPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
              >
                Log Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
