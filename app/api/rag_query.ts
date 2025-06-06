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

interface RAGQueryOptions {
  topK?: number;
  minScore?: number;
}

export class RAGQuery {
  private tpuf: Turbopuffer;
  private openai: OpenAI;
  private namespace: string;

  constructor(apiKey: string, namespace: string = "health") {
    this.tpuf = new Turbopuffer({
      apiKey: apiKey,
      baseUrl: "https://gcp-us-central1.turbopuffer.com",
    });
    
    const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }
    
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

  async query(
    queryText: string,
    options: RAGQueryOptions = {}
  ): Promise<RAGResult[]> {
    try {
      const {
        topK = 4,
        minScore = 0.5, // Default minimum similarity score
      } = options;

      console.log("RAG Query - Starting query with:", { queryText, topK, minScore, namespace: this.namespace });

      // Get query embedding
      console.log("RAG Query - Generating embedding...");
      const queryEmbedding = await this.getEmbedding(queryText);
      console.log("RAG Query - Embedding generated, length:", queryEmbedding.length);

      // Query the vector store
      console.log("RAG Query - Querying Turbopuffer...");
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

      console.log("RAG Query - Raw results from Turbopuffer:", results);
      console.log("RAG Query - Number of rows returned:", results.rows?.length || 0);

      if (!results.rows || results.rows.length === 0) {
        console.log("RAG Query - No rows returned from Turbopuffer");
        return [];
      }

      // Format and filter results
      console.log("RAG Query - Processing results...");
      const formattedResults: RAGResult[] = results.rows
        .map((row, index) => {
          const score = 1 / (1 + (row.$dist ?? 0)); // Convert distance to similarity score
          console.log(`RAG Query - Processing row ${index}:`, { 
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
          console.log(`RAG Query - Result ${index} filter:`, { score: result.score, minScore, passed });
          return passed;
        });

      console.log("RAG Query - Final formatted results:", formattedResults.length);
      return formattedResults;
    } catch (error) {
      console.error("Error querying RAG system:", error);
      throw error;
    }
  }

  // Helper method to format results for display
  formatResults(results: RAGResult[]): string {
    if (results.length === 0) {
      return "No relevant results found.";
    }

    return results
      .map((result, index) => {
        const pageInfo = result.pageNumber ? `, Page: ${result.pageNumber}` : "";
        return `
Result ${index + 1} (Score: ${result.score.toFixed(4)}):
Source: ${result.source}${pageInfo}, Chunk: ${result.docChunkIdx}
---
${result.text.slice(0, 500)}${result.text.length > 500 ? "..." : ""}
`;
      })
      .join("\n");
  }
}

// Example usage:
/*
const rag = new RAGQuery(process.env.TURBOPUFFER_API_KEY!);

async function search(query: string) {
  try {
    const results = await rag.query(query, { topK: 3 });
    console.log(rag.formatResults(results));
  } catch (error) {
    console.error("Search failed:", error);
  }
}

// Example:
// search("What are the symptoms of heart disease?");
*/ 