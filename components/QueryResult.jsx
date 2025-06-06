import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';

/**
 * Query result component with toggle for showing/hiding sources
 * @param {Object} props - Component properties
 * @param {Object} props.result - Response from the RAG endpoint
 */
const QueryResult = ({ result }) => {
  const [showSources, setShowSources] = useState(false);
  
  if (!result) return null;

  return (
    <View style={styles.container}>
      {/* Main answer always shown */}
      <View style={styles.answerContainer}>
        <Markdown style={styles.markdown}>
          {result.answer}
        </Markdown>
      </View>
      
      {/* Toggle button */}
      <TouchableOpacity 
        onPress={() => setShowSources(!showSources)}
        style={styles.toggleButton}
      >
        <Text style={styles.toggleButtonText}>
          {showSources ? 'Hide Sources' : 'Show Sources'}
        </Text>
      </TouchableOpacity>
      
      {/* Sources section - only shown when toggle is on */}
      {showSources && result.retrieved_chunks && result.retrieved_chunks.length > 0 && (
        <View style={styles.sourcesContainer}>
          <Text style={styles.sourcesHeader}>
            Sources ({result.retrieved_chunks.length})
          </Text>
          
          {result.retrieved_chunks.map((chunk, i) => {
            // Extract just the filename from the full path
            const filename = chunk.source.split('\\').pop();
            
            // Calculate a confidence score out of 10 (lower score is better in FAISS)
            const relevance = Math.max(0, 10 - chunk.score).toFixed(1);
            
            // Truncate the text preview
            const textPreview = chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : '');
            
            return (
              <View key={i} style={styles.sourceItem}>
                <View style={styles.sourceHeader}>
                  <Text style={styles.sourcePath}>{filename}</Text>
                  <Text style={styles.sourceRelevance}>Relevance: {relevance}/10</Text>
                </View>
                <Text style={styles.sourceText}>{textPreview}</Text>
              </View>
            );
          })}
        </View>
      )}
      
      {/* When category info is available, show it */}
      {result.category && (
        <View style={styles.categoryContainer}>
          <Text style={styles.categoryText}>
            Category: <Text style={styles.categoryValue}>{result.category}</Text>
            {result.confidence && ` (${(result.confidence * 100).toFixed(0)}% confidence)`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  answerContainer: {
    marginBottom: 12,
  },
  markdown: {
    body: { fontSize: 15, lineHeight: 22, color: '#333' },
    heading1: { fontSize: 20, marginBottom: 8, marginTop: 8, fontWeight: 'bold' },
    bullet_list: { marginVertical: 8 },
    list_item: { marginBottom: 4 },
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  toggleButtonText: {
    color: '#4A6FA5',
    fontSize: 14,
    fontWeight: '500',
  },
  sourcesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 8,
  },
  sourcesHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#555',
  },
  sourceItem: {
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f7f9fc',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4A6FA5',
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sourcePath: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4A6FA5',
  },
  sourceRelevance: {
    fontSize: 12,
    color: '#777',
  },
  sourceText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  categoryContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
  },
  categoryValue: {
    fontWeight: 'bold',
    color: '#4A6FA5',
  }
});

export default QueryResult;
