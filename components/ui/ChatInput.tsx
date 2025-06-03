import { useKeyboard } from '@react-native-community/hooks';
import React from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from './IconSymbol';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
  onSubmit,
  isLoading = false,
  placeholder = 'Message',
}) => {
  const insets = useSafeAreaInsets();
  const { keyboardShown } = useKeyboard();
  const [inputHeight, setInputHeight] = React.useState(20);
  const maxHeight = 120;

  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    setInputHeight(Math.min(height, maxHeight));
  };

  const handleSubmit = () => {
    if (value.trim() && !isLoading) {
      onSubmit();
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: 0 }]}>
      <View style={styles.inputContainer}>
        <View style={[styles.inputWrapper, { minHeight: Math.max(inputHeight + 20, 44) }]}>
          <TextInput
            style={[styles.textInput, { height: Math.max(inputHeight, 20) }]}
            value={value}
            onChangeText={onChangeText}
            onContentSizeChange={handleContentSizeChange}
            placeholder={placeholder}
            placeholderTextColor="#8e8e93"
            multiline
            maxLength={4000}
            scrollEnabled={inputHeight >= maxHeight}
            onSubmitEditing={handleSubmit}
            blurOnSubmit={false}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: value.trim() ? '#ffffff' : '#4a4a4a' }
            ]}
            onPress={handleSubmit}
            disabled={!value.trim() || isLoading}
          >
            {isLoading ? (
              <IconSymbol name="stop.circle" size={16} color="#000000" />
            ) : (
              <IconSymbol 
                name="arrow.up" 
                size={16} 
                color={value.trim() ? '#000000' : '#8e8e93'} 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f1f1f',
    borderTopWidth: 0.5,
    borderTopColor: '#333333',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2f2f2f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    marginRight: 8,
    textAlignVertical: 'center',
    paddingVertical: 0,
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 