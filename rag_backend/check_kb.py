import pickle
import os

print("Checking knowledge base contents...")

# Load text chunks
if os.path.exists('text_chunks.pkl'):
    with open('text_chunks.pkl', 'rb') as f:
        chunks = pickle.load(f)
    
    print(f"Total chunks in knowledge base: {len(chunks)}")
    
    # Group by category
    categories = {}
    for chunk in chunks:
        cat = chunk.get('category', 'Unknown')
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += 1
    
    # Print categories
    print("\nChunks by category:")
    for cat, count in categories.items():
        print(f"  {cat}: {count} chunks")
else:
    print("No text chunks found")

# Check FAISS index
if os.path.exists('faiss_index.idx'):
    import faiss
    index = faiss.read_index('faiss_index.idx')
    print(f"\nFAISS index contains {index.ntotal} vectors")
else:
    print("\nNo FAISS index found")
