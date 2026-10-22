import type { SupplierNotification } from "./api.js";
import { formatMoney } from "./api.js";

export function SupplierNotificationsPage({ notifications, onRead }: { notifications: SupplierNotification[]; onRead: (id: string) => void }) {
  return <section aria-labelledby="notifications-heading">
    <h2 id="notifications-heading">Supplier notifications</h2>
    {notifications.length === 0 ? <p className="empty-state">No supplier notifications.</p> : <ul className="notification-list">
      {notifications.map(notification => <li key={notification.id}>
        <strong>{notification.orderNumber}</strong> · {formatMoney(notification.totalCents)}
        <ul>{notification.summary.map((item, index) => <li key={`${notification.id}-${index}`}>{item.quantity} × {item.productName} ({formatMoney(item.lineTotalCents)})</li>)}</ul>
        {notification.readAt ? <span>Read</span> : <button onClick={() => onRead(notification.id)}>Mark as read</button>}
      </li>)}
    </ul>}
  </section>;
}
