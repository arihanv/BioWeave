import faiss
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
import logging
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
MODEL_NAME = 'all-MiniLM-L6-v2'
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
KNOWLEDGE_BASE_DIR = 'knowledge_base' # Used for context if needed, not directly for loading index
GEMINI_MODEL_NAME = 'gemini-2.0-flash' # Updated to match the model working in React Native backend

# --- Helper to load API key ---
def load_api_key():
    """Loads Google API key from .env file or environment variables."""
    load_dotenv() # Load variables from .env file if it exists
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logging.warning("GOOGLE_API_KEY not found in .env or environment variables.")
        print("\nWARNING: GOOGLE_API_KEY not found. Generation will be skipped.")
        print("Please create a .env file in the rag_backend directory with GOOGLE_API_KEY=your_key")
        print("Or set the GOOGLE_API_KEY environment variable.")
        return None
    return api_key

def load_retrieval_tools(model_name, index_path, chunks_path):
    """Loads the sentence transformer model, FAISS index, and text chunks."""
    try:
        logging.info(f"Loading sentence transformer model: {model_name}")
        model = SentenceTransformer(model_name)
        logging.info(f"Model {model_name} loaded successfully.")

        logging.info(f"Loading FAISS index from: {index_path}")
        if not os.path.exists(index_path):
            logging.error(f"FAISS index file not found at {index_path}")
            return None, None, None
        index = faiss.read_index(index_path)
        logging.info(f"FAISS index loaded. Total vectors: {index.ntotal}")

        logging.info(f"Loading text chunks from: {chunks_path}")
        if not os.path.exists(chunks_path):
            logging.error(f"Text chunks file not found at {chunks_path}")
            return None, None, None
        with open(chunks_path, 'rb') as f:
            chunk_data = pickle.load(f)
        # Ensure chunk_data is a list of dicts with 'text' and 'source'
        # Or adapt if it's just a list of texts, and mapping is separate
        # For now, assuming it's the list of dicts as saved by 01_build_vector_store.py
        logging.info(f"Text chunks loaded. Total chunks: {len(chunk_data)}")
        
        return model, index, chunk_data
    except Exception as e:
        logging.error(f"Error loading retrieval tools: {e}")
        return None, None, None

def search_similar_chunks(index, chunk_data, query_embedding, top_k=3):
    """Searches the FAISS index for text chunks similar to the query embedding."""
    if not all([index, chunk_data]):
        logging.error("Search cannot proceed. Index or chunk_data not loaded.")
        return []

    logging.info(f"Inside search_similar_chunks. query_embedding.shape: {query_embedding.shape}, top_k: {top_k}")
    # D is distances, I is indices of neighbors
    D, I = index.search(query_embedding, top_k)
    logging.info(f"FAISS search returned. D.shape: {D.shape}, I.shape: {I.shape}")
    # More detailed logging for D and I values can be very verbose, enable if necessary
    # logging.debug(f"D values: {D}") 
    # logging.debug(f"I values: {I}")

    results = []
    if I.size == 0: # Handle case where search returns no results
        logging.warning("FAISS search returned no indices.")
        return results

    # I[0] because query_embedding is a batch of 1
    for i, idx_val in enumerate(I[0]): # Renamed idx to idx_val for clarity
        logging.debug(f"Processing FAISS result {i}: raw idx_val = {idx_val}, type = {type(idx_val)}")
        dist = D[0][i]
        logging.debug(f"Distance for result {i}: dist = {dist}, type = {type(dist)}")

        # Ensure idx_val is a scalar integer
        if not isinstance(idx_val, (int, np.integer)):
            logging.error(f"Skipping result {i}: idx_val ({idx_val}) is not an integer scalar, type: {type(idx_val)}.")
            continue
        
        # Check bounds
        is_negative = idx_val < 0
        is_too_large = idx_val >= len(chunk_data)
        logging.debug(f"Bounds check for idx_val {idx_val}: < 0 is {is_negative} (type {type(is_negative)}); >= len(chunk_data) ({len(chunk_data)}) is {is_too_large} (type {type(is_too_large)})")

        if is_negative or is_too_large:
            logging.warning(f"Retrieved idx_val {idx_val} is out of bounds for chunk_data (size {len(chunk_data)}). Skipping.")
            continue
        
        retrieved_chunk = chunk_data[idx_val]
        results.append({
            'text': retrieved_chunk.get('text', 'Error: Text not found in chunk_data dictionary') if isinstance(retrieved_chunk, dict) else 'Error: retrieved_chunk is not a dict',
            'source': retrieved_chunk.get('source', 'Error: Source not found in chunk_data dictionary') if isinstance(retrieved_chunk, dict) else 'Error: retrieved_chunk is not a dict',
            'score': dist
        })
        # Cleaned up log, more concise
        logging.info(f"Retrieved chunk {idx_val} from '{results[-1]['source']}': '{results[-1]['text'][:100]}...' (Score: {dist})")
        
    return results

