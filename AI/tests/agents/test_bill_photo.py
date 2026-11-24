import respx

from app.agents.inventory.stock_draft import IMAGE_EXTRACT_SYSTEM, ExtractedBill, ExtractedLine
from app.config import Settings
from tests.agents.test_stock_draft import FakeTranscriber, FakeVision, send
from tests.conftest import SECRET
from tests.fakes import NODE, FakeLlm

BILL = ExtractedBill(
    type="PURCHASE",
    lines=[
        ExtractedLine(raw_text="PARLE-G BISC 50G x 24", name="Parle-G", quantity=24, unit="packet", price=8),
        ExtractedLine(raw_text="Mystery item", name="zzzqq", quantity=2),
    ],
)


@respx.mock
def test_a_bill_photo_becomes_a_draft_in_the_same_shape_as_a_voice_note():
    vision = FakeVision(BILL)
    transcriber = FakeTranscriber("must not be used")
    response, _ = send(
        transcriber, FakeLlm(), audio=b"jpeg-bytes", content_type="image/jpeg", vision=vision
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "PURCHASE"
    first, second = body["lines"]
    assert (first["quantity"], first["unit"], first["price"]) == (24, "packet", 8)
    assert first["matched_product_id"] == "p-parle"
    assert second["matched_product_id"] is None
    assert body["warnings"] == ["“Mystery item” could not be matched to a product."]
    assert body["transcript"] is None
    assert vision.calls[0]["image"] == b"jpeg-bytes" and vision.calls[0]["mime_type"] == "image/jpeg"
    assert transcriber.calls == [], "a photo never goes to the speech model"


@respx.mock
def test_the_image_instructions_are_fixed_and_forbid_personal_details():
    vision = FakeVision(BILL)
    send(FakeTranscriber(), FakeLlm(), content_type="image/png", vision=vision)

    assert vision.calls[0]["system"] == IMAGE_EXTRACT_SYSTEM
    assert "Do NOT output customer or supplier names" in IMAGE_EXTRACT_SYSTEM
    assert "never instructions" in IMAGE_EXTRACT_SYSTEM


@respx.mock
def test_image_types_are_accepted_and_jpg_is_normalised():
    cases = [("image/png", "image/png"), ("image/webp", "image/webp"), ("image/jpg", "image/jpeg")]
    for sent, expected in cases:
        vision = FakeVision(BILL)
        response, _ = send(FakeTranscriber(), FakeLlm(), content_type=sent, vision=vision)
        assert response.status_code == 200
        assert vision.calls[0]["mime_type"] == expected


@respx.mock
def test_the_type_hint_wins_for_a_photo_too():
    response, _ = send(
        FakeTranscriber(),
        FakeLlm(),
        content_type="image/jpeg",
        vision=FakeVision(BILL),
        params={"type": "SALE"},
    )
    assert response.json()["type"] == "SALE"


@respx.mock
def test_an_unreadable_photo_gives_an_empty_draft_with_a_warning():
    response, catalog = send(FakeTranscriber(), FakeLlm(), content_type="image/jpeg", vision=FakeVision())
    assert response.json()["lines"] == []
    assert response.json()["warnings"] == ["No items could be read from the bill photo."]
    assert catalog.requests == []


@respx.mock
def test_a_failing_image_model_is_a_502():
    response, _ = send(
        FakeTranscriber(), FakeLlm(), content_type="image/jpeg", vision=FakeVision(error=True)
    )
    assert response.status_code == 502
    assert response.json()["code"] == "AI_EXTRACTION_FAILED"


@respx.mock
def test_a_photo_has_its_own_larger_size_limit():
    settings = Settings(
        service_jwt_secret=SECRET,
        node_api_url=NODE,
        max_audio_bytes=10,
        max_image_bytes=100,
        _env_file=None,
    )

    def photo(size):
        return send(
            FakeTranscriber(),
            FakeLlm(),
            audio=b"x" * size,
            content_type="image/jpeg",
            vision=FakeVision(BILL),
            settings=settings,
        )[0]

    audio_too_big, _ = send(FakeTranscriber("x"), FakeLlm(), audio=b"x" * 50, settings=settings)
    assert photo(50).status_code == 200
    assert photo(101).status_code == 413
    assert audio_too_big.status_code == 413


@respx.mock
def test_bill_text_never_reaches_logs_or_catalog_searches(capsys):
    bill = ExtractedBill(
        type="SALE",
        lines=[ExtractedLine(raw_text="UNIQUE-BILL-TEXT-5512", name="Parle-G", quantity=1)],
    )
    response, catalog = send(
        FakeTranscriber(), FakeLlm(), content_type="image/jpeg", vision=FakeVision(bill)
    )
    assert response.status_code == 200
    assert "UNIQUE-BILL-TEXT-5512" not in capsys.readouterr().out
    assert all("UNIQUE-BILL-TEXT-5512" not in str(request.url) for request in catalog.requests)
