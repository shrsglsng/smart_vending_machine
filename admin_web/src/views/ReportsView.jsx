import React from "react"
import { AlertTriangle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"

export function ReportsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Hardware & Maintenance Reports
        </h1>
        <p className="text-muted-foreground">
          Audit customer complaints, technician feedback, and dynamic system error telemetry.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold text-muted-foreground">Report ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Tenant Context</TableHead>
              <TableHead className="font-bold text-muted-foreground">Machine ID</TableHead>
              <TableHead className="font-bold text-muted-foreground">Category</TableHead>
              <TableHead className="font-bold text-muted-foreground">Severity</TableHead>
              <TableHead className="font-bold text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-medium">
                No active issues reported. All smart vending nodes are operating operational.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
