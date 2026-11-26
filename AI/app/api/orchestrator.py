"""HTTP route for routing a WhatsApp message through BizPilot agents."""

from fastapi import APIRouter, Depends, Request

from app.agents.orchestrator.schemas import OrchestrateRequest, OrchestrateResponse
from app.security import ServiceContext, require_service_token

router = APIRouter(prefix="/internal", dependencies=[Depends(require_service_token)])


@router.post("/orchestrate", response_model=OrchestrateResponse, response_model_by_alias=True)
async def orchestrate(
    body: OrchestrateRequest,
    request: Request,
    context: ServiceContext = Depends(require_service_token),
) -> OrchestrateResponse:
    result = await request.app.state.orchestrator(
        business_id=context.business_id,
        message=body.message,
        sender_role=body.sender_role,
        shop_name=body.shop_name,
    )
    return OrchestrateResponse(**result)
