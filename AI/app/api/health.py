from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """No token needed: lets Node and the deployment check that the service is up."""
    return {"status": "ok"}
