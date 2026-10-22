export interface SubmissionItemSnapshot {
  productName: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface SubmissionNotification {
  purchaseOrderId: string;
  orderNumber: string;
  branchId: string;
  supplierId: string;
  totalCents: number;
  items: SubmissionItemSnapshot[];
}

export interface EmailOutboxMessage extends SubmissionNotification {
  recipient: string;
}

export interface EmailNotifier {
  enqueue(message: EmailOutboxMessage): Promise<void>;
}

export interface SupplierPortalNotifier {
  createInboxItem(notification: SubmissionNotification): Promise<void>;
}
