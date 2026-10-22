import type { EmailOutboxRecord, PurchaseOrderRepository } from "../sqlite/purchase-order-repository.js";

export interface MailTransport {
  sendMail(message: { to: string; subject: string; text: string }): Promise<unknown>;
}

export class EmailOutboxDispatcher {
  constructor(private readonly repository: PurchaseOrderRepository, private readonly transport: MailTransport) {}

  async dispatchPending(): Promise<void> {
    for (const record of this.repository.listEmailOutbox("Pending")) await this.dispatch(record);
  }

  async retryFailed(): Promise<void> {
    for (const record of this.repository.listEmailOutbox("Failed")) await this.dispatch(record);
  }

  private async dispatch(record: EmailOutboxRecord): Promise<void> {
    try {
      await this.transport.sendMail({
        to: record.recipient,
        subject: `Purchase order ${record.payload.orderNumber}`,
        text: `${record.payload.orderNumber} (${record.payload.purchaseOrderId}) total ${record.payload.totalCents} USD cents\n` +
          record.payload.items.map(item => `${item.quantity} × ${item.productName} ${item.sku ?? ""}: ${item.lineTotalCents} cents`).join("\n")
      });
      this.repository.recordEmailAttempt(record.id, { sent: true });
    } catch {
      // Persist only a sanitized, non-sensitive failure summary; transport errors can contain secrets.
      this.repository.recordEmailAttempt(record.id, { sent: false, error: "Email transport failed; retry is available." });
    }
  }
}
