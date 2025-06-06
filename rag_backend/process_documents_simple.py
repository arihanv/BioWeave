import os
import sys
import pickle
import faiss
import argparse
import PyPDF2
import numpy as np
from sentence_transformers import SentenceTransformer

# Constants
MODEL_NAME = 'all-MiniLM-L6-v2'
EMBEDDING_DIM = 384
FAISS_INDEX_PATH = 'faiss_index.idx'
TEXT_CHUNKS_PATH = 'text_chunks.pkl'
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100

# Path to document directories
DOCS_DIR = r"C:\Users\madhu\Downloads\BioWeave RAG Docs-20250606T033155Z-1-001\BioWeave RAG Docs"

# Categories
CATEGORIES = [
    'Cardiovascular',
    'General Vitals & Body Composition',
    'Movement',
    'Nutrition',
    'Respiratory'
]

def extract_text_from_pdf(file_path):
    """Extract text from a PDF file."""
    print(f"  Extracting text from PDF: {os.path.basename(file_path)}")
    try:
        with open(file_path, 'rb') as pdf_file:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            text = ""
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n\n"
                    
            print(f"    Extracted {len(text)} characters from PDF")
            return text
    except Exception as e:
        print(f"    Error processing PDF: {str(e)}")
        return ""

def extract_text_from_file(file_path):
    """Extract text from a file (PDF or text)."""
    if file_path.lower().endswith('.pdf'):
        return extract_text_from_pdf(file_path)
    else:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
                print(f"  Read {len(text)} characters from {os.path.basename(file_path)}")
                return text
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    text = f.read()
                    print(f"  Read {len(text)} characters from {os.path.basename(file_path)} using latin-1 encoding")
                    return text
            except Exception as e:
                print(f"  Error reading file: {str(e)}")
                return ""

def chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """Split text into overlapping chunks."""
    chunks = []
    if not text or len(text) < 100:
        return chunks
        
    if len(text) <= chunk_size:
        chunks.append(text)
    else:
        for i in range(0, len(text), chunk_size - overlap):
            chunk = text[i:i + chunk_size]
            if len(chunk) < 100:  # Skip very small chunks at the end
                continue
            chunks.append(chunk)
    return chunks

def load_existing_data():
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
        print(f"Index contains {index.ntotal} vectors")
    else:
        print("Creating new FAISS index")
        index = faiss.IndexFlatL2(EMBEDDING_DIM)
    
    return chunks, index

def save_data(chunks, index):
    """Save chunks and index to disk."""
    print(f"Saving {len(chunks)} chunks to {TEXT_CHUNKS_PATH}")
    with open(TEXT_CHUNKS_PATH, 'wb') as f:
        pickle.dump(chunks, f)
    
    print(f"Saving index with {index.ntotal} vectors to {FAISS_INDEX_PATH}")
    faiss.write_index(index, FAISS_INDEX_PATH)
    print("Data saved successfully")

def process_category(category_name, model):
    """Process all files in a category."""
    print(f"\nProcessing category: {category_name}")
    category_dir = os.path.join(DOCS_DIR, category_name)
    
    if not os.path.exists(category_dir):
        print(f"Category directory not found: {category_dir}")
        return False
    
    # Get list of files
    files = [f for f in os.listdir(category_dir) if os.path.isfile(os.path.join(category_dir, f))]
    print(f"Found {len(files)} files in this category")
    
    if not files:
        print("No files to process in this category")
        return False
    
    # Load existing data
    chunks, index = load_existing_data()
    initial_chunk_count = len(chunks)
    print(f"Initial chunk count: {initial_chunk_count}")
    
    # Process each file
    new_chunks = []
    for file_name in files:
        file_path = os.path.join(category_dir, file_name)
        print(f"\nProcessing file: {file_name}")
        
        # Extract text
        text = extract_text_from_file(file_path)
        if not text or len(text) < 100:
            print(f"  Insufficient text extracted from {file_name}")
            continue
            
        # Chunk the text - using the global function
        text_chunks = chunk_text(text)
        print(f"  Created {len(text_chunks)} chunks")
        
        # Add metadata
        for chunk_text in text_chunks:
            new_chunks.append({
                'text': chunk_text,
                'source': file_path,
                'category': category_name
            })
    
    # Create embeddings and update index
    if new_chunks:
        print(f"\nCreating embeddings for {len(new_chunks)} chunks")
        texts = [chunk['text'] for chunk in new_chunks]
        
        # Process in batches to avoid memory issues
        batch_size = 32
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            end_idx = min(i + batch_size, len(texts))
            print(f"  Processing batch {i//batch_size + 1}/{(len(texts)-1)//batch_size + 1}")
            batch = texts[i:end_idx]
            batch_embeddings = model.encode(batch)
            all_embeddings.append(batch_embeddings)
            
        if all_embeddings:
            embeddings = np.vstack(all_embeddings)
            print(f"Adding {embeddings.shape[0]} vectors to index")
            index.add(embeddings)
            
            # Update chunks list
            chunks.extend(new_chunks)
            print(f"Added {len(new_chunks)} chunks")
            
            # Save updated data
            save_data(chunks, index)
            print(f"Category {category_name} processed successfully")
            return True
    else:
        print("No new chunks were created")
    
    return False

def process_all_categories():
    """Process all categories."""
    print(f"\n=== Processing all document categories ===\n")
    
    # Load model
    print(f"Loading SentenceTransformer model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    print("Model loaded successfully")
    
    results = {}
    for category in CATEGORIES:
        print(f"\n=== Starting processing of {category} ===")
        success = process_category(category, model)
        results[category] = "Success" if success else "Skipped/Failed"
    
    print("\n=== Processing Summary ===")
    for category, result in results.items():
        print(f"{category}: {result}")
    
    print("\nAll processing complete!")

def main():
    parser = argparse.ArgumentParser(description='Process documents for BioWeave RAG system.')
    parser.add_argument('--category', help='Process a specific category only')
    parser.add_argument('--all', action='store_true', help='Process all categories')
    
    args = parser.parse_args()
    
    if args.all:
        process_all_categories()
    elif args.category:
        # Load model
        print(f"\n=== Processing {args.category} documents ===\n")
        print(f"Loading SentenceTransformer model: {MODEL_NAME}")
        model = SentenceTransformer(MODEL_NAME)
        print("Model loaded successfully")
        
        # Process the category
        success = process_category(args.category, model)
        
        if success:
            print(f"\n✅ Successfully processed {args.category} documents")
        else:
            print(f"\n❌ Failed to process {args.category} documents")
    else:
        print("Error: Please specify either --category or --all")
        parser.print_help()

if __name__ == "__main__":
    main()
