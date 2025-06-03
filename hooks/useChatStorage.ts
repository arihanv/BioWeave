import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from 'ai';
import { useCallback, useEffect, useState } from 'react';

export interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEYS = {
  CONVERSATIONS: 'chat_conversations',
  CURRENT_CONVERSATION_ID: 'current_conversation_id',
} as const;

export const useChatStorage = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate a conversation title from the first user message
  const generateTitle = (messages: Message[]): string => {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content;
      // Take first 50 characters and add ellipsis if needed
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    return 'New Conversation';
  };

  // Load all conversations from storage
  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedConversations = await AsyncStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      const storedCurrentId = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      
      if (storedConversations) {
        const parsed = JSON.parse(storedConversations);
        setConversations(parsed);
      }
      
      if (storedCurrentId) {
        setCurrentConversationId(storedCurrentId);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save conversations to storage
  const saveConversations = useCallback(async (newConversations: ChatConversation[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(newConversations));
      setConversations(newConversations);
    } catch (error) {
      console.error('Error saving conversations:', error);
    }
  }, []);

  // Create a new conversation
  const createNewConversation = useCallback(async (messages: Message[] = []): Promise<string> => {
    const newId = Date.now().toString();
    const newConversation: ChatConversation = {
      id: newId,
      title: messages.length > 0 ? generateTitle(messages) : 'New Conversation',
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newConversations = [newConversation, ...conversations];
    await saveConversations(newConversations);
    
    // Set current conversation directly without triggering effects
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, newId);
      setCurrentConversationId(newId);
    } catch (error) {
      console.error('Error setting current conversation:', error);
    }
    
    return newId;
  }, [conversations, saveConversations]);

  // Save current conversation
  const saveCurrentConversation = useCallback(async (messages: Message[]) => {
    if (!currentConversationId) {
      // If no current conversation, create a new one
      if (messages.length > 0) {
        const newId = Date.now().toString();
        const newConversation: ChatConversation = {
          id: newId,
          title: generateTitle(messages),
          messages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setConversations(prev => {
          const newConversations = [newConversation, ...prev];
          AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(newConversations)).catch(console.error);
          return newConversations;
        });
        
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, newId);
          setCurrentConversationId(newId);
        } catch (error) {
          console.error('Error setting current conversation:', error);
        }
      }
      return;
    }

    setConversations(prev => {
      const updatedConversations = prev.map(conv => {
        if (conv.id === currentConversationId) {
          return {
            ...conv,
            messages,
            title: messages.length > 0 ? generateTitle(messages) : conv.title,
            updatedAt: new Date().toISOString(),
          };
        }
        return conv;
      });
      
      AsyncStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(updatedConversations)).catch(console.error);
      return updatedConversations;
    });
  }, [currentConversationId]);

  // Load a specific conversation
  const loadConversation = useCallback((conversationId: string): Message[] => {
    const conversation = conversations.find(conv => conv.id === conversationId);
    return conversation ? conversation.messages : [];
  }, [conversations]);

  // Set current conversation
  const setCurrentConversation = useCallback(async (conversationId: string | null) => {
    try {
      if (conversationId) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, conversationId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      }
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error setting current conversation:', error);
    }
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
    await saveConversations(updatedConversations);
    
    // If we're deleting the current conversation, clear it
    if (currentConversationId === conversationId) {
      await setCurrentConversation(null);
    }
  }, [conversations, currentConversationId, saveConversations, setCurrentConversation]);

  // Clear all conversations
  const clearAllConversations = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID);
      setConversations([]);
      setCurrentConversationId(null);
    } catch (error) {
      console.error('Error clearing conversations:', error);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    currentConversationId,
    isLoading,
    createNewConversation,
    saveCurrentConversation,
    loadConversation,
    setCurrentConversation,
    deleteConversation,
    clearAllConversations,
    loadConversations,
  };
}; 