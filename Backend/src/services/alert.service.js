import {
  getAlertInventory,
  insertActiveAlert,
  resolveActiveAlerts,
} from "../models/alert.model.js";
import { getStockAlertSettings } from "../models/settings.model.js";

export async function syncAlerts(client, businessId, productId) {
  const inventory = await getAlertInventory(client, businessId, productId);
  if (!inventory) {
    await resolveActiveAlerts(client, businessId, productId);
    return;
  }

  const quantity = Number(inventory.available_quantity);
  const threshold = Number(inventory.reorder_threshold);
  const alertType =
    quantity === 0
      ? "OUT_OF_STOCK"
      : quantity <= threshold
        ? "LOW_STOCK"
        : null;
  const settings = await getStockAlertSettings(client, businessId);
  const enabled =
    Boolean(settings?.stock_alerts_enabled) &&
    (alertType === "LOW_STOCK"
      ? Boolean(settings.low_stock_alerts_enabled)
      : alertType === "OUT_OF_STOCK"
        ? Boolean(settings.out_of_stock_alerts_enabled)
        : false);

  await resolveActiveAlerts(
    client,
    businessId,
    productId,
    enabled ? alertType : null
  );
  if (enabled) {
    await insertActiveAlert(
      client,
      businessId,
      productId,
      alertType,
      quantity,
      threshold
    );
  }
}
