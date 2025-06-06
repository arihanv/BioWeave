import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { OpenAI } from "openai";

interface RAGResult {
  id: string;
  score: number;
  text: string;
  source: string;
  pageNumber?: number;
  docChunkIdx: number;
  chunkLength: number;
}

class ServerRAGQuery {
  private tpuf: Turbopuffer;
  private openai: OpenAI;
  private namespace: string;

  constructor(turbopufferApiKey: string, openaiApiKey: string, namespace: string = "health") {
    this.tpuf = new Turbopuffer({
      apiKey: turbopufferApiKey,
      baseUrl: "https://gcp-us-central1.turbopuffer.com",
    });
    
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.namespace = namespace;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  async query(queryText: string, topK: number = 4, minScore: number = 0.3): Promise<RAGResult[]> {
    try {
      console.log("Server RAG Query - Starting query with:", { queryText, topK, minScore, namespace: this.namespace });

      // Get query embedding
      console.log("Server RAG Query - Generating embedding...");
      const queryEmbedding = await this.getEmbedding(queryText);
      console.log("Server RAG Query - Embedding generated, length:", queryEmbedding.length);

      // Query the vector store
      console.log("Server RAG Query - Querying Turbopuffer...");
      const ns = this.tpuf.namespace(this.namespace);
      const results = await ns.query({
        rank_by: ["vector", "ANN", queryEmbedding],
        top_k: topK,
        include_attributes: [
          "text",
          "source",
          "page_number",
          "doc_chunk_idx",
          "chunk_length",
        ],
      });

      console.log("Server RAG Query - Raw results from Turbopuffer:", results);
      console.log("Server RAG Query - Number of rows returned:", results.rows?.length || 0);

      if (!results.rows || results.rows.length === 0) {
        console.log("Server RAG Query - No rows returned from Turbopuffer");
        return [];
      }

      // Format and filter results
      console.log("Server RAG Query - Processing results...");
      const formattedResults: RAGResult[] = results.rows
        .map((row, index) => {
          const score = 1 / (1 + (row.$dist ?? 0)); // Convert distance to similarity score
          console.log(`Server RAG Query - Processing row ${index}:`, { 
            id: row.id, 
            dist: row.$dist, 
            score,
            hasText: !!row.text,
            hasSource: !!row.source 
          });
          return {
            id: String(row.id),
            score,
            text: String(row.text),
            source: String(row.source),
            pageNumber: row.page_number
              ? parseInt(String(row.page_number))
              : undefined,
            docChunkIdx: parseInt(String(row.doc_chunk_idx)),
            chunkLength: parseInt(String(row.chunk_length)),
          };
        })
        .filter((result, index) => {
          const passed = result.score >= minScore;
          console.log(`Server RAG Query - Result ${index} filter:`, { score: result.score, minScore, passed });
          return passed;
        });

      console.log("Server RAG Query - Final formatted results:", formattedResults.length);
      return formattedResults;
    } catch (error) {
      console.error("Error querying RAG system:", error);
      throw error;
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, topK = 4, minScore = 0.3 } = body;

    if (!query) {
      return Response.json({ error: "Query is required" }, { status: 400 });
    }

    // Check for required environment variables
    const turbopufferApiKey = process.env.EXPO_PUBLIC_TURBOPUFFER_API_KEY;
    const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!turbopufferApiKey) {
      return Response.json({ error: "Turbopuffer API key not configured" }, { status: 500 });
    }

    if (!openaiApiKey) {
      return Response.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // Create RAG query instance
    const rag = new ServerRAGQuery(turbopufferApiKey, openaiApiKey);
    
    // Execute query
    const results = await rag.query(query, topK, minScore);

    return Response.json({
      query,
      results,
      count: results.length
    });

  } catch (error) {
    console.error("RAG API Error:", error);
    return Response.json({
      error: `RAG query failed: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
} 