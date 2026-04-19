"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fetchExpenses, postExpense } from "@/lib/api-client";
import {
  Receipt,
  HandCoins,
  Plus,
  Loader2,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";

interface ShiftExpense {
  rowIndex: number;
  personName: string;
  entryRowIndex: number;
  type: "expense" | "income";
  amount: number;
  description: string;
  date: string;
}

interface ActiveShiftExpensesProps {
  personName: string;
  entryRowIndex: number;
  onExpenseAdded?: () => void;
}

export function ActiveShiftExpenses({
  personName,
  entryRowIndex,
  onExpenseAdded,
}: ActiveShiftExpensesProps) {
  const [expenses, setExpenses] = useState<ShiftExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Expense form state
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  // Income form state
  const [incomeDesc, setIncomeDesc] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExpenses(entryRowIndex);
      if (Array.isArray(data)) {
        setExpenses(data);
      }
    } catch {
      // silently fail — expenses may not exist yet
    } finally {
      setLoading(false);
    }
  }, [entryRowIndex]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseAmount);
    if (!expenseDesc.trim() || isNaN(amount) || amount <= 0) return;

    setSubmitting(true);
    try {
      await postExpense({
        action: "add",
        personName,
        type: "expense",
        amount,
        description: expenseDesc.trim(),
        entryRowIndex,
      });
      setExpenseDesc("");
      setExpenseAmount("");
      await loadExpenses();
      onExpenseAdded?.();
    } catch {
      // error handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddIncome = async () => {
    const amount = parseFloat(incomeAmount);
    if (!incomeDesc.trim() || isNaN(amount) || amount <= 0) return;

    setSubmitting(true);
    try {
      await postExpense({
        action: "add",
        personName,
        type: "income",
        amount,
        description: incomeDesc.trim(),
        entryRowIndex,
      });
      setIncomeDesc("");
      setIncomeAmount("");
      await loadExpenses();
      onExpenseAdded?.();
    } catch {
      // error handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rowIndex: number) => {
    setSubmitting(true);
    try {
      await postExpense({ action: "delete", rowIndex });
      await loadExpenses();
      onExpenseAdded?.();
    } catch {
      // error handled silently
    } finally {
      setSubmitting(false);
    }
  };

  const expenseItems = expenses.filter((e) => e.type === "expense");
  const incomeItems = expenses.filter((e) => e.type === "income");
  const totalExpenses = expenseItems.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = incomeItems.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-base text-blue-900">
            Gastos y dinero del turno
          </span>
        </div>

        {/* Expense section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">
              Gasto extra
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="expense-desc" className="sr-only">
                Descripción del gasto
              </Label>
              <Input
                id="expense-desc"
                placeholder="Descripción"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-24">
              <Label htmlFor="expense-amount" className="sr-only">
                Monto del gasto
              </Label>
              <Input
                id="expense-amount"
                type="number"
                placeholder="Monto"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="h-9 text-sm"
                min="0"
              />
            </div>
            <Button
              size="sm"
              className="h-9 px-3"
              onClick={handleAddExpense}
              disabled={
                submitting ||
                !expenseDesc.trim() ||
                !expenseAmount ||
                parseFloat(expenseAmount) <= 0
              }
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          {expenseItems.length > 0 && (
            <div className="space-y-1">
              {expenseItems.map((item) => (
                <div
                  key={item.rowIndex}
                  className="flex items-center justify-between bg-red-50 rounded px-2 py-1 text-sm"
                >
                  <span className="text-red-800 truncate flex-1">
                    {item.description}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-red-700">
                      ${item.amount.toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                      onClick={() => handleDelete(item.rowIndex)}
                      disabled={submitting}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Income section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ArrowDownCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-700">
              Dinero recibido
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="income-desc" className="sr-only">
                Descripción del ingreso
              </Label>
              <Input
                id="income-desc"
                placeholder="Descripción"
                value={incomeDesc}
                onChange={(e) => setIncomeDesc(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-24">
              <Label htmlFor="income-amount" className="sr-only">
                Monto del ingreso
              </Label>
              <Input
                id="income-amount"
                type="number"
                placeholder="Monto"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                className="h-9 text-sm"
                min="0"
              />
            </div>
            <Button
              size="sm"
              className="h-9 px-3"
              onClick={handleAddIncome}
              disabled={
                submitting ||
                !incomeDesc.trim() ||
                !incomeAmount ||
                parseFloat(incomeAmount) <= 0
              }
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
          {incomeItems.length > 0 && (
            <div className="space-y-1">
              {incomeItems.map((item) => (
                <div
                  key={item.rowIndex}
                  className="flex items-center justify-between bg-green-50 rounded px-2 py-1 text-sm"
                >
                  <span className="text-green-800 truncate flex-1">
                    {item.description}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-green-700">
                      ${item.amount.toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-green-400 hover:text-green-600"
                      onClick={() => handleDelete(item.rowIndex)}
                      disabled={submitting}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {(expenseItems.length > 0 || incomeItems.length > 0) && (
          <div className="border-t pt-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total gastos extra</span>
              <Badge
                variant="outline"
                className="text-red-700 border-red-200 bg-red-50"
              >
                +${totalExpenses.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total dinero recibido</span>
              <Badge
                variant="outline"
                className="text-green-700 border-green-200 bg-green-50"
              >
                -${totalIncome.toLocaleString()}
              </Badge>
            </div>
          </div>
        )}

        {loading && expenses.length === 0 && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-500 ml-2">Cargando...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