def generate_answer_with_gemini(query, context_chunks, api_key):
    """Generates an answer using Google Gemini based on the query and context."""
    if not api_key:
        logging.error("Cannot generate answer: Google API Key not available.")
        return "Error: Google API Key not configured. Cannot generate answer."
    
    genai.configure(api_key=api_key)
    
    # Prepare the context string with source attribution
    context_parts = []
    for i, chunk in enumerate(context_chunks):
        context_parts.append(f"DOCUMENT {i+1} (Source: {chunk['source']}):\n{chunk['text']}")
    
    context_str = "\n\n" + "\n\n".join(context_parts)
    
    prompt = f"Based ONLY on the following documents, answer the question as accurately as possible. If the answer is not contained in the documents, say so clearly.\n\n{context_str}\n\nQuestion: {query}\n\nAnswer (be specific and include percentages or statistics if available):"
    
    logging.info(f"Sending prompt to Gemini (model: {GEMINI_MODEL_NAME})...")
    # logging.debug(f"Prompt content:\n{prompt}") # Uncomment for debugging prompt

    try:
        gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        response = gemini_model.generate_content(prompt)
        # logging.info(f"Gemini response object: {response}") # For detailed debugging
        
        if response.parts:
            generated_text = "".join(part.text for part in response.parts)
            logging.info("Answer generated successfully by Gemini.")
            return generated_text.strip()
        elif response.prompt_feedback and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            block_message = response.prompt_feedback.block_reason_message if hasattr(response.prompt_feedback, 'block_reason_message') else 'No specific message.'
            logging.error(f"Gemini content generation blocked. Reason: {block_reason}, Message: {block_message}")
            return f"Error: Content generation blocked by API. Reason: {block_reason}. {block_message}"
        else:
            logging.warning("Gemini response did not contain expected parts and no block reason provided.")
            # Try to access text if available directly, common for simpler non-streaming non-blocked responses
            if hasattr(response, 'text') and response.text:
                 logging.info("Found text directly in response object.")
                 return response.text.strip()
            logging.error(f"Unexpected Gemini response structure: {response}")
            return "Error: Failed to generate an answer due to unexpected API response."

    except Exception as e:
        logging.error(f"Error during Gemini API call: {e}")
        return f"Error: An exception occurred while communicating with the Gemini API: {e}"

def main():
    logging.info("--- RAG Query Script Started ---")
    
    google_api_key = load_api_key()
    # If API key is essential for core functionality and not just an add-on, you might exit here.
    # For now, we'll allow retrieval even if generation fails.

    retriever_model, index, chunk_data = load_retrieval_tools(MODEL_NAME, FAISS_INDEX_PATH, TEXT_CHUNKS_PATH)

    if not retriever_model or not index or not chunk_data:
        logging.error("Failed to load necessary retrieval components. Exiting.")
        return

    # Example query
    # query = "What are the main ways to prevent heart disease?"
    # query = "statistics about heart disease"
    
    while True:
        try:
            query = input("Enter your health query (or type 'exit' to quit): ")
            if query.lower() == 'exit':
                break
            if not query.strip():
                print("Please enter a valid query.")
                continue

            query_embedding = retriever_model.encode([query])
            logging.info(f"Query embedding generated. Shape: {query_embedding.shape}")
            similar_chunks = search_similar_chunks(index, chunk_data, query_embedding, top_k=3)

            if similar_chunks:
                print("\n--- Top Relevant Chunks ---")
                for i, chunk_info in enumerate(similar_chunks):
                    print(f"\n{i+1}. Source: {chunk_info['source']} (Score: {chunk_info['score']:.4f})")  
                    # Show the complete text, not just a preview
                    print(f"   Text: {chunk_info['text']}")
                print("\n---------------------------")

                if google_api_key:
                    print("\nGenerating answer with Gemini...")
                    ai_answer = generate_answer_with_gemini(query, similar_chunks, google_api_key)
                    print("\n--- AI Generated Answer ---")
                    print(ai_answer)
                    print("\n---------------------------")
                else:
                    print("\nSkipping AI answer generation as GOOGLE_API_KEY is not configured.")
            else:
                print("No relevant chunks found for your query.")
        except EOFError:
            print("\nExiting due to EOF.")
            break
        except KeyboardInterrupt:
            print("\nExiting due to user interrupt.")
            break
        except Exception as e:
            logging.error(f"An error occurred during query processing: {e}")
            print("An unexpected error occurred. Please check logs.")

    logging.info("--- RAG Query Script Finished ---")

if __name__ == "__main__":
    main()
