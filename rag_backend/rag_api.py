from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import logging
import pickle
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
MODEL_NAME = 'all-MiniLM-L6-v2'
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
GEMINI_MODEL_NAME = 'gemini-2.0-flash' # Or your preferred Gemini model

# --- Categories ---
CATEGORIES = [
    'Cardiovascular',
    'General Vitals & Body Composition',
    'Movement',
    'Nutrition',
    'Respiratory'
]

# --- Load API Key (from .env) ---
load_dotenv()
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

if not GOOGLE_API_KEY:
    logging.warning("GOOGLE_API_KEY not found in .env file or environment variables. Gemini functionality will be disabled.")
else:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
    except Exception as e:
        logging.error(f"Error configuring Gemini API: {e}")
        GOOGLE_API_KEY = None # Disable Gemini if configuration fails

# --- Global variables for models and data (loaded once at startup) ---
retriever_model = None
faiss_index = None
text_chunks_data = None

app = FastAPI(
    title="BioWeave RAG API",
    description="API for the BioWeave Retrieval Augmented Generation system.",
    version="0.1.0"
)

# --- Pydantic Models for Request and Response ---
class QueryRequest(BaseModel):
    query: str
    top_k: int = 3

class ChunkSource(BaseModel):
    source: str
    score: float
    text: str

class QueryResponse(BaseModel):
    answer: str
    retrieved_chunks: list[ChunkSource]
    error: str | None = None

class CategoryResponse(BaseModel):
    category: str
    confidence: float

class OrchestratorResponse(BaseModel):
    answer: str
    category: str
    confidence: float

# --- Helper Functions (adapted from 02_query_vector_store.py) ---
def load_models_and_data():
    global retriever_model, faiss_index, text_chunks_data
    try:
        logging.info(f"Loading sentence transformer model: {MODEL_NAME}")
        retriever_model = SentenceTransformer(MODEL_NAME)
        logging.info("Sentence transformer model loaded.")

        logging.info(f"Loading FAISS index from {FAISS_INDEX_PATH}")
        faiss_index = faiss.read_index(FAISS_INDEX_PATH)
        logging.info("FAISS index loaded.")

        logging.info(f"Loading text chunks from {TEXT_CHUNKS_PATH}")
        with open(TEXT_CHUNKS_PATH, 'rb') as f:
            text_chunks_data = pickle.load(f)
        logging.info("Text chunks loaded.")
        
        logging.info("All models and data loaded successfully.")
        return True
    except Exception as e:
        logging.error(f"Error loading models or data: {e}")
        return False

def search_similar_chunks_api(index, chunk_data, query_embedding, top_k=3):
    logging.info(f"API: Inside search_similar_chunks. query_embedding.shape: {query_embedding.shape}, top_k: {top_k}")
    D, I = index.search(query_embedding.astype(np.float32), top_k) # Ensure float32 for FAISS
    logging.info(f"API: FAISS search returned. D.shape: {D.shape}, I.shape: {I.shape}")
    results = []
    if I.size == 0 or I[0].size == 0:
        logging.warning("API: FAISS search returned no indices.")
        return results

    for i, idx_val in enumerate(I[0]):
        dist = D[0][i]
        if not isinstance(idx_val, (int, np.integer)):
            logging.error(f"API: Skipping result {i}: idx_val ({idx_val}) is not an integer scalar, type: {type(idx_val)}.")
            continue
        if idx_val < 0 or idx_val >= len(chunk_data):
            logging.warning(f"API: Retrieved idx_val {idx_val} is out of bounds for chunk_data (size {len(chunk_data)}). Skipping.")
            continue
        retrieved_chunk = chunk_data[idx_val]
        results.append({
            'text': retrieved_chunk.get('text', 'Error: Text not found'),
            'source': retrieved_chunk.get('source', 'Error: Source not found'),
            'score': float(dist) # Ensure score is float for JSON serialization
        })
        logging.info(f"API: Retrieved chunk {idx_val} from '{results[-1]['source']}': '{results[-1]['text'][:100]}...' (Score: {dist})")
    return results

