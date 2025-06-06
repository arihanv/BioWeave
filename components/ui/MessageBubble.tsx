import React from 'react';
import {
  StyleSheet,
  Text,
  View
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { ToolCallIndicator } from './ToolCallIndicator';

interface MessageBubbleProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'data';
    content: string;
    toolInvocations?: any[]; // Use any to be flexible with AI SDK types
  };
  isTyping?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isTyping = false,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Don't render data messages
  if (message.role === 'data') {
    return null;
  }

  // Check if this message has tool invocations
  const hasToolInvocations = message.toolInvocations && message.toolInvocations.length > 0;

  return (
    <View style={styles.container}>
      {/* Show tool invocations for assistant messages */}
      {isAssistant && hasToolInvocations && (
        <View style={styles.toolInvocationsContainer}>
          {message.toolInvocations!.map((toolInvocation, index) => (
            <ToolCallIndicator
              key={`${toolInvocation.toolCallId || toolInvocation.toolName}-${index}`}
              toolName={toolInvocation.toolName}
              isActive={false} // Completed tool invocations are not active
              args={toolInvocation.args}
            />
          ))}
        </View>
      )}

      {/* Only show message content if it exists */}
      {message.content && (
        <View style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}>
          {isUser ? (
            <Text style={[
              styles.messageText,
              styles.userMessageText
            ]}>
              {message.content}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>{message.content}</Markdown>
          )}
          
          {/* <Text>{message.content}</Text> */}
          {isTyping && (
            <View style={styles.typingIndicator}>
              <View style={[styles.dot, styles.dot1]} />
              <View style={[styles.dot, styles.dot2]} />
              <View style={[styles.dot, styles.dot3]} />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const markdownStyles = {
  body: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  paragraph: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    marginVertical: 0,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  strong: {
    color: '#ffffff',
    fontWeight: 'bold' as const,
  },
  em: {
    color: '#ffffff',
    fontStyle: 'italic' as const,
  },
  code_inline: {
    backgroundColor: '#2a2a2a',
    color: '#e6e6e6',
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#404040',
  },
  code_block: {
    backgroundColor: '#2a2a2a',
    color: '#e6e6e6',
    fontFamily: 'monospace',
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#404040',
  },
  blockquote: {
    backgroundColor: '#2a2a2a',
    borderLeftWidth: 4,
    borderLeftColor: '#4A9EFF',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  heading1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold' as const,
    marginVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
    paddingBottom: 4,
  },
  heading2: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold' as const,
    marginVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
    paddingBottom: 4,
  },
  heading3: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginVertical: 4,
  },
  list_item: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  link: {
    color: '#4A9EFF',
    textDecorationLine: 'underline' as const,
  },
  hr: {
    backgroundColor: '#404040',
    height: 1,
    marginTop: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 4,
    marginVertical: 8,
  },
  th: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    fontWeight: 'bold' as const,
    padding: 8,
    borderWidth: 1,
    borderColor: '#404040',
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#404040',
    color: '#ffffff',
  },
  strikethrough: {
    color: '#999999',
    textDecorationLine: 'line-through' as const,
  },
  image: {
    borderRadius: 8,
    marginVertical: 8,
  },
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  toolInvocationsContainer: {
    marginBottom: -5,
  },
  messageContainer: {
    borderRadius: 12,
  },
  userMessage: {
    backgroundColor: '#2f2f2f',
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#404040',
    paddingVertical: 10,
  },
  assistantMessage: {
    alignSelf: 'stretch',
    paddingHorizontal: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#ffffff',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginHorizontal: 2,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
}); 