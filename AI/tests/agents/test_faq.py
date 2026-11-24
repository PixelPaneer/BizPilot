
import pytest

from app.agents.customer.faq import find_faq


class FakeNode:
    def __init__(self, response):
        self.response = response
        self.calls = []

    async def get(self, business_id, path, params=None):
        self.calls.append({
            "business_id": business_id,
            "path": path,
            "params": params,
        })
        return self.response


@pytest.mark.asyncio
async def test_find_faq_returns_matching_faq():
    business_id = "business-123"

    node = FakeNode({
        "faqs": [
            {
                "faqId": "faq-101",
                "question": "What are your shop timings?",
                "answer": "Our shop is open from 9 AM to 9 PM.",
                "language": "en",
                "similarity": 0.92,
            }
        ]
    })

    result = await find_faq(
        business_id=business_id,
        question="What are your shop timings?",
        language="english",
        node=node,
    )

    # Verify the returned FAQ
    assert result is not None
    assert result.faq_id == "faq-101"
    assert result.question == "What are your shop timings?"
    assert result.answer == "Our shop is open from 9 AM to 9 PM."
    assert result.language == "en"
    assert result.similarity == 0.92

    # Verify the request sent to Node
    assert len(node.calls) == 1

    call = node.calls[0]

    assert call["business_id"] == business_id
    assert call["path"] == "/internal/faqs/search"
    assert call["params"] == {
        "q": "What are your shop timings?",
        "language": "en",
        "limit": 5,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("language", "expected_language"),
    [
        ("english", "en"),
        ("hindi", "hi"),
        ("hinglish", "hinglish"),
    ],
)
async def test_find_faq_maps_language_correctly(language, expected_language):
    node = FakeNode({"faqs": []})

    result = await find_faq(
        business_id="business-123",
        question="What are your timings?",
        language=language,
        node=node,
    )

    assert result is None
    assert node.calls[0]["params"]["language"] == expected_language

@pytest.mark.asyncio
async def test_find_faq_returns_none_when_faq_list_is_empty():
    node = FakeNode({"faqs": []})

    result = await find_faq(
        business_id="business-123",
        question="What are your shop timings?",
        language="english",
        node=node,
    )

    assert result is None
    assert len(node.calls) == 1


#test 4
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [
        None,
        "Invalid response",
        [],
        {"faqs": "invalid"},
        {"faqs": None},
    ],
)
async def test_find_faq_handles_invalid_backend_response(response):
    node = FakeNode(response)

    result = await find_faq(
        business_id="business-123",
        question="What are your shop timings?",
        language="english",
        node=node,
    )

    assert result is None

#test 5

@pytest.mark.asyncio
async def test_find_faq_skips_invalid_records_and_returns_first_valid():
    node = FakeNode({
        "faqs": [
            # Invalid: missing answer
            {
                "faqId": "faq-101",
                "question": "What are your timings?",
                "language": "en",
                "similarity": 0.95,
            },
            # Invalid: empty question
            {
                "faqId": "faq-102",
                "question": "   ",
                "answer": "We open at 9 AM.",
                "language": "en",
                "similarity": 0.90,
            },
            # Valid FAQ
            {
                "faqId": "faq-103",
                "question": "Where is your shop?",
                "answer": "We are located in Bhopal.",
                "language": "en",
                "similarity": 0.85,
            },
            # Another valid FAQ, but should not be selected
            {
                "faqId": "faq-104",
                "question": "What are your timings?",
                "answer": "We open at 9 AM.",
                "language": "en",
                "similarity": 0.80,
            },
        ]
    })

    result = await find_faq(
        business_id="business-123",
        question="Where is your shop?",
        language="english",
        node=node,
    )

    assert result is not None
    assert result.faq_id == "faq-103"
    assert result.question == "Where is your shop?"
    assert result.answer == "We are located in Bhopal."
    assert result.similarity == 0.85

    #test 6

