"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetTracker } from "@/components/budget-tracker";
import { DebtPlanner } from "@/components/debt-planner";
import { DollarSign, CreditCard } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="bg-emerald-500 rounded-xl p-2 shadow-lg shadow-emerald-500/20">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">FinanceTracker</h1>
            <p className="text-xs text-gray-400 mt-0.5">Budget & Debt Payoff Planner</p>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="budget" className="w-full">
          <TabsList className="bg-gray-900 border border-gray-800 mb-6 w-full sm:w-auto">
            <TabsTrigger value="budget" className="flex items-center gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <DollarSign className="h-4 w-4" />
              Budget Tracker
            </TabsTrigger>
            <TabsTrigger value="debt" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <CreditCard className="h-4 w-4" />
              Debt Planner
            </TabsTrigger>
          </TabsList>
          <TabsContent value="budget"><BudgetTracker /></TabsContent>
          <TabsContent value="debt"><DebtPlanner /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
