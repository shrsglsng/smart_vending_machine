import React from "react"
import { ShoppingBag } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"

export function OrdersView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Customer Orders Log
        </h1>
        <p className="text-muted-foreground">
          Monitor multi-tenant smart vending checkout payments and dispense operations.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-muted-foreground">Order ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Tenant ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Machine ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Total Amount</TableHead>
              <TableHead className="font-bold text-muted-foreground">Payment Status</TableHead>
              <TableHead className="font-bold text-muted-foreground">Dispense Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-medium">
                No orders loaded yet. Real-time client order feeds will appear here.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
