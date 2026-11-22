"""Routes only the Node backend may call. Every one needs a valid service token."""

from fastapi import APIRouter, Depends, Request

from app.security import ServiceContext, require_service_token
from app.shared.logging import log_event

router = APIRouter(prefix="/internal", dependencies=[Depends(require_service_token)])


@router.post("/ping")
async def ping(context: ServiceContext = Depends(require_service_token)) -> dict[str, object]:
    """Foundation check, Node -> AI: the token was accepted, and this is the shop it names."""
    log_event("ping", flow="foundation")
    return {"status": "ok", "businessId": context.business_id}


@router.get("/check-node")
async def check_node(
    request: Request, context: ServiceContext = Depends(require_service_token)
) -> dict[str, object]:
    """Foundation check, AI -> Node: calls Node's /internal/ping with a fresh token for the same
    shop, which proves the shared secret works in both directions."""
    node = await request.app.state.node_client.ping(context.business_id)
    log_event("check_node", flow="foundation")
    return {"status": "ok", "node": node}
