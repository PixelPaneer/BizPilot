import assert from "node:assert/strict";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("FAQ search integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [{ default: app }, { env }, { pool }] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/config/env.js"),
    import("../../src/config/db.js"),
  ]);

  const SECRET = "test-service-secret-test-service-secret-1";
  let fixture;

  function aiToken(businessId) {
    const issuedAt = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iss: "bizpilot-ai", aud: "bizpilot-node", business_id: businessId, iat: issuedAt, exp: issuedAt + 60 },
      SECRET,
      { algorithm: "HS256" }
    );
  }

  const search = (queryString, businessId = fixture.businessId) =>
    request(app)
      .get(`/internal/faqs/search?${queryString}`)
      .set("Authorization", `Bearer ${aiToken(businessId)}`);

  async function createFixture() {
    const { rows: users } = await pool.query(
      `INSERT INTO app_users
         (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ('FAQ', 'Tester', 'faq-search@bizpilot.local', 'test-hash', '9000000053'),
              ('Other', 'Tenant', 'other-faq-search@bizpilot.local', 'test-hash', '9000000054')
       RETURNING user_id`
    );
    const { rows: businesses } = await pool.query(
      `INSERT INTO businesses
         (owner_user_id, business_name, business_type, owner_name,
          contact_number, business_email, business_address)
       VALUES ($1, 'FAQ Test Business', 'Retail', 'FAQ Tester',
               '9000000053', 'faq-search@bizpilot.local', 'Test address'),
              ($2, 'Other FAQ Business', 'Retail', 'Other Tenant',
               '9000000054', 'other-faq-search@bizpilot.local', 'Test address')
       RETURNING business_id`,
      users.map((row) => row.user_id)
    );
    return {
      businessId: businesses[0].business_id,
      otherBusinessId: businesses[1].business_id,
    };
  }

  async function addFaq({
    businessId = fixture.businessId,
    question,
    answer,
    language = "en",
    active = true,
  }) {
    await pool.query(
      `INSERT INTO faqs (business_id, question, answer, language, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [businessId, question, answer, language, active]
    );
  }

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE TABLE inventory_alerts, stock_movements, audit_logs, sale_items, sales,
         purchase_batches, inventory, products, business_settings, faqs, businesses, app_users
       CASCADE`
    );
    fixture = await createFixture();
    env.serviceJwtSecret = SECRET;
  });

  after(async () => {
    await pool.end();
  });

  test("returns only active FAQs for the business named by the service token", async () => {
    await addFaq({
      question: "What payment methods are accepted?",
      answer: "We accept UPI and cash.",
    });
    await addFaq({
      businessId: fixture.otherBusinessId,
      question: "What payment methods are accepted?",
      answer: "This answer belongs to another shop.",
    });
    await addFaq({
      question: "What payment methods are accepted?",
      answer: "This answer is inactive.",
      active: false,
    });

    const response = await search(`q=${encodeURIComponent("payment methods")}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.success, true);
    assert.equal(response.body.data.faqs.length, 1);
    assert.deepEqual(Object.keys(response.body.data.faqs[0]).sort(), [
      "answer",
      "faqId",
      "language",
      "question",
      "similarity",
    ]);
    assert.equal(response.body.data.faqs[0].answer, "We accept UPI and cash.");
    assert.equal(typeof response.body.data.faqs[0].similarity, "number");
  });

  test("filters FAQ results by language", async () => {
    await addFaq({
      question: "Is home delivery available?",
      answer: "Home delivery is available.",
      language: "en",
    });
    await addFaq({
      question: "Is home delivery available?",
      answer: "घर तक डिलीवरी उपलब्ध है।",
      language: "hi",
    });

    const english = await search("q=delivery&language=en");
    const hindi = await search("q=delivery&language=hi");

    assert.deepEqual(english.body.data.faqs.map((faq) => faq.language), ["en"]);
    assert.deepEqual(hindi.body.data.faqs.map((faq) => faq.language), ["hi"]);
  });

  test("a business ID in the query cannot change the service-token tenant", async () => {
    await addFaq({
      question: "Where is the shop?",
      answer: "The shop is on MG Road.",
    });
    await addFaq({
      businessId: fixture.otherBusinessId,
      question: "Where is the shop?",
      answer: "This answer belongs to another shop.",
    });

    const response = await request(app)
      .get(`/internal/faqs/search?q=shop&businessId=${fixture.otherBusinessId}`)
      .set("Authorization", `Bearer ${aiToken(fixture.businessId)}`)
      .set("X-Business-Id", fixture.otherBusinessId);

    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.data.faqs.map((faq) => faq.answer),
      ["The shop is on MG Road."]
    );
  });

  test("invalid FAQ search parameters are rejected", async () => {
    for (const queryString of ["", "q=a", "q=delivery&limit=6", "q=delivery&language=not valid"]) {
      const response = await search(queryString);
      assert.equal(response.status, 400, queryString);
      assert.equal(response.body.success, false);
    }
  });

  test("FAQ search requires a service token", async () => {
    const response = await request(app).get("/internal/faqs/search?q=delivery");
    assert.equal(response.status, 401);
  });
}
