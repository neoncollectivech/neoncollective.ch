import { ordersService } from "../orders.service";

export async function deleteUnpaidAdminOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  return ordersService.deleteDeletableAdminOrder(orderId);
}
