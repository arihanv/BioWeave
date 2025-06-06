import pickle
import os
from collections import Counter

# Load text chunks
if os.path.exists('text_chunks.pkl'):
    with open('text_chunks.pkl', 'rb') as f:
        chunks = pickle.load(f)
    
    print(f"Total chunks in knowledge base: {len(chunks)}")
    
    # Count by category
    categories = [chunk['category'] for chunk in chunks if 'category' in chunk]
    category_counts = Counter(categories)
    
    print("\nChunks by category:")
    for category, count in category_counts.items():
        print(f"  {category}: {count}")
    
    # Sample content
    if chunks:
        print("\nSample chunk:")
        sample = chunks[0]
        print(f"  Category: {sample.get('category', 'N/A')}")
        print(f"  Source: {sample.get('source', 'N/A')}")
        print(f"  Text length: {len(sample.get('text', ''))}")
        print(f"  Text snippet: {sample.get('text', '')[:150]}...")
else:
    print("No knowledge base found (text_chunks.pkl doesn't exist)")

# Check faiss index
if os.path.exists('faiss_index.idx'):
    import faiss
    index = faiss.read_index('faiss_index.idx')
    print(f"\nFAISS index contains {index.ntotal} vectors")
else:
    print("\nNo FAISS index found")