def classify_query(query: str) -> tuple[str, float]:
    """Classify a health query into one of the predefined categories.
    
    Args:
        query: The user's health question
        
    Returns:
        tuple[str, float]: The predicted category and confidence score
    """
    if not GOOGLE_API_KEY:
        logging.warning("Gemini API key not available for category classification.")
        return "General Vitals & Body Composition", 0.5  # Default with low confidence
    
    # Use Gemini to classify the query
    prompt = f"""Classify the following health question into EXACTLY ONE of these categories:
    - Cardiovascular (heart, blood pressure, cholesterol, circulation)
    - General Vitals & Body Composition (overall health, weight, BMI, body fat, height)
    - Movement (exercise, physical activity, steps, workouts, movement tracking)
    - Nutrition (diet, food, calories, nutrients, eating habits)
    - Respiratory (breathing, lungs, oxygen, respiratory conditions)
    
    Respond with ONLY the category name and a confidence score from 0.0 to 1.0, formatted exactly like this: "Category|0.95"
    
    Question: {query}
    """
    
    try:
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(prompt)
        result = response.text.strip()
        
        # Parse category and confidence
        if "|" in result:
            category, confidence_str = result.split("|", 1)
            category = category.strip()
            try:
                confidence = float(confidence_str.strip())
            except ValueError:
                confidence = 0.7  # Default if parsing fails
        else:
            # If format is wrong, use the best match from the response
            for cat in CATEGORIES:
                if cat.lower() in result.lower():
                    category = cat
                    confidence = 0.7
                    break
            else:
                category = "General Vitals & Body Composition"  # Default category
                confidence = 0.5
        
        # Ensure category is valid
        if category not in CATEGORIES:
            closest = next((c for c in CATEGORIES if c.lower() in category.lower()), None)
            if closest:
                category = closest
            else:
                category = "General Vitals & Body Composition"  # Default
                confidence = 0.5
                
        logging.info(f"Classified query '{query}' as '{category}' with confidence {confidence}")
        return category, confidence
        
    except Exception as e:
        logging.error(f"Error classifying query: {e}")
        return "General Vitals & Body Composition", 0.5  # Default with low confidence

def generate_answer_api(query: str, context_chunks: list[dict]):
    if not GOOGLE_API_KEY:
        logging.warning("Gemini API key not available. Skipping answer generation.")
        return "Error: Gemini API key not configured. Cannot generate answer."
    
    if not context_chunks:
        logging.warning("No context chunks provided to Gemini. Answer might be generic.")

    context_parts = []
    for i, chunk in enumerate(context_chunks):
        # Don't number or label the chunks, just include their text
        context_parts.append(chunk['text'])
    
    context_str = "\n\n" + "\n\n".join(context_parts)
    
    # More conversational prompt that doesn't explicitly instruct to mention documents
    prompt = f"""You are BioWeave, a helpful health assistant. Use the following information to answer the question accurately and naturally.
    
    Information: {context_str if context_chunks else 'No specific information available on this topic.'}
    
    Question: {query}
    
    Answer the question in a helpful, conversational way. If you don't have enough information to provide a good answer, acknowledge that. Don't mention that you're using specific documents or references - just provide the information as if you knew it."""
    
    logging.info(f"API: Sending prompt to Gemini (model: {GEMINI_MODEL_NAME})...")
    try:
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(prompt)
        logging.info("API: Answer generated successfully by Gemini.")
        return response.text
    except Exception as e:
        logging.error(f"API: Error during Gemini API call: {e}")
        return f"Error: An exception occurred while communicating with the Gemini API: {e}"

# --- FastAPI event handlers ---
@app.on_event("startup")
async def startup_event():
    if not load_models_and_data():
        logging.critical("Failed to load RAG models and data. API might not function correctly.")
        # Optionally, you could raise an exception here to prevent startup if models are critical
    else:
        logging.info("RAG API started successfully with models loaded.")

# --- API Endpoints ---

@app.post("/test")
async def test_endpoint(request: QueryRequest):
    """Simple test endpoint that just echoes the query back."""
    try:
        return {"text": f"You asked: {request.query}"}
    except Exception as e:
        return {"text": f"Error: {str(e)}"}
        
