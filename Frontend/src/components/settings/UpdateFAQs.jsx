import { useState } from "react";
import { HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useLoad } from "../../utils/useLoad";
import {
  createFaq,
  deleteFaq,
  fetchFaqs,
  updateFaq
} from "../../utils/settingsApi";
import SettingsLoad from "./SettingsLoad";
import "./UpdateFAQs.css";

function UpdateFAQsForm({ initial, t }) {
  const [faqs, setFaqs] = useState(initial);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setFormOpen(false);
    setQuestion("");
    setAnswer("");
    setValidationMessage("");
    setErrorMessage("");
  };

  const openNewFAQ = () => {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setValidationMessage("");
    setErrorMessage("");
    setFormOpen(true);
  };

  const openEditFAQ = (faq) => {
    setEditingId(faq.id);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setValidationMessage("");
    setErrorMessage("");
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    const trimmedAnswer = answer.trim();

    if (!trimmedQuestion || !trimmedAnswer) {
      setValidationMessage(t.questionAnswerRequired);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      const values = {
        question: trimmedQuestion,
        answer: trimmedAnswer,
        language: editingId === null
          ? "en"
          : faqs.find((faq) => faq.id === editingId)?.language || "en",
      };
      const savedFaq = editingId === null
        ? await createFaq(values)
        : await updateFaq(editingId, values);

      setFaqs((currentFAQs) =>
        editingId === null
          ? [...currentFAQs, savedFaq]
          : currentFAQs.map((faq) => faq.id === editingId ? savedFaq : faq)
      );
      resetForm();
    } catch (error) {
      console.error("Unable to save FAQ.", error);
      setErrorMessage(`${t.faqSaveError} ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t.deleteFaqConfirm)) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      await deleteFaq(id);
      setFaqs((currentFAQs) => currentFAQs.filter((faq) => faq.id !== id));
      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error("Unable to delete FAQ.", error);
      setErrorMessage(`${t.faqDeleteError} ${error.message}`);
    } finally {
      setIsSaving(false);
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
            <h2>{t.updateFaqs}</h2>
            <p>{t.updateFaqsDescription}</p>
          </div>
        </div>

        {!formOpen && (
          <button
            type="button"
            className="update-faqs-add-btn"
            onClick={openNewFAQ}
          >
            <Plus size={16} />
            {t.addNewFaq}
          </button>
        )}
      </header>

      {formOpen && (
        <form className="update-faqs-form" onSubmit={handleSubmit}>
          <h3>{editingId === null ? t.addNewFaq : t.editFaq}</h3>

          <div className="update-faqs-field">
            <label htmlFor="faq-question">{t.question}</label>
            <input
              id="faq-question"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.questionPlaceholder}
              maxLength={500}
              required
            />
          </div>

          <div className="update-faqs-field">
            <label htmlFor="faq-answer">{t.answer}</label>
            <textarea
              id="faq-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={t.answerPlaceholder}
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
              disabled={isSaving}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="update-faqs-submit-btn"
              disabled={isSaving}
            >
              {editingId === null ? t.saveChanges : t.updateFaqButton}
            </button>
          </div>
        </form>
      )}

      {errorMessage && (
        <p className="update-faqs-validation" role="alert">
          {errorMessage}
        </p>
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
                  disabled={isSaving}
                  aria-label={`${t.editFaq}: ${faq.question}`}
                >
                  <Pencil size={15} />
                  {t.editFaq}
                </button>
                <button
                  type="button"
                  className="update-faq-delete-btn"
                  onClick={() => handleDelete(faq.id)}
                  disabled={isSaving}
                  aria-label={`${t.deleteFaq}: ${faq.question}`}
                >
                  <Trash2 size={15} />
                  {t.deleteFaqButton}
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="update-faqs-empty">{t.noFaqs}</p>
        )}
      </div>
    </section>
  );
}

function UpdateFAQs({ language = "English", t }) {
  const load = useLoad(fetchFaqs);

  return (
    <SettingsLoad language={language} load={load}>
      {(initial) => <UpdateFAQsForm initial={initial} t={t} />}
    </SettingsLoad>
  );
}

export default UpdateFAQs;
