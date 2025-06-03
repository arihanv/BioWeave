import React from 'react';
import {
  StyleSheet,
  Text,
  View
} from 'react-native';
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
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText
          ]}>
            {message.content}
          </Text>
          
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
    // paddingHorizontal: 16,
    paddingVertical: 10,
    marginVertical: 2,
  },
  userMessage: {
    backgroundColor: '#2f2f2f',
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#404040',
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
  assistantMessageText: {
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