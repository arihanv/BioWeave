import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface RAGResult {
  id: string;
  score: number;
  text: string;
  source: string;
  pageNumber?: number;
  docChunkIdx: number;
  chunkLength: number;
}

interface RAGResultsProps {
  results: RAGResult[];
  query?: string;
}

const getScoreColor = (score: number): string => {
  if (score >= 0.6) return '#34C759'; // Green for high scores
  if (score >= 0.45) return '#FFD60A'; // Yellow for medium scores
  return '#FF3B30'; // Red for low scores
};

export const RAGResults: React.FC<RAGResultsProps> = ({ results, query }) => {
  if (!results || results.length === 0) {
    return null;
  }

  const truncateTitle = (title: string, maxLength: number = 35) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  return (
    <ScrollView style={styles.container}>
      {query && (
        <View style={styles.queryContainer}>
          <Text style={styles.queryLabel}>Query:</Text>
          <Text style={styles.queryText}>&quot;{query}&quot;</Text>
        </View>
      )}
      {results.map((result, index) => (
        <View key={result.id} style={styles.resultCard}>
          <Text style={styles.sourceText} numberOfLines={1}>
            {truncateTitle(result.source)}
          </Text>
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Page</Text>
              <Text style={styles.metaValue}>{result.pageNumber || 'N/A'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Chunk</Text>
              <Text style={styles.metaValue}>{result.docChunkIdx}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Score</Text>
              <Text style={[styles.metaValue, { color: getScoreColor(result.score) }]}>
                {result.score.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  queryContainer: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  queryLabel: {
    color: '#8e8e93',
    fontSize: 10,
    marginRight: 4,
  },
  queryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  resultCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingLeft: 8,
    padding: 0,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    borderColor: '#2a2a2a',
    borderLeftWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomRightRadius: 6,
    borderTopRightRadius: 6,
  },
  metaItem: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  metaLabel: {
    color: '#8e8e93',
    fontSize: 10,
    marginBottom: 1,
  },
  metaValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
}); 