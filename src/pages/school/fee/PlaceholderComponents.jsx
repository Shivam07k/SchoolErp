import React from 'react';
import { PageShell, Empty } from './shared';

const Placeholder = ({ title, icon, subtitle }) => (
  <PageShell
    title={title}
    icon={icon}
    subtitle={subtitle}
  >
    <div className="text-center py-5">
      <i className={`bi ${icon} d-block mb-2 text-muted`} style={{ fontSize: 48 }}></i>
      <h5 className="fw-bold">{title}</h5>
      <p className="text-muted small">{subtitle}</p>
      <div className="text-muted small mt-3">Coming soon</div>
    </div>
  </PageShell>
);

export default function FeeStructures({ me, onNavigate }) {
  return <Placeholder title="Fee Structures" icon="bi-diagram-3" subtitle="Create and manage fee structures per academic year" />;
}
export function Installments({ me, onNavigate }) {
  return <Placeholder title="Installments" icon="bi-calendar3" subtitle="Manage installment schedules and due dates" />;
}
export function FineRules({ me, onNavigate }) {
  return <Placeholder title="Fine Rules" icon="bi-exclamation-triangle" subtitle="Configure late fine rules and grace periods" />;
}
export function ConcessionTypes({ me, onNavigate }) {
  return <Placeholder title="Concession Types" icon="bi-percent" subtitle="Define concession rules and approval chains" />;
}
export function StudentAssignments({ me, onNavigate }) {
  return <Placeholder title="Student Assignments" icon="bi-person-gear" subtitle="Assign students to fee structures and categories" />;
}
export function Families({ me, onNavigate }) {
  return <Placeholder title="Families" icon="bi-people" subtitle="Group siblings for combined billing" />;
}
export function CounterCollection({ me, onNavigate }) {
  return <Placeholder title="Counter Collection" icon="bi-cash-stack" subtitle="Fast counter collection with family view" />;
}
export function ReceiptsList({ me, onNavigate }) {
  return <Placeholder title="Receipts" icon="bi-receipt" subtitle="View and manage fee receipts" />;
}
export function InvoicesList({ me, onNavigate }) {
  return <Placeholder title="Invoices" icon="bi-file-earmark-text" subtitle="View and manage fee invoices" />;
}
export function Cheques({ me, onNavigate }) {
  return <Placeholder title="Cheques" icon="bi-check2-square" subtitle="Manage cheque deposits and clearances" />;
}
export function OnlinePaymentsDashboard({ me, onNavigate }) {
  return <Placeholder title="Online Payments" icon="bi-credit-card" subtitle="Manage payment gateways and webhooks" />;
}
export function CashierDay({ me, onNavigate }) {
  return <Placeholder title="Cashier Day" icon="bi-cash-coin" subtitle="Cashier day-end closing and reconciliation" />;
}
export function DuesDashboard({ me, onNavigate }) {
  return <Placeholder title="Dues Dashboard" icon="bi-graph-up" subtitle="View dues ageing and defaulter analytics" />;
}
export function AgeingReport({ me, onNavigate }) {
  return <Placeholder title="Ageing Report" icon="bi-bar-chart" subtitle="Dues ageing analysis (0-30, 31-60, 61-90, 90+)" />;
}
export function DefaultersList({ me, onNavigate }) {
  return <Placeholder title="Defaulters" icon="bi-person-x" subtitle="Defaulter lists with block actions" />;
}
export function Reminders({ me, onNavigate }) {
  return <Placeholder title="Reminders" icon="bi-bell" subtitle="Configure and send payment reminders" />;
}
export function FollowUps({ me, onNavigate }) {
  return <Placeholder title="Follow-ups" icon="bi-chat-dots" subtitle="Track payment follow-ups and promises" />;
}
export function PaymentPlans({ me, onNavigate }) {
  return <Placeholder title="Payment Plans" icon="bi-calendar-check" subtitle="Manage payment plans for defaulters" />;
}
export function BlockPolicies({ me, onNavigate }) {
  return <Placeholder title="Block Policies" icon="bi-shield-lock" subtitle="Configure defaulter block rules" />;
}
export function RefundsDashboard({ me, onNavigate }) {
  return <Placeholder title="Refunds" icon="bi-arrow-return-left" subtitle="Manage refund requests and approvals" />;
}
export function RefundRequests({ me, onNavigate }) {
  return <Placeholder title="Refund Requests" icon="bi-file-earmark-arrow-up" subtitle="View and process refund requests" />;
}
export function RefundRules({ me, onNavigate }) {
  return <Placeholder title="Refund Rules" icon="bi-rulers" subtitle="Configure refund policies and deduction rules" />;
}
export function CreditNotes({ me, onNavigate }) {
  return <Placeholder title="Credit Notes" icon="bi-file-earmark-plus" subtitle="Manage credit notes for future dues" />;
}
export function Deposits({ me, onNavigate }) {
  return <Placeholder title="Deposits" icon="bi-bank" subtitle="Manage security and caution deposits" />;
}
export function ReconciliationDashboard({ me, onNavigate }) {
  return <Placeholder title="Reconciliation" icon="bi-arrow-left-right" subtitle="Cashier, cheque, gateway and bank reconciliation" />;
}
export function CashierReconciliation({ me, onNavigate }) {
  return <Placeholder title="Cashier Reconciliation" icon="bi-cash-coin" subtitle="Cashier day-end closing and exceptions" />;
}
export function ChequeReconciliation({ me, onNavigate }) {
  return <Placeholder title="Cheque Reconciliation" icon="bi-check2-square" subtitle="Track cheque deposits and clearances" />;
}
export function GatewayReconciliation({ me, onNavigate }) {
  return <Placeholder title="Gateway Reconciliation" icon="bi-credit-card" subtitle="Payment gateway settlement matching" />;
}
export function BankReconciliation({ me, onNavigate }) {
  return <Placeholder title="Bank Reconciliation" icon="bi-bank" subtitle="Bank statement import and matching" />;
}
export function ExceptionsList({ me, onNavigate }) {
  return <Placeholder title="Exceptions" icon="bi-exclamation-triangle" subtitle="Review and resolve reconciliation exceptions" />;
}
export function FeeReportsDashboard({ me, onNavigate }) {
  return <Placeholder title="Fee Reports" icon="bi-bar-chart" subtitle="Collection, dues, refunds and reconciliation reports" />;
}
