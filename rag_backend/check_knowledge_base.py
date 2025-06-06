import pickle
import os
import faiss

print("\n=== BioWeave Knowledge Base Status ===\n")

# Check if files exist
print(f"text_chunks.pkl exists: {os.path.exists('text_chunks.pkl')}")
print(f"faiss_index.idx exists: {os.path.exists('faiss_index.idx')}")

# Load chunks if they exist
if os.path.exists('text_chunks.pkl'):
    with open('text_chunks.pkl', 'rb') as f:
        chunks = pickle.load(f)
    
    print(f"\nTotal chunks: {len(chunks)}")
    
    # Analyze by category
    categories = {}
    for chunk in chunks:
        category = chunk.get('category', 'Unknown')
        if category not in categories:
            categories[category] = 0
        categories[category] += 1
    
    print("\nChunks by category:")
    for category, count in categories.items():
        print(f"  {category}: {count}")
    
    # Check sample sources
    sources = set()
    for chunk in chunks:
        source = chunk.get('source', 'Unknown')
        sources.add(source)
    
    print(f"\nTotal unique sources: {len(sources)}")
    print("Sample sources:")
    for i, source in enumerate(list(sources)[:5]):
        if source != 'Unknown':
            print(f"  {i+1}. {os.path.basename(source)}")
    
    # Display sample text from first chunk
    if chunks:
        print("\nSample text (first 150 chars of first chunk):")
        print(f"  {chunks[0].get('text', '')[:150]}...")
else:
    print("\nNo chunks found (text_chunks.pkl doesn't exist)")

# Check FAISS index
if os.path.exists('faiss_index.idx'):
    index = faiss.read_index('faiss_index.idx')
    print(f"\nFAISS index contains {index.ntotal} vectors")
else:
    print("\nNo FAISS index found")

print("\n=== End of Report ===")
