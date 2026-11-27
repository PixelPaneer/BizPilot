"""Node -> AI endpoint for owner dashboard insights and business questions."""

from fastapi import APIRouter, Depends, Request

from app.agents.insights.schemas import InsightsRequest, InsightsResponse
from app.security import ServiceContext, require_service_token

router = APIRouter(prefix="/internal", dependencies=[Depends(require_service_token)])


@router.post("/insights/ask", response_model=InsightsResponse)
async def ask_insights(
    body: InsightsRequest,
    request: Request,
    context: ServiceContext = Depends(require_service_token),
) -> InsightsResponse:
    return await request.app.state.insights_agent.run(
        body,
        business_id=context.business_id,
    )
