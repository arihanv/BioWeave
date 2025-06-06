import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface RAGResult {
  id: string;
  $dist?: number;
  text: string;
  source: string;
  page_number?: string;
  doc_chunk_idx: string;
  chunk_length: string;
}

interface RAGIndicatorProps {
  query?: string;
  results?: RAGResult[];
  isActive?: boolean;
  duration?: number;
}

export const RAGIndicator: React.FC<RAGIndicatorProps> = ({
  query,
  results,
  isActive = false,
  duration,
}) => {
  const formatQuery = (query: string) => {
    if (query.length > 50) {
      return query.substring(0, 47) + '...';
    }
    return query;
  };

  const formatResults = (results: RAGResult[]) => {
    if (!results || results.length === 0) return '';
    
    // Group results by source
    const sourceGroups: { [key: string]: string[] } = {};
    results.forEach(result => {
      const source = result.source.replace('.pdf', '');
      if (!sourceGroups[source]) {
        sourceGroups[source] = [];
      }
      if (result.page_number) {
        sourceGroups[source].push(result.page_number);
      }
    });

    // Format as "doc1 (p1,2), doc2 (p3)"
    const sourceStrings = Object.entries(sourceGroups).map(([source, pages]) => {
      if (pages.length === 0) return source;
      const uniquePages = [...new Set(pages)].sort((a, b) => parseInt(a) - parseInt(b));
      return `${source} (p${uniquePages.join(',')})`;
    });

    const resultCount = results.length;
    const sourceText = sourceStrings.slice(0, 2).join(', '); // Show max 2 sources
    const moreText = sourceStrings.length > 2 ? ` +${sourceStrings.length - 2} more` : '';
    
    return ` • ${resultCount} results • ${sourceText}${moreText}`;
  };

  const getDurationText = () => {
    if (duration) {
      return ` • ${duration}s`;
    }
    return '';
  };

  const resultsText = results ? formatResults(results) : '';
  const queryText = query ? formatQuery(query) : 'Searching...';

  return (
    <View style={styles.container}>
      <View style={styles.indicator}>
        {isActive ? (
          <ActivityIndicator size="small" color="#8e8e93" />
        ) : (
          <Text style={styles.icon}>🔍</Text>
        )}
        <Text style={styles.text}>
          {queryText}{getDurationText()}{resultsText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  icon: {
    fontSize: 12,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '500',
  },
}); 