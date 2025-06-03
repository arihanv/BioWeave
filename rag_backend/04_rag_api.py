"""
FastAPI wrapper for BioWeave RAG system
Exposes endpoints that allow the React Native frontend to query the RAG system
"""

import os
import pickle
import logging
import numpy as np
import faiss
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
MODEL_NAME = 'all-MiniLM-L6-v2'
GEMINI_MODEL_NAME = 'gemini-2.0-flash'

# Initialize FastAPI app
app = FastAPI(title="BioWeave RAG API", 
              description="API endpoints for the BioWeave health RAG system",
              version="1.0.0")

# Add CORS middleware to allow requests from your React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# --- Data models for API requests and responses ---
class QueryRequest(BaseModel):
    query: str
    top_k: int = 3

class ChunkInfo(BaseModel):
    text: str
    source: str
    score: float

class QueryResponse(BaseModel):
    query: str
    chunks: list[ChunkInfo]
    answer: str
    error: str = None

# --- Load API key ---
def load_api_key():
    """Loads Google API key from .env file or environment variables."""
    load_dotenv()
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logging.warning("GOOGLE_API_KEY not found in .env or environment variables.")
        return None
    return api_key

# --- Load retrieval components ---
@app.on_event("startup")
async def startup_db_client():
    """Load the retrieval components when the API starts."""
    try:
        # Load the FAISS index
        app.state.index = faiss.read_index(FAISS_INDEX_PATH)
        logging.info(f"FAISS index loaded. Total vectors: {app.state.index.ntotal}")
        
        # Load the text chunks
        with open(TEXT_CHUNKS_PATH, 'rb') as f:
            app.state.chunk_data = pickle.load(f)
        logging.info(f"Text chunks loaded. Total chunks: {len(app.state.chunk_data)}")
        
        # Load sentence transformer model
        app.state.model = SentenceTransformer(MODEL_NAME)
        logging.info(f"Model {MODEL_NAME} loaded successfully.")
        
        # Load API key and configure Gemini
        app.state.api_key = load_api_key()
        if app.state.api_key:
            genai.configure(api_key=app.state.api_key)
            logging.info("Gemini API configured successfully.")
        else:
            logging.warning("Gemini API not configured due to missing API key.")
            
    except Exception as e:
        logging.error(f"Error during startup: {e}")
        # We don't raise an exception here to allow the API to start
        # even if components fail to load

# --- Helper functions ---
def search_similar_chunks(index, chunk_data, query_embedding, top_k=3):
    """Search for similar chunks using FAISS index."""
    logging.info(f"Searching for top {top_k} chunks similar to query")
    D, I = index.search(query_embedding, top_k)
    
    results = []
    if I.size == 0:
        logging.warning("FAISS search returned no indices.")
        return results
        
    for i, idx_val in enumerate(I[0]):
        dist = D[0][i]
        if not isinstance(idx_val, (int, np.integer)):
            logging.error(f"Skipping result {i}: idx_val ({idx_val}) is not an integer scalar, type: {type(idx_val)}.")
            continue
        if idx_val < 0 or idx_val >= len(chunk_data):
            logging.warning(f"Retrieved idx_val {idx_val} is out of bounds for chunk_data (size {len(chunk_data)}). Skipping.")
            continue
            
        retrieved_chunk = chunk_data[idx_val]
        results.append({
            'text': retrieved_chunk.get('text', 'Error: Text not found in chunk_data dictionary') if isinstance(retrieved_chunk, dict) else 'Error: retrieved_chunk is not a dict',
            'source': retrieved_chunk.get('source', 'Error: Source not found in chunk_data dictionary') if isinstance(retrieved_chunk, dict) else 'Error: retrieved_chunk is not a dict',
            'score': float(dist)
        })
        logging.info(f"Retrieved chunk {idx_val} from '{results[-1]['source']}' (Score: {dist})")
        
    return results

def generate_gemini_answer(api_key, query, context_chunks):
    """Generate an answer using Gemini API."""
    if not api_key:
        return "Error: No API key provided for Gemini."
    
    try:
        # Prepare context with source attribution
        context_parts = []
        for i, chunk in enumerate(context_chunks):
            context_parts.append(f"DOCUMENT {i+1} (Source: {chunk['source']}):\n{chunk['text']}")
        
        context_str = "\n\n" + "\n\n".join(context_parts)
        
        # Create prompt
        prompt = f"Based ONLY on the following documents, answer the question as accurately as possible. If the answer is not contained in the documents, say so clearly.\n\n{context_str}\n\nQuestion: {query}\n\nAnswer (be specific and include percentages or statistics if available):"
        
        # Generate response
        logging.info(f"Sending prompt to Gemini (model: {GEMINI_MODEL_NAME})...")
        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = model.generate_content(prompt)
        logging.info("Answer generated successfully by Gemini.")
        
        return response.text
    except Exception as e:
        error_msg = f"Error during Gemini API call: {str(e)}"
        logging.error(error_msg)
        return f"Error: An exception occurred while communicating with the Gemini API: {str(e)}"

# --- API Endpoints ---
@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "message": "BioWeave RAG API is running"}

@app.post("/query", response_model=QueryResponse)
async def query_rag(query_request: QueryRequest, background_tasks: BackgroundTasks):
    """Main endpoint to query the RAG system."""
    query = query_request.query
    top_k = query_request.top_k
    
    try:
        # Check if we have the necessary components loaded
        if not hasattr(app.state, "model") or not hasattr(app.state, "index") or not hasattr(app.state, "chunk_data"):
            raise HTTPException(status_code=500, detail="RAG components not properly loaded")
            
        # Generate embeddings
        query_embedding = app.state.model.encode([query])
        
        # Get similar chunks
        similar_chunks = search_similar_chunks(app.state.index, app.state.chunk_data, query_embedding, top_k)
        
        # Generate answer if API key is available
        answer = "No API key configured for answer generation."
        if app.state.api_key and similar_chunks:
            answer = generate_gemini_answer(app.state.api_key, query, similar_chunks)
        
        # Create response
        response = QueryResponse(
            query=query,
            chunks=[ChunkInfo(text=c["text"], source=c["source"], score=c["score"]) for c in similar_chunks],
            answer=answer
        )
        
        # Log query in background (doesn't block response)
        background_tasks.add_task(logging.info, f"Processed query: '{query}' with {len(similar_chunks)} chunks retrieved")
        
        return response
        
    except Exception as e:
        logging.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

@app.get("/status")
async def check_status():
    """Check the status and health of the RAG system."""
    status = {
        "index_loaded": hasattr(app.state, "index"),
        "chunks_loaded": hasattr(app.state, "chunk_data"),
        "model_loaded": hasattr(app.state, "model"),
        "gemini_configured": hasattr(app.state, "api_key") and app.state.api_key is not None,
        "chunks_count": len(app.state.chunk_data) if hasattr(app.state, "chunk_data") else 0,
        "vectors_count": app.state.index.ntotal if hasattr(app.state, "index") else 0
    }
    return status

if __name__ == "__main__":
    # Run the FastAPI server when the script is executed directly
    uvicorn.run(app, host="0.0.0.0", port=8001)
