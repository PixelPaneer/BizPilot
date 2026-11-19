const messages = {
  English: {
    loading: "Loading your settings…",
    failed: "Could not load your settings",
    retry: "Try again"
  },
  Hindi: {
    loading: "आपकी सेटिंग्स लोड हो रही हैं…",
    failed: "आपकी सेटिंग्स लोड नहीं हो पाईं",
    retry: "फिर कोशिश करें"
  },
  Hinglish: {
    loading: "Aapki settings load ho rahi hain…",
    failed: "Aapki settings load nahi ho payi",
    retry: "Phir try karein"
  }
};

// Shows a loading message, or the error with a retry button, until the section's data has
// arrived. Once it has, it shows its children (the section's form).
function SettingsLoad({ language = "English", load, children }) {
  const text = messages[language] || messages.English;

  if (load.isLoading) {
    return <p className="settings-load-note" role="status">{text.loading}</p>;
  }

  if (load.error) {
    return (
      <div className="settings-load-note" role="alert">
        <p>{text.failed}: {load.error}</p>
        <button type="button" className="settings-retry-btn" onClick={load.retry}>
          {text.retry}
        </button>
      </div>
    );
  }

  return children(load.value);
}

export default SettingsLoad;
