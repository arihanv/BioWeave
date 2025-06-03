import os
import glob
import pickle
import logging
import faiss # Assuming this now imports correctly
from sentence_transformers import SentenceTransformer # Assuming this now imports correctly

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', force=True)
logging.info("--- Logging configured successfully ---")

# --- Configuration ---
KNOWLEDGE_BASE_DIR = "knowledge_base"
MODEL_NAME = 'all-MiniLM-L6-v2' # A good starting model
FAISS_INDEX_FILE = "faiss_index.idx"
TEXT_CHUNKS_FILE = "text_chunks.pkl"
# ---------------------

def load_documents(kb_dir):
    """Loads all .txt documents from the specified directory."""
    docs = []
    doc_paths = []
    search_path = os.path.join(kb_dir, "*.txt")
    for filepath in glob.glob(search_path):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                docs.append(f.read())
                doc_paths.append(filepath)
                logging.info(f"Successfully loaded: {filepath}")
        except Exception as e:
            logging.error(f"Error loading file {filepath}: {e}")
    return docs, doc_paths

def chunk_text(text, separator="\n\n"):
    """Splits text into chunks based on a separator."""
    logging.debug(f"chunk_text received text (first 500 chars): {text[:500]}")
    print(f"--- chunk_text: Received text (first 100 chars): '{text[:100].replace('\n', '\\n')}' ---", flush=True)
    
    raw_chunks = text.split(separator)
    logging.debug(f"chunk_text produced {len(raw_chunks)} raw_chunks.")
    print(f"--- chunk_text: Number of raw_chunks after split by '{separator.replace('\n', '\\n')}': {len(raw_chunks)} ---", flush=True)
    
    # For more detailed debugging of raw chunks:
    # for i, r_chunk in enumerate(raw_chunks):
    #     print(f"--- chunk_text: Raw chunk {i}: '{r_chunk.replace('\n', '\\n')[:100]}' (len: {len(r_chunk)}) ---", flush=True)

    processed_chunks = []
    for i, chunk in enumerate(raw_chunks):
        stripped_chunk = chunk.strip()
        # print(f"--- chunk_text: Raw chunk {i} (stripped): '{stripped_chunk.replace('\n', '\\n')[:100]}' (len: {len(stripped_chunk)}), Keep: {bool(stripped_chunk)} ---", flush=True)
        if stripped_chunk:
            processed_chunks.append(stripped_chunk)
        # else:
            # print(f"--- chunk_text: Discarding raw chunk {i} because it's empty after strip. Original: '{chunk.replace('\n', '\\n')[:100]}' ---", flush=True)
            
    logging.debug(f"chunk_text returning {len(processed_chunks)} processed_chunks.")
    print(f"--- chunk_text: Number of processed_chunks to be returned: {len(processed_chunks)} ---", flush=True)
    return processed_chunks

def main():
    logging.info("Starting to build vector store...")

    # Ensure knowledge_base directory exists
    if not os.path.isdir(KNOWLEDGE_BASE_DIR):
        logging.error(f"Knowledge base directory '{KNOWLEDGE_BASE_DIR}' not found. Please create it and add documents.")
        return

    # 1. Load documents
    documents, doc_paths = load_documents(KNOWLEDGE_BASE_DIR)
    if not documents:
        logging.warning("No documents found in the knowledge base directory. Exiting.")
        return

    # 2. Create chunks from documents
    all_text_chunks = []
    chunk_to_doc_mapping = [] # To store (chunk_index, doc_path, original_chunk_index_in_doc)
    current_chunk_global_idx = 0

    for i, doc_content in enumerate(documents):
        doc_path = doc_paths[i]
        logging.info(f"Processing document: {doc_path}")
        chunks_from_doc = chunk_text(doc_content)
        if not chunks_from_doc:
            logging.warning(f"No text chunks extracted from {doc_path}. Skipping.")
            continue
        
        all_text_chunks.extend(chunks_from_doc)
        for local_chunk_idx, chunk in enumerate(chunks_from_doc):
            chunk_to_doc_mapping.append({
                "global_idx": current_chunk_global_idx,
                "source": doc_path, # Use 'source' as the key for the document identifier
                "doc_chunk_idx": local_chunk_idx,
                "text": chunk
            })
            current_chunk_global_idx += 1
        logging.info(f"Extracted {len(chunks_from_doc)} chunks from {doc_path}.")

    if not all_text_chunks:
        logging.warning("No text chunks were extracted from any documents. Exiting.")
        return
    
    logging.info(f"Total text chunks extracted: {len(all_text_chunks)}")

    # 3. Generate embeddings
    logging.info(f"Loading sentence transformer model: {MODEL_NAME}")
    try:
        model = SentenceTransformer(MODEL_NAME)
        logging.info(f"SentenceTransformer model {MODEL_NAME} loaded successfully.")
    except Exception as e:
        logging.error(f"Failed to load SentenceTransformer model '{MODEL_NAME}'. Error: {e}")
        logging.error("Please ensure the model name is correct and you have an internet connection if it needs to be downloaded.")
        logging.error("You might need to install sentence-transformers: pip install sentence-transformers")
        return
        
    logging.info("Generating embeddings for text chunks... This may take a while.")
    try:
        embeddings = model.encode(all_text_chunks, show_progress_bar=True)
    except Exception as e:
        logging.error(f"Error during embedding generation: {e}")
        return
    
    logging.info(f"Embeddings generated. Shape: {embeddings.shape}")

    # 4. Build FAISS index
    dimension = embeddings.shape[1] # Get embedding dimension from the model output
    index = faiss.IndexFlatL2(dimension) # Using L2 distance for similarity
    index.add(embeddings)
    logging.info(f"FAISS index built. Total vectors in index: {index.ntotal}")

    # 5. Save index and chunks
    try:
        faiss.write_index(index, FAISS_INDEX_FILE)
        logging.info(f"FAISS index saved to: {FAISS_INDEX_FILE}")
    except Exception as e:
        logging.error(f"Error saving FAISS index: {e}")
        return

    try:
        # Save the chunk_to_doc_mapping instead of just all_text_chunks for better context later
        with open(TEXT_CHUNKS_FILE, 'wb') as f:
            pickle.dump(chunk_to_doc_mapping, f)
        logging.info(f"Text chunks (with mapping) saved to: {TEXT_CHUNKS_FILE}")
    except Exception as e:
        logging.error(f"Error saving text chunks: {e}")
        return

    logging.info("Vector store built successfully!")

if __name__ == "__main__":
    logging.info("--- Running main() ---")
    main()
    logging.info("--- main() finished ---")
