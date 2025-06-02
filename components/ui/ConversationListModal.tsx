import { IconSymbol } from "@/components/ui/IconSymbol";
import { ChatConversation } from "@/hooks/useChatStorage";
import React from "react";
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
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
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleDeleteConversation = (conversationId: string, title: string) => {
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete "${title}"?`,
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
      "Clear All Conversations",
      "Are you sure you want to delete all conversations? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
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
          <View style={styles.conversationHeader}>
            <Text 
              style={[
                styles.conversationTitle,
                isCurrentConversation && styles.currentConversationTitle
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteConversation(item.id, item.title)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="trash" size={16} color="#ff3b30" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.conversationMeta}>
            <Text style={styles.messageCount}>
              {item.messages.length} messages
            </Text>
            <Text style={styles.conversationDate}>
              {formatDate(item.updatedAt)}
            </Text>
            {isCurrentConversation && (
              <View style={styles.currentIndicator}>
                <Text style={styles.currentIndicatorText}>Current</Text>
              </View>
            )}
          </View>
        </View>
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
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Conversations</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <IconSymbol name="xmark" size={20} color="#007aff" />
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.newConversationButton}
            onPress={() => {
              onNewConversation();
              onClose();
            }}
          >
            <IconSymbol name="plus" size={16} color="#fff" />
            <Text style={styles.newConversationButtonText}>New Chat</Text>
          </TouchableOpacity>

          {conversations.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearAll}
            >
              <IconSymbol name="trash.fill" size={16} color="#ff3b30" />
              <Text style={styles.clearAllButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="message" size={48} color="#c7c7cc" />
            <Text style={styles.emptyStateTitle}>No Conversations</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start a new conversation by tapping "New Chat"
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            style={styles.conversationList}
            contentContainerStyle={styles.conversationListContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "#f7f7fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
  },
  closeButton: {
    padding: 8,
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  newConversationButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007aff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  newConversationButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#ff3b30",
  },
  clearAllButtonText: {
    color: "#ff3b30",
    fontWeight: "600",
    fontSize: 16,
  },
  conversationList: {
    flex: 1,
  },
  conversationListContent: {
    paddingHorizontal: 20,
  },
  conversationItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentConversationItem: {
    backgroundColor: "#e3f2fd",
    borderWidth: 1,
    borderColor: "#007aff",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  conversationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#222",
    marginRight: 12,
  },
  currentConversationTitle: {
    color: "#007aff",
  },
  deleteButton: {
    padding: 4,
  },
  conversationMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  messageCount: {
    fontSize: 12,
    color: "#888",
  },
  conversationDate: {
    fontSize: 12,
    color: "#888",
  },
  currentIndicator: {
    backgroundColor: "#007aff",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: "auto",
  },
  currentIndicatorText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#222",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    lineHeight: 22,
  },
});

export default ConversationListModal; 