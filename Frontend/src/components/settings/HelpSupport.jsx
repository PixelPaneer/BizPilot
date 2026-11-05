import { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  Search,
  MessageCircle
} from "lucide-react";
import "./HelpSupport.css";

const faqData = {
  English: [
    {
      category: "Inventory Management",
      questions: [
        {
          q: "How do I add a new product?",
          a: "Open Inventory Management, click Add Product, enter the product name, category, price and available quantity, then save the details."
        },
        {
          q: "How can I update product details?",
          a: "Go to Inventory Management, select the product you want to update, edit its details and save your changes."
        },
        {
          q: "What happens when stock becomes low?",
          a: "BizPilot can show low-stock alerts when a product reaches the configured minimum stock threshold. Make sure stock notifications are enabled in Settings."
        },
        {
          q: "How do I handle out-of-stock products?",
          a: "Check the product's available quantity in Inventory Management and update the stock after receiving new inventory."
        }
      ]
    },
    {
      category: "Sales & Analytics",
      questions: [
        {
          q: "How can I track my daily sales?",
          a: "Open Sales and Analytics to review available sales information and monitor your business performance."
        },
        {
          q: "How can I view business reports?",
          a: "Visit Sales and Analytics to view available reports. You can also configure your preferred report frequency in Settings → Notifications & Reports."
        }
      ]
    },
    {
      category: "Account & Settings",
      questions: [
        {
          q: "How do I update my business information?",
          a: "Open Settings → Business Profile, update your business name, owner details, contact information or address, and click Save Changes."
        },
        {
          q: "How can I enable notifications?",
          a: "Go to Settings → Notifications & Reports and enable the notification options you want, such as low-stock and out-of-stock alerts."
        },
        {
          q: "How do I change the language or theme?",
          a: "Open Settings → Language & Preferences. Select English, Hindi or Hinglish, choose Light or Dark theme, and save your preferences."
        },
        {
          q: "What should I do if I forget my password?",
          a: "Use the password recovery option on the login page. If password recovery is not available, contact your system administrator."
        },
        {
          q: "How can I manage account security?",
          a: "Visit Settings → Account & Security to review account information, password settings and two-factor authentication preferences."
        }
      ]
    }
  ],

  Hindi: [
    {
      category: "इन्वेंटरी मैनेजमेंट",
      questions: [
        {
          q: "नया प्रोडक्ट कैसे जोड़ें?",
          a: "Inventory Management खोलें, Add Product पर क्लिक करें, प्रोडक्ट की जानकारी और मात्रा भरें और सेव करें।"
        },
        {
          q: "प्रोडक्ट की जानकारी कैसे बदलें?",
          a: "Inventory Management में प्रोडक्ट चुनें, उसकी जानकारी अपडेट करें और बदलाव सेव करें।"
        },
        {
          q: "स्टॉक कम होने पर क्या होगा?",
          a: "प्रोडक्ट का स्टॉक तय की गई सीमा तक पहुंचने पर BizPilot लो-स्टॉक अलर्ट दिखा सकता है। Settings में नोटिफिकेशन चालू रखें।"
        },
        {
          q: "स्टॉक खत्म होने पर क्या करें?",
          a: "Inventory Management में उपलब्ध मात्रा चेक करें और नया स्टॉक आने पर मात्रा अपडेट करें।"
        }
      ]
    },
    {
      category: "सेल्स और एनालिटिक्स",
      questions: [
        {
          q: "रोजाना की बिक्री कैसे देखें?",
          a: "Sales and Analytics खोलें और उपलब्ध बिक्री की जानकारी और बिजनेस परफॉर्मेंस देखें।"
        },
        {
          q: "बिजनेस रिपोर्ट कैसे देखें?",
          a: "Sales and Analytics में उपलब्ध रिपोर्ट देखें। Settings → Notifications & Reports में रिपोर्ट की फ्रीक्वेंसी भी चुन सकते हैं।"
        }
      ]
    },
    {
      category: "अकाउंट और सेटिंग्स",
      questions: [
        {
          q: "बिजनेस की जानकारी कैसे अपडेट करें?",
          a: "Settings → Business Profile में जाकर बिजनेस नाम, मालिक की जानकारी और संपर्क विवरण बदलें और सेव करें।"
        },
        {
          q: "नोटिफिकेशन कैसे चालू करें?",
          a: "Settings → Notifications & Reports में जाकर जरूरी नोटिफिकेशन विकल्प चालू करें।"
        },
        {
          q: "भाषा या थीम कैसे बदलें?",
          a: "Settings → Language & Preferences में जाकर भाषा और Light या Dark थीम चुनें और सेव करें।"
        },
        {
          q: "पासवर्ड भूलने पर क्या करें?",
          a: "लॉगिन पेज पर पासवर्ड रिकवरी विकल्प इस्तेमाल करें। विकल्प उपलब्ध न होने पर सिस्टम एडमिनिस्ट्रेटर से संपर्क करें।"
        },
        {
          q: "अकाउंट की सुरक्षा कैसे मैनेज करें?",
          a: "Settings → Account & Security में जाकर अकाउंट जानकारी, पासवर्ड सेटिंग और टू-फैक्टर ऑथेंटिकेशन प्राथमिकताएं देखें।"
        }
      ]
    }
  ],

  Hinglish: [
    {
      category: "Inventory Management",
      questions: [
        {
          q: "Naya product kaise add karein?",
          a: "Inventory Management open karein, Add Product par click karein, product details aur quantity fill karke save karein."
        },
        {
          q: "Product ki details kaise update karein?",
          a: "Inventory Management mein product select karein, details edit karein aur changes save karein."
        },
        {
          q: "Stock low hone par kya hoga?",
          a: "Product minimum stock threshold tak pahunchne par BizPilot low-stock alert dikha sakta hai. Settings mein notifications enabled rakhein."
        },
        {
          q: "Stock khatam hone par kya karein?",
          a: "Inventory Management mein available quantity check karein aur naya stock aane par quantity update karein."
        }
      ]
    },
    {
      category: "Sales & Analytics",
      questions: [
        {
          q: "Daily sales kaise track karein?",
          a: "Sales and Analytics open karke available sales information aur business performance check karein."
        },
        {
          q: "Business reports kaise dekhein?",
          a: "Sales and Analytics mein available reports dekhein. Settings → Notifications & Reports mein report frequency bhi set kar sakte hain."
        }
      ]
    },
    {
      category: "Account & Settings",
      questions: [
        {
          q: "Business information kaise update karein?",
          a: "Settings → Business Profile mein jaakar business name, owner details aur contact information update karke save karein."
        },
        {
          q: "Notifications kaise enable karein?",
          a: "Settings → Notifications & Reports mein jaakar low-stock aur out-of-stock alerts enable karein."
        },
        {
          q: "Language ya theme kaise change karein?",
          a: "Settings → Language & Preferences mein jaakar language aur Light ya Dark theme select karke save karein."
        },
        {
          q: "Password bhool jaane par kya karein?",
          a: "Login page par password recovery option use karein. Agar option available nahi hai toh system administrator se contact karein."
        },
        {
          q: "Account security kaise manage karein?",
          a: "Settings → Account & Security mein account information, password settings aur two-factor authentication preferences manage karein."
        }
      ]
    }
  ]
};

