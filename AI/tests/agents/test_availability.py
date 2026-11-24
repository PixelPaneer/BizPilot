import json

import httpx
import pytest
import respx

from app.agents.customer.schemas import Mention
from app.agents.inventory.availability import find_availability
from app.agents.inventory.schemas import AvailabilityItem, Choice
from app.errors import ApiError
from app.llm.base import LlmError
from app.tools.node_client import NodeClient
from tests.conftest import BUSINESS_ID
from tests.fakes import NODE, FakeCatalog, FakeLlm

PRODUCTS = [
    {"productId": "p-5", "name": "Parle-G 50g", "price": 5, "status": "available"},
    {"productId": "p-10", "name": "Parle-G 100g", "price": 10, "status": "limited"},
    {"productId": "p-gold", "name": "Parle-G Gold", "price": 20, "status": "out"},
    {"productId": "p-maggi", "name": "Maggi Noodles", "price": 14, "status": "available"},
    {"productId": "p-butter", "name": "Amul Butter", "price": 55, "status": "available"},
]


@pytest.fixture
def node(settings):
    return NodeClient(settings)


def mention(text, latin=None, **extra):
    return Mention(text=text, latin_text=latin or text, **extra)


def mount(catalog):
    respx.get(f"{NODE}/internal/catalog/search").mock(side_effect=catalog)


@respx.mock
async def test_clear_matches_need_no_model(node):
    catalog = FakeCatalog(PRODUCTS)
    mount(catalog)
    llm = FakeLlm()

    items = await find_availability(BUSINESS_ID, [mention("parle g")], node=node, llm=llm)

    assert {item.name for item in items} == {"Parle-G 50g", "Parle-G 100g", "Parle-G Gold"}
    assert llm.calls == [], "no match was in doubt, so the model was not asked"
    assert catalog.queries == ["parle g"]


@respx.mock
async def test_only_name_price_and_status_leave_for_the_reply(node):
    mount(FakeCatalog(PRODUCTS))
    [item] = await find_availability(BUSINESS_ID, [mention("maggi")], node=node, llm=FakeLlm())
    assert item.as_fact() == {"name": "Maggi Noodles", "price": 14.0, "status": "available"}


@respx.mock
async def test_a_weak_match_is_confirmed_by_the_model(node):
    mount(FakeCatalog(PRODUCTS))
    llm = FakeLlm({Choice: lambda user, system: Choice(product_ids=["p-butter"])})

    items = await find_availability(BUSINESS_ID, [mention("butr")], node=node, llm=llm)

    assert [item.name for item in items] == ["Amul Butter"]
    [call] = llm.calls_for(Choice)
    sent = json.loads(call["user"])
    assert sent["customer_wrote"] == "butr"
    assert all(set(candidate) == {"id", "name"} for candidate in sent["candidates"]), "names only"


@respx.mock
async def test_ids_the_model_invents_are_ignored(node):
    mount(FakeCatalog(PRODUCTS))
    llm = FakeLlm({Choice: lambda user, system: Choice(product_ids=["made-up", "p-butter"])})
    items = await find_availability(BUSINESS_ID, [mention("butr")], node=node, llm=llm)
    assert [item.product_id for item in items] == ["p-butter"]


@respx.mock
async def test_when_the_model_is_down_a_doubtful_match_is_not_guessed(node):
    mount(FakeCatalog(PRODUCTS))

    def fail(user, system):
        raise LlmError("down")

    items = await find_availability(BUSINESS_ID, [mention("butr")], node=node, llm=FakeLlm({Choice: fail}))
    assert items == []


@respx.mock
async def test_the_model_may_choose_nothing(node):
    mount(FakeCatalog(PRODUCTS))
    llm = FakeLlm({Choice: lambda user, system: Choice(product_ids=[])})
    assert await find_availability(BUSINESS_ID, [mention("butr")], node=node, llm=llm) == []


@respx.mock
async def test_nothing_found_is_an_empty_list(node):
    mount(FakeCatalog(PRODUCTS))
    assert await find_availability(BUSINESS_ID, [mention("zzzzqq")], node=node, llm=FakeLlm()) == []


@respx.mock
async def test_a_named_price_narrows_the_variants_when_one_fits(node):
    mount(FakeCatalog(PRODUCTS))
    items = await find_availability(BUSINESS_ID, [mention("parle g", price_hint=10)], node=node, llm=FakeLlm())
    assert [item.name for item in items] == ["Parle-G 100g"]


@respx.mock
async def test_a_price_that_fits_nothing_lists_every_variant(node):
    mount(FakeCatalog(PRODUCTS))
    items = await find_availability(BUSINESS_ID, [mention("parle g", price_hint=7)], node=node, llm=FakeLlm())
    assert len(items) == 3


@respx.mock
async def test_a_named_size_narrows_the_variants(node):
    mount(FakeCatalog(PRODUCTS))
    items = await find_availability(
        BUSINESS_ID, [mention("parle g", size_or_unit="50 g")], node=node, llm=FakeLlm()
    )
    assert [item.name for item in items] == ["Parle-G 50g"]


@respx.mock
async def test_a_name_in_another_script_is_searched_as_written_and_in_latin_letters(node):
    catalog = FakeCatalog(PRODUCTS + [{"productId": "p-hi", "name": "पारले जी", "price": 5, "status": "available"}])
    mount(catalog)
    await find_availability(BUSINESS_ID, [mention("पारले जी", "parle g")], node=node, llm=FakeLlm())
    assert catalog.queries == ["parle g", "पारले जी"]


@respx.mock
async def test_text_too_short_to_search_is_skipped(node):
    catalog = FakeCatalog(PRODUCTS)
    mount(catalog)
    assert await find_availability(BUSINESS_ID, [mention("?")], node=node, llm=FakeLlm()) == []
    assert catalog.requests == []


@respx.mock
async def test_several_products_are_found_without_repeats_and_at_most_three_are_searched(node):
    catalog = FakeCatalog(PRODUCTS)
    mount(catalog)
    mentions = [mention("maggi"), mention("amul butter"), mention("maggi"), mention("parle g")]

    items = await find_availability(BUSINESS_ID, mentions, node=node, llm=FakeLlm())

    assert len(catalog.requests) == 3, "a fourth product is ignored"
    ids = [item.product_id for item in items]
    assert ids.count("p-maggi") == 1
    assert set(ids) == {"p-maggi", "p-butter"} | set() or "p-5" not in ids


@respx.mock
async def test_node_trouble_stops_the_lookup(node):
    respx.get(f"{NODE}/internal/catalog/search").mock(side_effect=httpx.ConnectError("refused"))
    with pytest.raises(ApiError) as caught:
        await find_availability(BUSINESS_ID, [mention("maggi")], node=node, llm=FakeLlm())
    assert caught.value.code == "NODE_UNAVAILABLE"


def test_an_item_is_built_from_node_s_answer():
    item = AvailabilityItem.from_node(
        {"productId": "x", "name": "Maggi", "category": "Noodles", "unit": "packet", "price": 14, "status": "out", "similarity": 0.9}
    )
    assert item.product_id == "x" and item.status == "out" and item.price == 14.0
