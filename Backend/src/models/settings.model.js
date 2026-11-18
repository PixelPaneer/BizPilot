export async function getStockAlertSettings(client, businessId) {
  const { rows } = await client.query(
    `SELECT stock_alerts_enabled, low_stock_alerts_enabled,
            out_of_stock_alerts_enabled
       FROM business_settings
      WHERE business_id = $1`,
    [businessId]
  );
  return rows[0] ?? null;
}
