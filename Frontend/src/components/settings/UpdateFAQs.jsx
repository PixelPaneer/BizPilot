import { useState } from "react";
import { HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import "./UpdateFAQs.css";

const sampleFAQs = [
  {
    id: 1,
    question: "How do I add a new product?",
    answer:
      "Open Inventory Management, click Add Product, enter the product details, and save."
  },
  {
    id: 2,
    question: "How can I view my business reports?",
    answer:
      "Open Business Analytics to review your available sales and performance reports."
  }
];

function UpdateFAQs() {
  const [faqs, setFaqs] = useState(sampleFAQs);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setFormOpen(false);
    setQuestion("");
    setAnswer("");
    setValidationMessage("");
  };

  const openNewFAQ = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setValidationMessage("");
    setFormOpen(true);
  };

  const openEditFAQ = (faq) => {
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setValidationMessage("");
    setFormOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    const trimmedAnswer = answer.trim();

    if (!trimmedQuestion || !trimmedAnswer) {
      setValidationMessage("Question and answer are required.");
      return;
    }

    if (editingId === null) {
      setFaqs((currentFAQs) => [
        ...currentFAQs,
        {
          id: Date.now(),
          question: trimmedQuestion,
          answer: trimmedAnswer
        }
      ]);
    } else {
      setFaqs((currentFAQs) =>
        currentFAQs.map((faq) =>
          faq.id === editingId
            ? { ...faq, question: trimmedQuestion, answer: trimmedAnswer }
            : faq
        )
      );
    }

    resetForm();
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this FAQ?")) {
      return;
    }

    setFaqs((currentFAQs) => currentFAQs.filter((faq) => faq.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <section className="update-faqs">
      <header className="update-faqs-heading">
        <div className="update-faqs-intro">
          <div className="update-faqs-icon">
            <HelpCircle size={22} />
          </div>
          <div>
            <h2>Update FAQs</h2>
            <p>Manage the frequently asked questions for your business.</p>
          </div>
        </div>

        {!formOpen && (
          <button
            type="button"
            className="update-faqs-add-btn"
            onClick={openNewFAQ}
          >
            <Plus size={16} />
            Add New FAQ
          </button>
        )}
      </header>

      {formOpen && (
        <form className="update-faqs-form" onSubmit={handleSubmit}>
          <h3>{editingId === null ? "Add New FAQ" : "Edit FAQ"}</h3>

          <div className="update-faqs-field">
            <label htmlFor="faq-question">Question</label>
            <input
              id="faq-question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Enter a question"
              required
            />
          </div>

          <div className="update-faqs-field">
            <label htmlFor="faq-answer">Answer</label>
            <textarea
              id="faq-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Enter the answer"
              rows={4}
              required
            />
          </div>

          {validationMessage && (
            <p className="update-faqs-validation" role="alert">
              {validationMessage}
            </p>
          )}

          <div className="update-faqs-form-actions">
            <button
              type="button"
              className="update-faqs-cancel-btn"
              onClick={resetForm}
            >
              Cancel
            </button>
            <button type="submit" className="update-faqs-submit-btn">
              {editingId === null ? "Save" : "Update"}
            </button>
          </div>
        </form>
      )}

      <div className="update-faqs-list">
        {faqs.length > 0 ? (
          faqs.map((faq) => (
            <article className="update-faq-card" key={faq.id}>
              <div className="update-faq-content">
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
              <div className="update-faq-actions">
                <button
                  type="button"
                  className="update-faq-edit-btn"
                  onClick={() => openEditFAQ(faq)}
                  aria-label={`Edit FAQ: ${faq.question}`}
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  type="button"
                  className="update-faq-delete-btn"
                  onClick={() => handleDelete(faq.id)}
                  aria-label={`Delete FAQ: ${faq.question}`}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="update-faqs-empty">No FAQs yet. Add one to get started.</p>
        )}
      </div>
    </section>
  );
}

export default UpdateFAQs;
