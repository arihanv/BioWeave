import os
import pickle
import faiss
import logging
import argparse
import PyPDF2
import numpy as np
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants
MODEL_NAME = 'all-MiniLM-L6-v2'
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
EMBEDDING_DIM = 384  # Dimension for all-MiniLM-L6-v2 embeddings
DOCS_DIR = r"C:\Users\madhu\Downloads\BioWeave RAG Docs-20250606T033155Z-1-001\BioWeave RAG Docs"

# Categories
CATEGORIES = [
    'Cardiovascular',
    'General Vitals & Body Composition',
    'Movement',
    'Nutrition',
    'Respiratory'
]

def load_data():
    """Load existing chunks and FAISS index."""
    chunks = []
    if os.path.exists(TEXT_CHUNKS_PATH):
        logging.info(f"Loading existing chunks from {TEXT_CHUNKS_PATH}")
        with open(TEXT_CHUNKS_PATH, 'rb') as f:
            chunks = pickle.load(f)
        logging.info(f"Loaded {len(chunks)} existing chunks")
    
    index = None
    if os.path.exists(FAISS_INDEX_PATH):
        logging.info(f"Loading existing FAISS index from {FAISS_INDEX_PATH}")
        index = faiss.read_index(FAISS_INDEX_PATH)
        logging.info(f"Index contains {index.ntotal} vectors")
    else:
        logging.info("Creating new FAISS index")
        index = faiss.IndexFlatL2(EMBEDDING_DIM)
    
    return chunks, index

def save_data(chunks, index):
    """Save chunks and index to disk."""
    logging.info(f"Saving {len(chunks)} chunks to {TEXT_CHUNKS_PATH}")
    with open(TEXT_CHUNKS_PATH, 'wb') as f:
        pickle.dump(chunks, f)
    
    logging.info(f"Saving FAISS index with {index.ntotal} vectors to {FAISS_INDEX_PATH}")
    faiss.write_index(index, FAISS_INDEX_PATH)
    logging.info("Data saved successfully")

def extract_pdf_text(file_path):
    """Extract text from a PDF file."""
    logging.info(f"Extracting text from PDF: {os.path.basename(file_path)}")
    try:
        with open(file_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            text = ""
            for i, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text() or ""
                text += page_text + "\n\n"
            
            logging.info(f"Extracted {len(text)} characters from PDF with {len(pdf_reader.pages)} pages")
            return text
    except Exception as e:
        logging.error(f"Error extracting PDF text: {e}")
        return ""

def extract_text_from_file(file_path):
    """Extract text from either PDF or text file."""
    if file_path.lower().endswith('.pdf'):
        return extract_pdf_text(file_path)
    else:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            logging.info(f"Read {len(text)} characters from text file: {os.path.basename(file_path)}")
            return text
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    text = f.read()
                logging.info(f"Read {len(text)} characters with latin-1 encoding: {os.path.basename(file_path)}")
                return text
            except Exception as e:
                logging.error(f"Error reading file: {e}")
                return ""

def chunk_text(text, max_chunk_size=1000, overlap=100):
    """Split text into overlapping chunks."""
    if not text:
        return []
        
    chunks = []
    if len(text) <= max_chunk_size:
        chunks.append(text)
    else:
        for i in range(0, len(text), max_chunk_size - overlap):
            chunk = text[i:i + max_chunk_size]
            if len(chunk) < 100:  # Skip very small chunks
                continue
            chunks.append(chunk)
    return chunks

def process_category(category, model):
    """Process all files in a category."""
    category_dir = os.path.join(DOCS_DIR, category)
    if not os.path.exists(category_dir):
        logging.error(f"Category directory not found: {category_dir}")
        return False
    
    logging.info(f"Processing category: {category}")
    
    # Get all files in this category
    files = [f for f in os.listdir(category_dir) if os.path.isfile(os.path.join(category_dir, f))]
    if not files:
        logging.info(f"No files found in {category}")
        return False
        
    logging.info(f"Found {len(files)} files in {category}")
    
    # Load existing data
    chunks, index = load_data()
    original_count = len(chunks)
    
    # Process each file
    all_new_chunks = []
    for filename in files:
        filepath = os.path.join(category_dir, filename)
        logging.info(f"Processing file: {filename}")
        
        # Extract text
        text = extract_text_from_file(filepath)
        if not text or len(text) < 200:
            logging.warning(f"Insufficient text extracted from {filename}")
            continue
        
        # Split into chunks
        text_chunks = chunk_text(text)
        logging.info(f"Created {len(text_chunks)} chunks from {filename}")
        
        # Add metadata
        for chunk in text_chunks:
            all_new_chunks.append({
                'text': chunk,
                'source': filepath, 
                'category': category
            })
    
    if not all_new_chunks:
        logging.info(f"No new content extracted from {category}")
        return False
    
    # Generate embeddings
    logging.info(f"Generating embeddings for {len(all_new_chunks)} chunks")
    texts = [chunk['text'] for chunk in all_new_chunks]
    
    # Process in smaller batches
    batch_size = 32
    embeddings_list = []
    
    for i in range(0, len(texts), batch_size):
        end_idx = min(i + batch_size, len(texts))
        batch = texts[i:end_idx]
        logging.info(f"Embedding batch {i//batch_size + 1}/{(len(texts)-1)//batch_size + 1}")
        batch_embeddings = model.encode(batch)
        embeddings_list.append(batch_embeddings)
    
    if not embeddings_list:
        logging.warning("No embeddings generated")
        return False
        
    # Combine all embeddings and add to index
    embeddings = np.vstack(embeddings_list)
    logging.info(f"Adding {embeddings.shape[0]} vectors to index")
    index.add(embeddings)
    
    # Add chunks to list
    chunks.extend(all_new_chunks)
    logging.info(f"Added {len(all_new_chunks)} new chunks (total now: {len(chunks)})")
    
    # Save updated data
    save_data(chunks, index)
    
    logging.info(f"Successfully processed {category}")
    return True

def main():
    parser = argparse.ArgumentParser(description="Process documents for BioWeave RAG system")
    parser.add_argument("--all", action="store_true", help="Process all categories")
    parser.add_argument("--category", help="Process specific category")
    args = parser.parse_args()
    
    # Load embedding model
    logging.info(f"Loading SentenceTransformer model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    logging.info("Model loaded")
    
    if args.all:
        logging.info("Processing all categories")
        results = {}
        for category in CATEGORIES:
            logging.info(f"===== Starting {category} =====")
            result = process_category(category, model)
            results[category] = "Success" if result else "No new content"
        
        logging.info("===== Processing Summary =====")
        for cat, res in results.items():
            logging.info(f"{cat}: {res}")
    elif args.category:
        if args.category not in CATEGORIES:
            logging.error(f"Unknown category: {args.category}")
            logging.info(f"Available categories: {', '.join(CATEGORIES)}")
            return
        
        logging.info(f"Processing single category: {args.category}")
        success = process_category(args.category, model)
        if success:
            logging.info(f"Successfully processed {args.category}")
        else:
            logging.warning(f"No new content added for {args.category}")
    else:
        logging.error("Please specify either --all or --category")
        parser.print_help()

if __name__ == "__main__":
    main()
