"""Node (WhatsApp webhook) -> AI: one message in, one reply out, routed to the right agent."""

from fastapi import APIRouter, Depends, Request

from app.agents.orchestrator.graph import orchestrate
from app.agents.orchestrator.schemas import OrchestrateRequest, OrchestrateResponse
from app.security import ServiceContext, require_service_token

router = APIRouter(prefix="/internal", dependencies=[Depends(require_service_token)])


@router.post("/orchestrate", response_model=OrchestrateResponse)
async def orchestrate_message(
    body: OrchestrateRequest,
    request: Request,
    context: ServiceContext = Depends(require_service_token),
) -> OrchestrateResponse:
    result = await orchestrate(
        request.app.state.orchestrator_graph,
        business_id=context.business_id,
        message=body.message,
        sender_role=body.sender_role,
        shop_name=body.shop_name,
    )
    return OrchestrateResponse(**result)