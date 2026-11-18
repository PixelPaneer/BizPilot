export async function insertAuditLog(client, {
  businessId,
  userId,
  actionType,
  entityType,
  entityId,
  description,
  outcome = "SUCCESS",
}) {
  await client.query(
    `INSERT INTO audit_logs
       (business_id, user_id, action_type, entity_type, entity_id, description, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      businessId,
      userId ?? null,
      actionType,
      entityType,
      entityId,
      description,
      outcome,
    ]
  );
}
