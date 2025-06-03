"""
DSPy-powered RAG for BioWeave
This script builds on the basic RAG system but uses DSPy for more advanced retrieval and generation.
"""

import os
import pickle
import logging
import numpy as np
import faiss
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
import dspy

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
KNOWLEDGE_BASE_DIR = 'knowledge_base'
MODEL_NAME = 'all-MiniLM-L6-v2'  # Sentence transformer model
GEMINI_MODEL_NAME = 'gemini-2.0-flash'

# --- Helper to load API key ---
def load_api_key():
    """Loads Google API key from .env file or environment variables."""
    load_dotenv()
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logging.warning("GOOGLE_API_KEY not found in .env or environment variables.")
        print("\nWARNING: GOOGLE_API_KEY not found. Generation will be skipped.")
        print("Please create a .env file with GOOGLE_API_KEY=your_key")
        return None
    return api_key

def load_retrieval_tools():
    """Loads the FAISS index and text chunks for retrieval."""
    try:
        # Load the FAISS index
        logging.info(f"Loading FAISS index from {FAISS_INDEX_PATH}")
        index = faiss.read_index(FAISS_INDEX_PATH)
        
        # Load the text chunks with pickle
        logging.info(f"Loading text chunks from {TEXT_CHUNKS_PATH}")
        with open(TEXT_CHUNKS_PATH, 'rb') as f:
            chunk_data = pickle.load(f)
        
        logging.info(f"Text chunks loaded. Total chunks: {len(chunk_data)}")
        
        # Load sentence transformer model
        logging.info(f"Loading sentence transformer model: {MODEL_NAME}")
        model = SentenceTransformer(MODEL_NAME)
        
        return model, index, chunk_data
    except Exception as e:
        logging.error(f"Error loading retrieval tools: {e}")
        return None, None, None

# Initialize DSPy with Gemini
def initialize_dspy(api_key):
    """Initialize DSPy with Google's Gemini model."""
    # Configure the LM
    gemini_config = {
        "api_key": api_key,
        "model": GEMINI_MODEL_NAME
    }
    
    lm = dspy.GoogleGenerativeAI(**gemini_config)
    dspy.settings.configure(lm=lm)
    logging.info(f"DSPy initialized with {GEMINI_MODEL_NAME}")
    return lm

# Define RAG modules with DSPy
class HealthQueryRAG(dspy.Module):
    """DSPy module for health query retrieval and generation."""
    
    def __init__(self, retriever_model, index, chunk_data):
        super().__init__()
        self.retriever_model = retriever_model
        self.index = index
        self.chunk_data = chunk_data
        
        # Define the generation component
        self.generate = dspy.ChainOfThought("query -> response")
    
    def retrieve(self, query, top_k=3):
        """Retrieve relevant chunks using FAISS."""
        query_embedding = self.retriever_model.encode([query])
        D, I = self.index.search(query_embedding, top_k)
        
        results = []
        for i, idx_val in enumerate(I[0]):
            dist = D[0][i]
            if idx_val < 0 or idx_val >= len(self.chunk_data):
                continue
                
            retrieved_chunk = self.chunk_data[idx_val]
            results.append({
                'text': retrieved_chunk.get('text', ''),
                'source': retrieved_chunk.get('source', ''),
                'score': float(dist)
            })
            
        return results
    
    def forward(self, query):
        """Process a query using retrieve-then-read approach."""
        # First retrieve relevant chunks
        chunks = self.retrieve(query)
        
        # Format context for the generator
        context = []
        for i, chunk in enumerate(chunks):
            context.append(f"DOCUMENT {i+1} (Source: {chunk['source']}): {chunk['text']}")
        
        context_str = "\n\n".join(context)
        
        # Generate a response
        response = self.generate(
            query=query,
            context=f"Based ONLY on the following documents, answer the question as accurately as possible. "
                   f"If the answer is not contained in the documents, say so clearly.\n\n{context_str}"
        )
        
        # Return both the retrieved chunks and the generated response
        return {
            "query": query,
            "chunks": chunks,
            "response": response.response,
            "thinking": response.rationale if hasattr(response, 'rationale') else ""
        }

def main():
    logging.info("--- DSPy RAG Script Started ---")
    
    # Load API key and initialize components
    api_key = load_api_key()
    if not api_key:
        logging.error("API key required for DSPy. Exiting.")
        return
    
    lm = initialize_dspy(api_key)
    retriever_model, index, chunk_data = load_retrieval_tools()
    
    if not all([retriever_model, index, chunk_data]):
        logging.error("Failed to load necessary retrieval components. Exiting.")
        return
    
    # Initialize the RAG module
    rag = HealthQueryRAG(retriever_model, index, chunk_data)
    
    while True:
        try:
            query = input("Enter your health query (or type 'exit' to quit): ")
            if query.lower() == 'exit':
                break
            if not query.strip():
                print("Please enter a valid query.")
                continue
            
            # Process the query
            result = rag(query)
            
            # Display the results
            print("\n--- Top Relevant Chunks ---")
            for i, chunk in enumerate(result["chunks"]):
                print(f"\n{i+1}. Source: {chunk['source']} (Score: {chunk['score']:.4f})")
                print(f"   Text: {chunk['text']}")
            print("\n---------------------------")
            
            print("\n--- AI Generated Answer ---")
            print(result["response"])
            print("\n---------------------------")
            
            if result.get("thinking"):
                print("\n--- AI Reasoning Process ---")
                print(result["thinking"])
                print("\n---------------------------")
            
        except KeyboardInterrupt:
            print("\nExiting due to user interrupt.")
            break
        except Exception as e:
            logging.error(f"An error occurred during query processing: {e}")
            print("An unexpected error occurred. Please check logs.")
    
    logging.info("--- DSPy RAG Script Finished ---")

if __name__ == "__main__":
    main()
