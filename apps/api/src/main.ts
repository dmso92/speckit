import { createApp, failClosedActorResolver } from "./app.js";
import { developmentFixtureActorResolver, developmentFixtureCatalog } from "./integrations/development-fixtures.js";
import { createConfiguredSmtpTransport, createDevelopmentCaptureTransport } from "./integrations/email/nodemailer-adapter.js";
import { EmailOutboxDispatcher, openDatabase, PurchaseOrderRepository } from "@purchase-orders/library";

const developmentFixturesEnabled = process.env.NODE_ENV === "development" && process.env.PO_ENABLE_DEV_FIXTURES === "true";
const db = openDatabase();
const repository = new PurchaseOrderRepository(db);
const catalog = developmentFixturesEnabled ? developmentFixtureCatalog : {
  async validateReference() { return null; },
  async getProduct() { return null; },
  async getSupplierContact() { return null; }
};
const transport = developmentFixturesEnabled ? createDevelopmentCaptureTransport() : createConfiguredSmtpTransport();
const dispatcher = transport ? new EmailOutboxDispatcher(repository, transport) : undefined;

if (!developmentFixturesEnabled) {
  console.warn("Host identity/catalog adapters are not configured. Authentication and catalog lookups fail closed.");
}
if (developmentFixturesEnabled) {
  console.warn("DEVELOPMENT ONLY: synthetic purchase-order actors/catalog and email capture transport are enabled.");
}
if (!transport) {
  console.warn("SMTP is not configured. Submitted purchase-order email notifications will remain pending in the outbox.");
}

const app = createApp({
  repository,
  catalog,
  resolveActor: developmentFixturesEnabled ? developmentFixtureActorResolver : failClosedActorResolver()
});
if (dispatcher) {
  const dispatchPending = async (): Promise<void> => {
    try {
      await dispatcher.dispatchPending();
    } catch {
      console.error("Email outbox dispatch failed while recording delivery state.");
    }
  };
  void dispatchPending();
  setInterval(() => { void dispatchPending(); }, 30_000);
}
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Purchase-order API listening on port ${port}`));
