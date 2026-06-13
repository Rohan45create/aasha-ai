from fastapi import APIRouter, Depends, HTTPException, Query
import structlog
import json
from vertexai.generative_models import GenerativeModel, Tool
from middleware.auth_middleware import verify_firebase_token
from services import redis_service

logger = structlog.get_logger()
router = APIRouter(prefix="/api/disease", tags=["Disease Research"])

@router.get("/research")
async def get_disease_research(query: str = Query(...), decoded_token: dict = Depends(verify_firebase_token)):
    """Fetch recent government guidelines & disease studies using Gemini with Google Search Grounding"""
    try:
        # 1. Check Redis Cache
        cache_key = f"disease_research:{query.lower().replace(' ', '_')}"
        cached_result = await redis_service.redis_client.get(cache_key)
        
        if cached_result:
            logger.info("disease_research_cache_hit", query=query)
            return json.loads(cached_result)
            
        logger.info("disease_research_cache_miss", query=query)
        
        # 2. Use Gemini with Grounded Search
        google_search_tool = Tool.from_google_search_retrieval(google_search_retrieval={})
        model = GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are a medical research assistant for an ASHA worker in India.
        Research the following query specifically looking for official government guidelines, WHO recommendations, 
        or recent health studies relevant to rural India.
        
        Query: {query}
        
        Provide a concise response formatted with clear headings, bullet points, and specific actions the ASHA worker can take.
        Keep it simple, actionable, and state any recent outbreaks or alerts if relevant.
        """
        
        response = model.generate_content(
            prompt,
            tools=[google_search_tool]
        )
        
        result_text = response.text
        
        response_data = {
            "query": query,
            "research_summary": result_text,
            "source": "Grounded AI Search"
        }
        
        # 3. Cache for 24 hours
        await redis_service.redis_client.setex(cache_key, 86400, json.dumps(response_data))
        
        return response_data
        
    except Exception as e:
        logger.error("disease_research_failed", error=str(e), query=query)
        raise HTTPException(status_code=500, detail="Failed to fetch research data")
