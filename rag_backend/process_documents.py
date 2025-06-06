import os
import pickle
import faiss
import logging
import argparse
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any
import PyPDF2  # For PDF processing

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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
    
    if os.path.exists(FAISS_INDEX_PATH):
        logging.info(f"Loading existing FAISS index from {FAISS_INDEX_PATH}")
        index = faiss.read_index(FAISS_INDEX_PATH)
    else:
        logging.info(f"Creating new FAISS index")
        index = faiss.IndexFlatL2(EMBEDDING_DIM)
    
    return chunks, index

def save_data(chunks, index):
    """Save chunks and FAISS index to disk."""
    logging.info(f"Saving {len(chunks)} chunks to {TEXT_CHUNKS_PATH}")
    with open(TEXT_CHUNKS_PATH, 'wb') as f:
        pickle.dump(chunks, f)
    
    logging.info(f"Saving FAISS index to {FAISS_INDEX_PATH}")
    faiss.write_index(index, FAISS_INDEX_PATH)

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

def process_document(file_path: str, category: str, model) -> List[Dict[str, Any]]:
    """Process a single document file."""
    logging.info(f"Processing {file_path} in category {category}")
    
    text = ""
    try:
        # Handle different file types
        if file_path.lower().endswith('.pdf'):
            try:
                with open(file_path, 'rb') as pdf_file:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                    text = ""
                    for page_num in range(len(pdf_reader.pages)):
                        page = pdf_reader.pages[page_num]
                        text += page.extract_text() + "\n\n"
                logging.info(f"Successfully extracted {len(pdf_reader.pages)} pages from PDF")
            except Exception as pdf_error:
                logging.error(f"Error processing PDF {file_path}: {pdf_error}")
                return []
        else:  # Handle as text file
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
            except UnicodeDecodeError:
                # Try with a different encoding if UTF-8 fails
                try:
                    with open(file_path, 'r', encoding='latin-1') as f:
                        text = f.read()
                    logging.info(f"Opened {file_path} with latin-1 encoding")
                except Exception as enc_error:
                    logging.error(f"Error reading file with alternate encoding: {enc_error}")
                    return []
            except Exception as e:
                logging.error(f"Error reading {file_path}: {e}")
                return []
    
    except Exception as e:
        logging.error(f"General error processing {file_path}: {e}")
        return []
        
    if not text or len(text.strip()) < 50:  # Very short or empty text
        logging.warning(f"File {file_path} has insufficient text content")
        return []
    
    text_chunks = chunk_text(text)
    processed_chunks = []
    
    for chunk in text_chunks:
        processed_chunks.append({
            'text': chunk,
            'source': file_path,
            'category': category
        })
    
    logging.info(f"Created {len(processed_chunks)} chunks from {file_path}")
    return processed_chunks

def main():
    parser = argparse.ArgumentParser(description="Process documents into chunks and add them to the RAG system")
    parser.add_argument("--file", "-f", type=str, help="Path to a single file to process")
    parser.add_argument("--directory", "-d", type=str, help="Path to directory containing documents to process")
    parser.add_argument("--category", "-c", type=str, required=True, choices=CATEGORIES, 
                        help="Category for the document(s)")
    
    args = parser.parse_args()
    
    if not args.file and not args.directory:
        parser.error("Either --file or --directory must be specified")
    
    # Load the model for embeddings
    logging.info(f"Loading sentence transformer model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    
    # Load existing data
    chunks, index = load_existing_data()
    original_chunk_count = len(chunks)
    
    new_chunks = []
    
    # Process individual file
    if args.file:
        if not os.path.exists(args.file):
            logging.error(f"File not found: {args.file}")
            return
        new_chunks.extend(process_document(args.file, args.category, model))
    
    # Process directory
    if args.directory:
        if not os.path.exists(args.directory):
            logging.error(f"Directory not found: {args.directory}")
            return
        
        for filename in os.listdir(args.directory):
            file_path = os.path.join(args.directory, filename)
            if os.path.isfile(file_path) and file_path.lower().endswith(('.txt', '.md', '.pdf')):
                new_chunks.extend(process_document(file_path, args.category, model))
    
    # Generate and add embeddings
    if new_chunks:
        logging.info(f"Generating embeddings for {len(new_chunks)} new chunks")
        new_texts = [chunk['text'] for chunk in new_chunks]
        embeddings = model.encode(new_texts)
        
        # Add to FAISS index
        index.add(embeddings)
        
        # Add to chunks list
        chunks.extend(new_chunks)
        
        logging.info(f"Added {len(new_chunks)} chunks to the system")
        logging.info(f"Total chunks: {len(chunks)} (was {original_chunk_count})")
        
        # Save updated data
        save_data(chunks, index)
    else:
        logging.info("No new chunks were added")

if __name__ == "__main__":
    main()
