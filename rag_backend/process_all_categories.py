import os
import sys
from sentence_transformers import SentenceTransformer
import pickle
import faiss
import logging
import PyPDF2
import numpy as np

# Configure logging to both console and file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
    ]
)

# Constants
MODEL_NAME = 'all-MiniLM-L6-v2'
EMBEDDING_DIM = 384  # Dimension of the all-MiniLM-L6-v2 embeddings
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100

# Document source directory
DOCS_SOURCE_DIR = r"C:\Users\madhu\Downloads\BioWeave RAG Docs-20250606T033155Z-1-001\BioWeave RAG Docs"

# Categories
CATEGORIES = [
    'Cardiovascular',
    'General Vitals & Body Composition',
    'Movement',
    'Nutrition',
    'Respiratory'
]

def extract_text_from_pdf(file_path):
    """Extract text content from a PDF file."""
    print(f"  Processing PDF: {os.path.basename(file_path)}")
    try:
        with open(file_path, 'rb') as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            page_count = len(pdf_reader.pages)
            print(f"    PDF has {page_count} pages")
            
            text = ""
            for page_num in range(page_count):
                try:
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    text += page_text + "\n\n"
                except Exception as e:
                    print(f"    Error on page {page_num+1}: {e}")
            
            print(f"    Extracted {len(text)} characters")
            return text
    except Exception as e:
        print(f"    Failed to process PDF: {e}")
        return ""

def extract_text(file_path):
    """Extract text from various file types."""
    if file_path.lower().endswith('.pdf'):
        return extract_text_from_pdf(file_path)
    else:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            return text
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    text = f.read()
                return text
            except Exception:
                print(f"  Failed to read {file_path}")
                return ""

def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Split text into overlapping chunks."""
    chunks = []
    if len(text) <= chunk_size:
        chunks.append(text)
    else:
        for i in range(0, len(text), chunk_size - overlap):
            chunk = text[i:i + chunk_size]
            if len(chunk) < 100:  # Skip very small chunks at the end
                continue
            chunks.append(chunk)
    return chunks

def load_data():
    """Load existing chunks and FAISS index."""
    chunks = []
    if os.path.exists(TEXT_CHUNKS_PATH):
        print(f"Loading existing chunks from {TEXT_CHUNKS_PATH}")
        with open(TEXT_CHUNKS_PATH, 'rb') as f:
            chunks = pickle.load(f)
        print(f"Loaded {len(chunks)} existing chunks")
    
    index = None
    if os.path.exists(FAISS_INDEX_PATH):
        print(f"Loading existing FAISS index from {FAISS_INDEX_PATH}")
        index = faiss.read_index(FAISS_INDEX_PATH)
        print(f"Index has {index.ntotal} vectors")
    else:
        print("Creating new FAISS index")
        index = faiss.IndexFlatL2(EMBEDDING_DIM)
    
    return chunks, index

def save_data(chunks, index):
    """Save data to disk."""
    print(f"Saving {len(chunks)} chunks to {TEXT_CHUNKS_PATH}")
    with open(TEXT_CHUNKS_PATH, 'wb') as f:
        pickle.dump(chunks, f)
    
    print(f"Saving FAISS index with {index.ntotal} vectors to {FAISS_INDEX_PATH}")
    faiss.write_index(index, FAISS_INDEX_PATH)

def process_category(category, model, chunks, index):
    """Process all files in a category."""
    category_dir = os.path.join(DOCS_SOURCE_DIR, category)
    if not os.path.exists(category_dir):
        print(f"Category directory not found: {category_dir}")
        return chunks, index
    
    print(f"\nProcessing category: {category}")
    
    # Get all files in the directory
    files = [f for f in os.listdir(category_dir) if os.path.isfile(os.path.join(category_dir, f))]
    print(f"Found {len(files)} files")
    
    if not files:
        return chunks, index
    
    new_chunks = []
    for file_name in files:
        file_path = os.path.join(category_dir, file_name)
        print(f"\nProcessing file: {file_name}")
        
        # Extract text from the file
        text = extract_text(file_path)
        if not text or len(text) < 100:
            print(f"  Insufficient text extracted from {file_name}")
            continue
        
        # Chunk the text
        text_chunks = chunk_text(text)
        print(f"  Created {len(text_chunks)} chunks")
        
        # Add metadata to chunks
        for chunk in text_chunks:
            new_chunks.append({
                'text': chunk,
                'source': file_path,
                'category': category
            })
    
    if not new_chunks:
        print("  No chunks created for this category")
        return chunks, index
    
    print(f"\nGenerating embeddings for {len(new_chunks)} new chunks")
    new_texts = [chunk['text'] for chunk in new_chunks]
    
    # Process in batches to avoid memory issues
    batch_size = 32
    all_embeddings = []
    
    for i in range(0, len(new_texts), batch_size):
        batch = new_texts[i:i + batch_size]
        batch_end = min(i + batch_size, len(new_texts))
        print(f"  Embedding batch {i//batch_size + 1}/{(len(new_texts)-1)//batch_size + 1} ({i}-{batch_end})")
        batch_embeddings = model.encode(batch)
        all_embeddings.append(batch_embeddings)
    
    if all_embeddings:
        embeddings = np.vstack(all_embeddings)
        print(f"  Adding {embeddings.shape[0]} vectors to FAISS index")
        index.add(embeddings)
        
        # Add new chunks to the collection
        chunks.extend(new_chunks)
        print(f"  Added {len(new_chunks)} chunks to knowledge base")
    
    return chunks, index

def main():
    print("\n=== BioWeave Document Processing Script ===\n")
    
    # Check if source directory exists
    if not os.path.exists(DOCS_SOURCE_DIR):
        print(f"Source directory not found: {DOCS_SOURCE_DIR}")
        return
    
    # Load the sentence transformer model
    print(f"Loading sentence transformer model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    print("Model loaded successfully")
    
    # Load existing data
    chunks, index = load_data()
    initial_chunk_count = len(chunks)
    
    # Process each category
    for category in CATEGORIES:
        chunks, index = process_category(category, model, chunks, index)
    
    # Save the updated data
    if len(chunks) > initial_chunk_count:
        print(f"\nAdded {len(chunks) - initial_chunk_count} new chunks to knowledge base")
        save_data(chunks, index)
        print("\nKnowledge base updated successfully!")
    else:
        print("\nNo new chunks were added")
    
    # Print summary
    print("\n=== Knowledge Base Summary ===")
    category_counts = {}
    for chunk in chunks:
        cat = chunk.get('category', 'Unknown')
        if cat not in category_counts:
            category_counts[cat] = 0
        category_counts[cat] += 1
    
    print(f"Total chunks: {len(chunks)}")
    print("Chunks by category:")
    for cat, count in category_counts.items():
        print(f"  {cat}: {count}")
    
    print(f"FAISS index vectors: {index.ntotal}")
    print("\nProcessing complete!")

if __name__ == "__main__":
    main()
