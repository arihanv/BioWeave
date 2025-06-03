from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging
import os
import pickle
import faiss
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from dotenv import load_dotenv
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
MODEL_NAME = 'all-MiniLM-L6-v2'
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
GEMINI_MODEL_NAME = 'gemini-2.0-flash' # Or your preferred Gemini model

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

def generate_answer_api(query: str, context_chunks: list[dict]):
    if not GOOGLE_API_KEY:
        logging.warning("Gemini API key not available. Skipping answer generation.")
        return "Error: Gemini API key not configured. Cannot generate answer."
    
    if not context_chunks:
        logging.warning("No context chunks provided to Gemini. Answer might be generic.")
        # Decide if you want to query Gemini without context or return a specific message
        # For now, let's try to answer based on the query alone if no context

    context_parts = []
    for i, chunk in enumerate(context_chunks):
        context_parts.append(f"DOCUMENT {i+1} (Source: {chunk['source']}):\n{chunk['text']}")
    
    context_str = "\n\n" + "\n\n".join(context_parts)
    
    prompt = f"Based ONLY on the following documents, answer the question as accurately as possible. If the answer is not contained in the documents, say so clearly. If no documents are provided, answer based on general knowledge if possible, but state that no specific documents were consulted.\n\n{context_str if context_chunks else 'No specific documents provided.'}\n\nQuestion: {query}\n\nAnswer (be specific and include percentages or statistics if available):"
    
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

@app.get("/health")
async def health_check():
    if retriever_model and faiss_index and text_chunks_data:
        return {"status": "healthy", "message": "RAG models loaded."}
    else:
        return {"status": "unhealthy", "message": "RAG models not loaded."}

# To run this API locally:
# uvicorn rag_api:app --reload
