import os
import argparse
import logging
from sentence_transformers import SentenceTransformer
import pickle
import faiss
import PyPDF2
from typing import List, Dict, Any

# Configure logging with more detail
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('document_processing.log')
    ]
)

# Constants
MODEL_NAME = 'all-MiniLM-L6-v2'
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
EMBEDDING_DIM = 384  # Dimension of the all-MiniLM-L6-v2 embeddings

# Valid categories
CATEGORIES = [
    'Cardiovascular',
    'General Vitals & Body Composition',
    'Movement',
    'Nutrition',
    'Respiratory'
]

def load_existing_data():
    """Load existing chunks and FAISS index if they exist."""
    chunks = []
    index = None
    
    if os.path.exists(TEXT_CHUNKS_PATH):
        logging.info(f"Loading existing chunks from {TEXT_CHUNKS_PATH}")
        with open(TEXT_CHUNKS_PATH, 'rb') as f:
            chunks = pickle.load(f)
        logging.info(f"Loaded {len(chunks)} existing chunks")
    else:
        logging.info(f"No existing chunks file found at {TEXT_CHUNKS_PATH}")
    
    if os.path.exists(FAISS_INDEX_PATH):
        logging.info(f"Loading existing FAISS index from {FAISS_INDEX_PATH}")
        index = faiss.read_index(FAISS_INDEX_PATH)
        logging.info(f"FAISS index loaded with {index.ntotal} vectors")
    else:
        logging.info(f"Creating new FAISS index")
        index = faiss.IndexFlatL2(EMBEDDING_DIM)
    
    return chunks, index

def save_data(chunks, index):
    """Save chunks and FAISS index to disk."""
    logging.info(f"Saving {len(chunks)} chunks to {TEXT_CHUNKS_PATH}")
    with open(TEXT_CHUNKS_PATH, 'wb') as f:
        pickle.dump(chunks, f)
    
    logging.info(f"Saving FAISS index with {index.ntotal} vectors to {FAISS_INDEX_PATH}")
    faiss.write_index(index, FAISS_INDEX_PATH)
    logging.info("Data saved successfully")

def chunk_text(text: str, max_chunk_size: int = 1000, overlap: int = 100) -> List[str]:
    """Split text into overlapping chunks."""
    chunks = []
    if len(text) <= max_chunk_size:
        chunks.append(text)
    else:
        for i in range(0, len(text), max_chunk_size - overlap):
            chunk = text[i:i + max_chunk_size]
            if len(chunk) < 100:  # Skip very small chunks at the end
                continue
            chunks.append(chunk)
    return chunks

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file with detailed logging."""
    text = ""
    try:
        logging.info(f"Opening PDF: {file_path}")
        with open(file_path, 'rb') as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            page_count = len(pdf_reader.pages)
            logging.info(f"PDF has {page_count} pages")
            
            for page_num in range(page_count):
                try:
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n\n"
                        logging.info(f"Extracted text from page {page_num+1} ({len(page_text)} characters)")
                    else:
                        logging.warning(f"No text extracted from page {page_num+1}")
                except Exception as e:
                    logging.error(f"Error extracting text from page {page_num+1}: {e}")
            
        logging.info(f"Finished PDF extraction, got {len(text)} characters")
        return text
    except Exception as e:
        logging.error(f"Error processing PDF {file_path}: {e}")
        return ""

def process_file(file_path: str, category: str) -> List[Dict[str, Any]]:
    """Process a single file with detailed progress reports."""
    logging.info(f"Processing file: {file_path}")
    
    text = ""
    # Handle different file types
    if file_path.lower().endswith('.pdf'):
        text = extract_text_from_pdf(file_path)
    else:  # Handle as text file
        try:
            logging.info(f"Opening text file: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            logging.info(f"Read {len(text)} characters from text file")
        except UnicodeDecodeError:
            # Try with a different encoding if UTF-8 fails
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    text = f.read()
                logging.info(f"Read {len(text)} characters from text file with latin-1 encoding")
            except Exception as enc_error:
                logging.error(f"Error reading file with alternate encoding: {enc_error}")
                return []
    
    if not text or len(text.strip()) < 50:  # Very short or empty text
        logging.warning(f"File {file_path} has insufficient text content")
        return []
    
    # Chunk the text
    logging.info("Chunking text...")
    text_chunks = chunk_text(text)
    logging.info(f"Created {len(text_chunks)} chunks")
    
    processed_chunks = []
    for i, chunk in enumerate(text_chunks):
        processed_chunks.append({
            'text': chunk,
            'source': file_path,
            'category': category
        })
        
    logging.info(f"Processed {len(processed_chunks)} chunks from {file_path}")
    return processed_chunks

def main():
    parser = argparse.ArgumentParser(description="Process documents from a category folder and add them to the RAG system")
    parser.add_argument("--source_dir", required=True, help="The source directory containing the category folders")
    parser.add_argument("--category", required=True, choices=CATEGORIES, help="The category to process")
    
    args = parser.parse_args()
    category_path = os.path.join(args.source_dir, args.category)
    
    if not os.path.exists(category_path):
        logging.error(f"Category path does not exist: {category_path}")
        return
    
    # Load the model for embeddings
    logging.info(f"Loading sentence transformer model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    logging.info("Model loaded successfully")
    
    # Load existing data
    chunks, index = load_existing_data()
    original_chunk_count = len(chunks)
    
    # Process all files in the category
    files = [f for f in os.listdir(category_path) if os.path.isfile(os.path.join(category_path, f))]
    logging.info(f"Found {len(files)} files in {args.category} category")
    
    if not files:
        logging.warning(f"No files found in {category_path}")
        return
        
    new_chunks = []
    for file_name in files:
        file_path = os.path.join(category_path, file_name)
        logging.info(f"Processing file {file_name}...")
        processed_chunks = process_file(file_path, args.category)
        new_chunks.extend(processed_chunks)
        logging.info(f"Added {len(processed_chunks)} chunks from {file_name}")
        
    # Generate and add embeddings
    if new_chunks:
        logging.info(f"Generating embeddings for {len(new_chunks)} new chunks...")
        new_texts = [chunk['text'] for chunk in new_chunks]
        
        # Process embeddings in smaller batches if there are many chunks
        batch_size = 32
        all_embeddings = []
        
        for i in range(0, len(new_texts), batch_size):
            batch = new_texts[i:i + batch_size]
            logging.info(f"Embedding batch {i//batch_size + 1}/{(len(new_texts)-1)//batch_size + 1} ({len(batch)} chunks)")
            batch_embeddings = model.encode(batch)
            all_embeddings.append(batch_embeddings)
            
        # Combine embeddings
        import numpy as np
        embeddings = np.vstack(all_embeddings)
        
        logging.info(f"Adding {embeddings.shape[0]} vectors to FAISS index")
        index.add(embeddings)
        
        # Add to chunks list
        chunks.extend(new_chunks)
        
        logging.info(f"Added {len(new_chunks)} chunks to the system")
        logging.info(f"Total chunks: {len(chunks)} (was {original_chunk_count})")
        
        # Save updated data
        save_data(chunks, index)
    else:
        logging.info("No new chunks were added")
        
    logging.info(f"Finished processing {args.category} category")

if __name__ == "__main__":
    main()
