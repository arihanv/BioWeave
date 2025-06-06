import { IconSymbol } from "@/components/ui/IconSymbol";
import { ChatConversation } from "@/hooks/useChatStorage";
import React from "react";
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ConversationListModalProps {
  visible: boolean;
  onClose: () => void;
  conversations: ChatConversation[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onClearAll: () => void;
}

export const ConversationListModal: React.FC<ConversationListModalProps> = ({
  visible,
  onClose,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  onClearAll,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleDeleteConversation = (conversationId: string, title: string) => {
    Alert.alert(
      "Delete chat?",
      "This will delete the conversation.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => onDeleteConversation(conversationId)
        }
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear conversations?",
      "This will delete all conversations.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear all", 
          style: "destructive",
          onPress: onClearAll
        }
      ]
    );
  };

  const renderConversationItem = ({ item }: { item: ChatConversation }) => {
    const isCurrentConversation = item.id === currentConversationId;
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          isCurrentConversation && styles.currentConversationItem
        ]}
        onPress={() => {
          onSelectConversation(item.id);
          onClose();
        }}
      >
        <View style={styles.conversationContent}>
          <Text 
            style={[
              styles.conversationTitle,
              isCurrentConversation && styles.currentConversationTitle
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.conversationDate}>
            {formatDate(item.updatedAt)}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteConversation(item.id, item.title)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <IconSymbol name="trash" size={16} color="#8e8e93" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <IconSymbol name="xmark" size={18} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chats</Text>
          <TouchableOpacity
            style={styles.newChatButton}
            onPress={() => {
              onNewConversation();
              onClose();
            }}
          >
            <IconSymbol name="square.and.pencil" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No chats yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start a conversation to see your chats here
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={conversations}
              renderItem={renderConversationItem}
              keyExtractor={(item) => item.id}
              style={styles.conversationList}
              contentContainerStyle={styles.conversationListContent}
              showsVerticalScrollIndicator={false}
            />
            
            {conversations.length > 1 && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={handleClearAll}
                >
                  <IconSymbol name="trash" size={16} color="#ff3b30" />
                  <Text style={styles.clearAllButtonText}>Clear conversations</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#1f1f1f",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationList: {
    flex: 1,
  },
  conversationListContent: {
    paddingTop: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 2,
    borderRadius: 12,
  },
  currentConversationItem: {
    backgroundColor: '#2f2f2f',
  },
  conversationContent: {
    flex: 1,
    marginRight: 12,
  },
  conversationTitle: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 2,
  },
  currentConversationTitle: {
    fontWeight: '500',
  },
  conversationDate: {
    fontSize: 13,
    color: '#8e8e93',
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: '#333333',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  clearAllButtonText: {
    fontSize: 16,
    color: '#ff3b30',
    marginLeft: 8,
  },
});

export default ConversationListModal; 