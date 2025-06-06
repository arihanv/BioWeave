import React from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { IconSymbol } from './IconSymbol';

interface ScrollToBottomButtonProps {
  visible: boolean;
  onPress: () => void;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  visible,
  onPress,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <IconSymbol name="arrow.down" size={16} color="#ffffff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    zIndex: 1000,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2f2f2f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 0.5,
    borderColor: '#4a4a4a',
  },
}); 