@app.post("/plaintext")
async def plaintext_query(request: QueryRequest):
    """Return plain text response (not JSON) for easier consumption"""
    from fastapi.responses import PlainTextResponse
    try:
        # 1. Embed the query
        query_embedding = retriever_model.encode([request.query])
        
        # 2. Search for similar chunks
        similar_chunks_data = search_similar_chunks_api(
            faiss_index, 
            text_chunks_data, 
            query_embedding, 
            top_k=request.top_k
        )
        
        # 3. Generate answer using Gemini
        ai_answer = generate_answer_api(request.query, similar_chunks_data)
        
        # Return just plain text
        return PlainTextResponse(content=ai_answer)
    except Exception as e:
        return PlainTextResponse(content=f"Error: {str(e)}")

@app.post("/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    if not retriever_model or not faiss_index or not text_chunks_data:
        logging.error("RAG models/data not loaded. Cannot process query.")
        raise HTTPException(status_code=503, detail="Service Unavailable: RAG models are not loaded.")

    try:
        logging.info(f"Received query: '{request.query}' with top_k={request.top_k}")
        
        # 1. Embed the query
        query_embedding = retriever_model.encode([request.query])
        logging.info(f"Query embedding generated. Shape: {query_embedding.shape}")
        
        # 2. Search for similar chunks
        similar_chunks_data = search_similar_chunks_api(
            faiss_index, 
            text_chunks_data, 
            query_embedding, 
            top_k=request.top_k
        )
        
        retrieved_for_response = [
            ChunkSource(source=ch['source'], score=ch['score'], text=ch['text']) 
            for ch in similar_chunks_data
        ]

        # 3. Generate answer using Gemini
        ai_answer = generate_answer_api(request.query, similar_chunks_data)
        
        return QueryResponse(answer=ai_answer, retrieved_chunks=retrieved_for_response)
        
    except Exception as e:
        logging.error(f"Error processing query '{request.query}': {e}")
        # Return a QueryResponse with the error message
        return QueryResponse(
            answer=f"An internal error occurred: {e}", 
            retrieved_chunks=[], 
            error=str(e)
        )

# Simple endpoint that returns only the answer text
class SimpleResponse(BaseModel):
    text: str

@app.post("/query_simple")
async def query_rag_simple(request: QueryRequest):
    if not retriever_model or not faiss_index or not text_chunks_data:
        logging.error("RAG models/data not loaded. Cannot process query.")
        raise HTTPException(status_code=503, detail="Service Unavailable: RAG models are not loaded.")

    try:
        logging.info(f"Received simple query: '{request.query}' with top_k={request.top_k}")
        
        try:
            # 1. Embed the query
            query_embedding = retriever_model.encode([request.query])
            logging.debug(f"Query embedding shape: {query_embedding.shape}")
        except Exception as e:
            logging.error(f"Error embedding query: {e}")
            return {"text": f"Error embedding query: {str(e)}"}
        
        try:
            # 2. Search for similar chunks
            similar_chunks_data = search_similar_chunks_api(
                faiss_index, 
                text_chunks_data, 
                query_embedding, 
                top_k=request.top_k
            )
            logging.debug(f"Found {len(similar_chunks_data)} similar chunks")
        except Exception as e:
            logging.error(f"Error searching for similar chunks: {e}")
            return {"text": f"Error searching for similar chunks: {str(e)}"}
        
        try:
            # 3. Generate answer using Gemini
            ai_answer = generate_answer_api(request.query, similar_chunks_data)
            logging.debug(f"Generated answer of length {len(ai_answer if ai_answer else '')}")
        except Exception as e:
            logging.error(f"Error generating answer: {e}")
            return {"text": f"Error generating answer: {str(e)}"}
        
        # Return just the text answer
        return {"text": ai_answer}
        
    except Exception as e:
        logging.error(f"Error processing simple query '{request.query}': {e}")
        # Return just the error message
        return {"text": f"An error occurred: {str(e)}"}

@app.get("/health")
async def health_check():
    if retriever_model and faiss_index and text_chunks_data:
        return {"status": "healthy", "message": "RAG models loaded."}
    else:
        return {"status": "unhealthy", "message": "RAG models not loaded."}

# --- Orchestrator and Specialized Agent Endpoints ---

@app.post("/classify", response_model=CategoryResponse)
async def classify_query_endpoint(request: QueryRequest):
    """Classify a health query into the appropriate category"""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured. Classification unavailable.")
    
    category, confidence = classify_query(request.query)
    return CategoryResponse(category=category, confidence=confidence)

@app.post("/orchestrator", response_model=OrchestratorResponse)
async def orchestrator_endpoint(request: QueryRequest):
    """Orchestrator endpoint that classifies and routes queries to specialized agents"""
    if not retriever_model or not faiss_index or not text_chunks_data:
        raise HTTPException(status_code=503, detail="Service Unavailable: RAG models are not loaded.")
    
    try:
        # 1. Classify the query to determine which agent should handle it
        category, confidence = classify_query(request.query)
        
        # 2. Get embeddings for the query
        query_embedding = retriever_model.encode([request.query])
        
        # 3. Search for similar chunks across all categories first
        all_chunks = search_similar_chunks_api(
            faiss_index, 
            text_chunks_data, 
            query_embedding, 
            top_k=request.top_k * 3  # Get more chunks initially to allow for filtering
        )
        
        # 4. Filter chunks by the predicted category, if possible
        filtered_chunks = [chunk for chunk in all_chunks if chunk.get('category', '') == category]
        
        # If we don't have enough relevant chunks in the category, supplement with general chunks
        if len(filtered_chunks) < request.top_k and all_chunks:
            remaining_needed = request.top_k - len(filtered_chunks)
            general_chunks = [c for c in all_chunks if c.get('category', '') != category]
            filtered_chunks.extend(general_chunks[:remaining_needed])
        
        # If we still don't have enough chunks, just use what we have
        chunks_to_use = filtered_chunks[:request.top_k] if filtered_chunks else all_chunks[:request.top_k]
        
        # 5. Generate answer using the filtered chunks
        answer = generate_answer_api(request.query, chunks_to_use)
        
        return OrchestratorResponse(answer=answer, category=category, confidence=confidence)
    
    except Exception as e:
        logging.error(f"Error in orchestrator endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/agent/{category}", response_model=QueryResponse)
async def specialized_agent_endpoint(request: QueryRequest, category: str):
    """Specialized agent endpoint that handles queries for a specific health category"""
    if not retriever_model or not faiss_index or not text_chunks_data:
        raise HTTPException(status_code=503, detail="Service Unavailable: RAG models are not loaded.")
    
    # Validate category
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(CATEGORIES)}")
    
    try:
        # 1. Get embeddings for the query
        query_embedding = retriever_model.encode([request.query])
        
        # 2. Search for similar chunks across all categories first
        all_chunks = search_similar_chunks_api(
            faiss_index, 
            text_chunks_data, 
            query_embedding, 
            top_k=request.top_k * 3  # Get more chunks initially
        )
        
        # 3. Filter chunks by the specified category
        category_chunks = [chunk for chunk in all_chunks if chunk.get('category', '') == category]
        
        # If we don't have enough chunks in this category, use whatever we have
        if len(category_chunks) < request.top_k and all_chunks:
            remaining_needed = request.top_k - len(category_chunks)
            other_chunks = [c for c in all_chunks if c.get('category', '') != category]
            category_chunks.extend(other_chunks[:remaining_needed])
        
        # Use what we have, up to top_k
        chunks_to_use = category_chunks[:request.top_k] if category_chunks else all_chunks[:request.top_k]
        
        # 4. Generate answer
        answer = generate_answer_api(request.query, chunks_to_use)
        
        # Format for response
        retrieved_for_response = [
            ChunkSource(source=ch['source'], score=ch['score'], text=ch['text']) 
            for ch in chunks_to_use
        ]
        
        return QueryResponse(answer=answer, retrieved_chunks=retrieved_for_response)
    
    except Exception as e:
        logging.error(f"Error in specialized agent endpoint: {e}")
        return QueryResponse(answer=f"An error occurred: {str(e)}", retrieved_chunks=[], error=str(e))

# To run this API locally:
# uvicorn rag_api:app --reload
