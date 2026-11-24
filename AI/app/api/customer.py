from fastapi import APIRouter, Depends, Request

from app.agents.customer.graph import answer_customer
from app.agents.customer.schemas import CustomerQueryRequest, CustomerQueryResponse
from app.security import ServiceContext, require_service_token

router = APIRouter(prefix="/internal", dependencies=[Depends(require_service_token)])


@router.post("/customer-query", response_model=CustomerQueryResponse, response_model_by_alias=True)
async def customer_query(
    body: CustomerQueryRequest,
    request: Request,
    context: ServiceContext = Depends(require_service_token),
) -> CustomerQueryResponse:
    """A customer's WhatsApp message in, a reply out. Nothing about the message is stored or logged."""
    result = await answer_customer(
        request.app.state.customer_graph,
        business_id=context.business_id,
        message=body.message,
        shop_name=body.shop_name,
    )
    return CustomerQueryResponse(**result)
