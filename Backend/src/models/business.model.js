// SQL for creating a business. Run it with the client of the transaction that creates the owner.
// The default settings row is added by a database trigger when the business is inserted.
export async function createBusiness(
  client,
  { ownerUserId, name, type, ownerName, contactNumber, email, address }
) {
  const { rows } = await client.query(
    `INSERT INTO businesses
       (owner_user_id, business_name, business_type, owner_name,
        contact_number, business_email, business_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING business_id, business_name, business_type, owner_name,
               contact_number, business_email, business_address`,
    [ownerUserId, name, type, ownerName, contactNumber, email, address]
  );
  return rows[0];
}