@pytest.mark.asyncio
async def test_find_faq_handles_invalid_similarity_score():
    node = FakeNode({
        "faqs": [
            {
                "faqId": "faq-101",
                "question": "What are your timings?",
                "answer": "We open at 9 AM.",
                "language": "en",
                "similarity": "invalid",
            }
        ]
    })

    result = await find_faq(
        business_id="business-123",
        question="What are your timings?",
        language="english",
        node=node,
    )

    assert result is not None
    assert result.faq_id == "faq-101"
    assert result.similarity == 0.0

#test 7

@pytest.mark.asyncio
async def test_find_faq_defaults_missing_similarity_to_zero():
    node = FakeNode({
        "faqs": [
            {
                "faqId": "faq-101",
                "question": "What are your timings?",
                "answer": "We open at 9 AM.",
                "language": "en",
            }
        ]
    })

    result = await find_faq(
        business_id="business-123",
        question="What are your timings?",
        language="english",
        node=node,
    )

    assert result is not None
    assert result.faq_id == "faq-101"
    assert result.similarity == 0.0


#test 8

@pytest.mark.asyncio
async def test_find_faq_skips_non_dictionary_records():
    node = FakeNode({
        "faqs": [
            "invalid record",
            None,
            123,
            ["unexpected", "list"],
            {
                "faqId": "faq-105",
                "question": "Do you provide home delivery?",
                "answer": "Yes, home delivery is available.",
                "language": "en",
                "similarity": 0.91,
            },
        ]
    })

    result = await find_faq(
        business_id="business-123",
        question="Do you provide home delivery?",
        language="english",
        node=node,
    )

    assert result is not None
    assert result.faq_id == "faq-105"
    assert result.answer == "Yes, home delivery is available."

#test 9

@pytest.mark.asyncio
async def test_find_faq_strips_whitespace():
    node = FakeNode({
        "faqs": [
            {
                "faqId": "faq-106",
                "question": "  What are your timings?  ",
                "answer": "  We open at 9 AM.  ",
                "language": "en",
                "similarity": 0.90,
            }
        ]
    })

    result = await find_faq(
        business_id="business-123",
        question="  What are your timings?  ",
        language="english",
        node=node,
    )

    assert result is not None
    assert result.question == "What are your timings?"
    assert result.answer == "We open at 9 AM."
    assert node.calls[0]["params"]["q"] == "What are your timings?"

#10

@pytest.mark.asyncio
async def test_find_faq_defaults_unknown_language_to_english():
    node = FakeNode({"faqs": []})

    result = await find_faq(
        business_id="business-123",
        question="What are your timings?",
        language="french",
        node=node,
    )

    assert result is None
    assert node.calls[0]["params"]["language"] == "en"

#11
@pytest.mark.asyncio
async def test_find_faq_propagates_backend_error():
    class FailingNode:
        async def get(self, business_id, path, params=None):
            raise RuntimeError("Backend connection failed")

    node = FailingNode()

    with pytest.raises(RuntimeError, match="Backend connection failed"):
        await find_faq(
            business_id="business-123",
            question="What are your timings?",
            language="english",
            node=node,
        )



@pytest.mark.asyncio
@pytest.mark.parametrize("similarity", ["NaN", "Infinity", "-Infinity", float("nan"), float("inf"), float("-inf")])
async def test_find_faq_handles_non_finite_similarity(similarity):
    node = FakeNode({
        "faqs": [
            {
                "faqId": "faq-107",
                "question": "What are your timings?",
                "answer": "We open at 9 AM.",
                "language": "en",
                "similarity": similarity,
            }
        ]
    })

    result = await find_faq(
        business_id="business-123",
        question="What are your timings?",
        language="english",
        node=node,
    )

    assert result is not None
    assert result.similarity == 0.0


@pytest.mark.asyncio
async def test_find_faq_preserves_answer_content():
    expected_answer = "  We accept UPI, cash, and cards.\nPlease ask staff for details.  "

    node = FakeNode({
        "faqs": [
            {
                "faqId": "faq-108",
                "question": "Which payment methods are accepted?",
                "answer": expected_answer,
                "language": "en",
                "similarity": 0.95,
            }
        ]
    })

    result = await find_faq(
        business_id="business-123",
        question="Which payment methods are accepted?",
        language="english",
        node=node,
    )

    assert result is not None
    # The current implementation strips outer whitespace.
    assert result.answer == expected_answer.strip()