function HelpSupport({ language = "English" }) {
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const data = faqData[language] || faqData.English;

  const filteredData = data
    .map((section) => ({
      ...section,
      questions: section.questions.filter((item) =>
        `${item.q} ${item.a}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
    }))
    .filter((section) => section.questions.length > 0);

  return (
    <div className="help-support-page">
      <div className="help-support-heading">
        <div className="help-heading-icon">
          <HelpCircle size={25} />
        </div>

        <h2>
          {language === "Hindi"
            ? "मदद और सहायता"
            : "Help & Support"}
        </h2>

        <p>
          {language === "Hindi"
            ? "BizPilot इस्तेमाल करते समय आपके सवालों के जवाब।"
            : language === "Hinglish"
            ? "BizPilot use karte waqt apne questions ke answers yahan paayein."
            : "Find answers to common questions about using BizPilot."}
        </p>
      </div>

      <div className="help-search">
        <Search size={18} />
        <input
          type="text"
          placeholder={
            language === "Hindi"
              ? "अपना सवाल खोजें..."
              : language === "Hinglish"
              ? "Apna question search karein..."
              : "Search your question..."
          }
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setActiveQuestion(null);
          }}
        />
      </div>

      <div className="faq-sections">
        {filteredData.length > 0 ? (
          filteredData.map((section, sectionIndex) => (
            <section className="faq-category" key={section.category}>
              <h3>{section.category}</h3>

              {section.questions.map((item, questionIndex) => {
                const questionId = `${sectionIndex}-${questionIndex}`;
                const isOpen = activeQuestion === questionId;

                return (
                  <div
                    className={`faq-item ${isOpen ? "open" : ""}`}
                    key={questionId}
                  >
                    <button
                      className="faq-question"
                      onClick={() =>
                        setActiveQuestion(isOpen ? null : questionId)
                      }
                      aria-expanded={isOpen}
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        size={18}
                        className={isOpen ? "rotated" : ""}
                      />
                    </button>

                    {isOpen && (
                      <div className="faq-answer">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))
        ) : (
          <div className="faq-empty">
            {language === "Hindi"
              ? "कोई सवाल नहीं मिला।"
              : language === "Hinglish"
              ? "Koi question nahi mila."
              : "No matching questions found."}
          </div>
        )}
      </div>

      <div className="help-contact-card">
        <div className="help-contact-icon">
          <MessageCircle size={21} />
        </div>

        <div>
          <h3>
            {language === "Hindi"
              ? "अभी भी मदद चाहिए?"
              : "Still need help?"}
          </h3>
          <p>
            {language === "Hindi"
              ? "अधिक सहायता के लिए अपनी सपोर्ट टीम से संपर्क करें।"
              : language === "Hinglish"
              ? "Additional help ke liye apni support team se contact karein."
              : "Contact your support team for additional assistance."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default HelpSupport;