import type { OrderStatus } from "../lib/api";

const MAP: Record<OrderStatus, string> = {
  PENDING: "badge-pending",
  VALIDATED: "badge-open",
  OPEN: "badge-open",
  PARTIAL: "badge-filled",
  FILLED: "badge-confirmed",
  CANCELLED: "badge-rejected",
  REJECTED: "badge-rejected",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`badge ${MAP[status] ?? "badge-open"}`}>{status}</span>
  );
}
