# BioWeave RAG Backend

This directory contains the Retrieval-Augmented Generation (RAG) system for BioWeave, which powers the intelligent health assistant's knowledge retrieval capabilities.

## What is this RAG System?

The BioWeave RAG system is a chunked embedding pipeline that:

1. Processes text documents from the knowledge base
2. Chunks them into manageable sizes
3. Generates embeddings (vector representations) of these chunks
4. Stores them in a FAISS vector database
5. Retrieves the most relevant chunks when a user asks a question
6. Uses the Gemini AI model to generate an answer based on these retrieved chunks

This approach ensures that responses are grounded in factual health information rather than just being generated from the AI's training data.

## Quick Start Guide

### Prerequisites

- Python 3.9+ installed
- Git installed
- Google API key for Gemini (for answer generation)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/arihanv/BioWeave.git
   cd BioWeave/rag_backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Create a virtual environment
   python -m venv .venv

   # Activate it (Windows)
   .\.venv\Scripts\activate
   # OR Activate it (macOS/Linux)
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up your environment variables:
   ```bash
   # Create a .env file
   echo GOOGLE_API_KEY=your_google_api_key_here > .env
   ```

### Adding Documents to the Knowledge Base

Place your text documents in the `knowledge_base` directory. The system currently works best with plain text files (.txt).

Examples of good documents include:
- Medical factsheets
- Health guidelines
- Nutrition information
- Disease prevention strategies

### Building the Vector Store

Run the following command to process your documents and create the vector store:

```bash
python 01_build_vector_store.py
```

This script will:
- Load all documents from the `knowledge_base` directory
- Split them into chunks
- Generate embeddings using the 'all-MiniLM-L6-v2' model
- Save the results to `faiss_index.idx` and `text_chunks.pkl`

### Running the RAG API Server

Start the FastAPI server:

```bash
uvicorn rag_api:app --reload
```

This will start the server at `http://localhost:8000` with the following endpoints:
- `/query` - For submitting questions to the RAG system
- `/health` - For checking if the server is running

### Making Queries

You can query the API directly:

```bash
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"What are the best strategies for heart disease prevention?"}'
```

Or use the BioWeave frontend, which is already configured to connect to this backend.

## System Architecture

The RAG system consists of these key components:

1. **Document Processor** (`01_build_vector_store.py`)
   - Loads documents
   - Chunks them using a sliding window approach
   - Generates embeddings using sentence-transformers
   - Stores them in a FAISS index

2. **RAG API** (`rag_api.py`)
   - Receives queries via FastAPI
   - Embeds the query using the same model
   - Retrieves relevant chunks from the FAISS index
   - Formats the chunks for the LLM
   - Returns the answer and retrieved chunks

3. **Frontend Integration** (`app/api/chat+api.ts` in parent directory)
   - Proxies requests from the frontend to the RAG API
   - Handles API key management and request formatting

## Customization Options

You can customize the RAG system by modifying:

- **Chunking parameters** in `01_build_vector_store.py`:
  - Change the chunk size (currently set to 1000 characters)
  - Adjust the chunk overlap (currently 200 characters)

- **Retrieval settings** in `rag_api.py`:
  - Change the number of chunks retrieved (currently set to 5)
  - Adjust the similarity threshold

- **Embedding model**:
  - The system currently uses 'all-MiniLM-L6-v2'
  - You could switch to another sentence-transformers model
  - Or integrate with OpenAI's embedding API (requires code modifications)

## Using OpenAI Instead of Gemini

If you prefer to use OpenAI instead of Gemini for generating answers:

1. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=your_openai_key_here
   ```

2. Modify `rag_api.py` to use the OpenAI API instead of Gemini (requires code changes)

## Troubleshooting

- **Missing dependencies**: Make sure you've installed all requirements with `pip install -r requirements.txt`
- **API key issues**: Check that your `.env` file contains the correct API key
- **Vector store errors**: Ensure you've run `01_build_vector_store.py` before trying to query
- **Empty responses**: Make sure your knowledge base contains relevant documents

## Next Steps for Development

Future enhancements could include:
- Support for more document formats (PDF, HTML, etc.)
- User-specific personalized knowledge bases
- Hybrid search combining semantic and keyword-based retrieval
- Connection to web search for up-to-date information
