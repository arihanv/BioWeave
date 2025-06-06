import React from "react";
import {
	KeyboardAvoidingView,
	LayoutAnimation,
	NativeScrollEvent,
	NativeSyntheticEvent,
	Platform,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	UIManager,
	View
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Custom components
import { ChatHeader } from "@/components/ui/ChatHeader";
import { ChatInput } from "@/components/ui/ChatInput";
import ConversationListModal from "@/components/ui/ConversationListModal";
import { MessageBubble } from "@/components/ui/MessageBubble";
import { ScrollToBottomButton } from "@/components/ui/ScrollToBottomButton";
import { ToolCallIndicator } from "@/components/ui/ToolCallIndicator";

// Hooks
import { useAppleHealthKit } from "@/hooks/useAppleHealthKit";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChatStorage } from "@/hooks/useChatStorage";
import { useChat } from "@ai-sdk/react";
import { useKeyboard } from "@react-native-community/hooks";

// Utils
import { fetch as expoFetch } from "expo/fetch";
import { HealthInputOptions } from "react-native-health";

// Enable on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function convertUTCToLocalDateRange(utcDateString: string) {
	// Parse the UTC date but interpret it as local time
	const utcDate = new Date(utcDateString);
	if (Number.isNaN(utcDate.getTime())) return null;

	// Extract the date components from UTC and create a local date
	const year = utcDate.getUTCFullYear();
	const month = utcDate.getUTCMonth();
	const day = utcDate.getUTCDate();
	const hours = utcDate.getUTCHours();
	const minutes = utcDate.getUTCMinutes();
	const seconds = utcDate.getUTCSeconds();
	const milliseconds = utcDate.getUTCMilliseconds();

	// Create a new date using local time with the same date/time components
	const localDate = new Date(year, month, day, hours, minutes, seconds, milliseconds);
	return localDate.toISOString();
}

export default function App() {
	const {
		status,
		error: healthKitError,
		getStepCountSamples,
		getHeartRateSamples,
	} = useAppleHealthKit();

	// Chat storage
	const {
		conversations,
		currentConversationId,
		isLoading: isStorageLoading,
		createNewConversation,
		saveCurrentConversation,
		loadConversation,
		setCurrentConversation,
		deleteConversation,
		clearAllConversations,
	} = useChatStorage();

	// Modal state
	const [showConversationList, setShowConversationList] = React.useState(false);
	const [isLoadingConversation, setIsLoadingConversation] = React.useState(false);
	
	// Tool call tracking
	const [activeToolCalls, setActiveToolCalls] = React.useState<{
		toolName: string;
		startTime: number;
		args: any;
	}[]>([]);
	
	// Timer for updating tool call durations
	React.useEffect(() => {
		if (activeToolCalls.length > 0) {
			const interval = setInterval(() => {
				// Force re-render to update durations - use a stable update
				setActiveToolCalls(prev => prev.map(call => ({ ...call })));
			}, 1000);
			
			return () => clearInterval(interval);
		}
	}, [activeToolCalls.length]);
	
	const [containerHeight, setContainerHeight] = React.useState(0);
	const [contentHeight, setContentHeight] = React.useState(0);
	
	const {
		messages,
		error,
		handleInputChange,
		input,
		handleSubmit,
		setMessages,
		stop,
		isLoading,
	} = useChat({
		fetch: expoFetch as unknown as typeof globalThis.fetch,
		maxSteps: 10,
		api: "https://expo.ariv.sh/api/chat",
		// api: "http://localhost:8081/api/chat",
		onError: (error) => console.error(error, "ERROR"),
		async onToolCall({ toolCall }) {
			// Track the start of the tool call
			const startTime = Date.now();
			setActiveToolCalls(prev => [...prev, { toolName: toolCall.toolName, startTime, args: toolCall.args }]);

			try {
				if (toolCall.toolName === "getLocation") {
					const cities = ["New York", "Los Angeles", "Chicago", "San Francisco"];
					return cities[Math.floor(Math.random() * cities.length)];
				}

				console.log("toolCall", toolCall);

				const args = typeof toolCall.args === "object" && toolCall.args !== null ? toolCall.args : {};
				const { startDate, endDate } = args as { startDate?: string; endDate?: string };
				const periodArgs: HealthInputOptions = { period: 1440 };

				if (typeof startDate === "string") {
					const localStartDate = convertUTCToLocalDateRange(startDate);
					if (localStartDate) periodArgs.startDate = localStartDate;
				}
				if (typeof endDate === "string") {
					const localEndDate = convertUTCToLocalDateRange(endDate);
					if (localEndDate) periodArgs.endDate = localEndDate;
				}

				if (toolCall.toolName === "getStepCount") {
					console.log("stepArgs", periodArgs);
					const stepCount = await getStepCountSamples(periodArgs);
					console.log("stepCount", stepCount);
					return stepCount;
				}

				if (toolCall.toolName === "getHeartRate") {
					console.log("heartRateArgs", periodArgs);
					const heartRates = await getHeartRateSamples(periodArgs);
					console.log("heartRates", heartRates);
					return heartRates;
				}
			} finally {
				// Remove the tool call from active list when done
				setActiveToolCalls(prev => prev.filter(call => 
					!(call.toolName === toolCall.toolName && call.startTime === startTime)
				));
			}
		},
	});
	
	const { scrollViewRef, scrollToEnd } = useAutoScroll();
	const insets = useSafeAreaInsets();
	const { keyboardShown, keyboardHeight } = useKeyboard();
	const [showScrollButton, setShowScrollButton] = React.useState(false);
	// Track if we're at the bottom of the content
	const isNearBottom = React.useRef(true);
	const [lastScrollData, setLastScrollData] = React.useState<{ contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } | null>(null);
	// Reference to track previous message IDs to detect new messages
	const prevLastMessageRef = React.useRef<string | null>(null);
	
	// Create refs for stable function access
	const saveCurrentConversationRef = React.useRef(saveCurrentConversation);
	const loadConversationRef = React.useRef(loadConversation);
	const setMessagesRef = React.useRef(setMessages);
	
	// Update refs when functions change
	React.useEffect(() => {
		saveCurrentConversationRef.current = saveCurrentConversation;
	}, [saveCurrentConversation]);
	
	React.useEffect(() => {
		loadConversationRef.current = loadConversation;
	}, [loadConversation]);
	
	React.useEffect(() => {
		setMessagesRef.current = setMessages;
	}, [setMessages]);

	// Filter messages to only show user, assistant, and system messages
	const renderableMessages = React.useMemo(() => 
		messages.filter(message => 
			message.role === 'user' || message.role === 'assistant' || message.role === 'system'
		), [messages]
	);

	const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const scrollData = event.nativeEvent;
		setLastScrollData(scrollData);
	}, []);

	// Update scroll button visibility when data changes
	React.useEffect(() => {
		// If we have scroll data from an actual scroll event
		if (lastScrollData) {
			const { contentOffset, contentSize, layoutMeasurement } = lastScrollData;
			const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
			const hasScrollableContent = contentSize.height > layoutMeasurement.height;
			
			isNearBottom.current = isAtBottom;
			setShowScrollButton(hasScrollableContent && !isAtBottom && renderableMessages.length > 0);
		} 
		// If we have container and content height but no scroll data yet
		else if (contentHeight > 0 && containerHeight > 0) {
			const hasOverflow = contentHeight > containerHeight + 10; // 10px buffer
			const isAtBottom = containerHeight >= contentHeight - 50;
			
			isNearBottom.current = isAtBottom;
			setShowScrollButton(hasOverflow && !isAtBottom && renderableMessages.length > 0);
		}
	}, [lastScrollData, renderableMessages.length, contentHeight, containerHeight]);

	// Auto-scroll for new messages
	React.useEffect(() => {
		if (messages.length > 0) {
			const lastMessage = messages[messages.length - 1];
			
			// Check if we have a new message
			if (prevLastMessageRef.current !== lastMessage.id) {
				prevLastMessageRef.current = lastMessage.id;
				
				// Only auto-scroll if we're already near the bottom
				if (isNearBottom.current) {
					// Small delay to ensure the message is rendered
					setTimeout(() => {
						scrollToEnd();
					}, 100);
				}
			}
		}
	}, [messages, scrollToEnd]);

	// Handle layout animations
	React.useEffect(() => {
		if (Platform.OS === 'ios') {
			LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		}
	}, [keyboardShown]);

	// Save current conversation when messages change (but not when loading)
	React.useEffect(() => {
		if (messages.length > 0 && !isLoadingConversation) {
			saveCurrentConversationRef.current(messages);
		}
	}, [messages, isLoadingConversation]);

	// Load conversation when currentConversationId changes
	React.useEffect(() => {
		if (currentConversationId && !isLoadingConversation) {
			setIsLoadingConversation(true);
			const conversationMessages = loadConversationRef.current(currentConversationId);
			setMessagesRef.current(conversationMessages);
			setIsLoadingConversation(false);
		}
	}, [currentConversationId]);

	const handleNewConversation = async () => {
		setIsLoadingConversation(true);
		const newId = await createNewConversation();
		setMessages([]);
		setIsLoadingConversation(false);
	};

	const handleSelectConversation = (conversationId: string) => {
		setCurrentConversation(conversationId);
	};

	const handleClearChat = () => {
		setMessages([]);
		if (currentConversationId) {
			saveCurrentConversation([]);
		}
	};

	const getCurrentConversationTitle = () => {
		if (currentConversationId) {
			const currentConversation = conversations.find(conv => conv.id === currentConversationId);
			return currentConversation?.title || 'Health Assistant';
		}
		return 'Health Assistant';
	};

	const handleSubmitMessage = () => {
		handleSubmit();
	};

	return (
		<SafeAreaView style={styles.container}>
			<ChatHeader
				onToggleConversations={() => setShowConversationList(true)}
				onNewChat={handleNewConversation}
				currentTitle={getCurrentConversationTitle()}
			/>

			<KeyboardAvoidingView
				style={styles.chatContainer}
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				keyboardVerticalOffset={10}
			>
				<View style={styles.messagesContainer}>
					{renderableMessages.length === 0 ? (
						<View style={styles.emptyState}>
							<Text style={styles.emptyStateTitle}>How can I help you today?</Text>
							<Text style={styles.emptyStateSubtitle}>
								Ask me about your health data, get fitness insights, or start a conversation about wellness.
							</Text>
						</View>
					) : (
						<ScrollView
							ref={scrollViewRef}
							style={styles.messagesList}
							contentContainerStyle={styles.messagesContent}
							onScroll={handleScroll}
							scrollEventThrottle={16}
							onLayout={(event) => {
								setContainerHeight(event.nativeEvent.layout.height);
							}}
							onContentSizeChange={(width, height) => {
								setContentHeight(height);
							}}
							showsVerticalScrollIndicator={false}
							keyboardShouldPersistTaps="handled"
							keyboardDismissMode="interactive"
						>
							{renderableMessages.map((message) => (
								<MessageBubble
									key={message.id}
									message={message}
									isTyping={isLoading && message.id === messages[messages.length - 1]?.id}
								/>
							))}
							
							{/* Show active tool calls */}
							{activeToolCalls.map((toolCall, index) => (
								<ToolCallIndicator
									key={`${toolCall.toolName}-${toolCall.startTime}-${index}`}
									toolName={toolCall.toolName}
									isActive={true}
									duration={Math.floor((Date.now() - toolCall.startTime) / 1000)}
									args={toolCall.args}
								/>
							))}
						</ScrollView>
					)}
				</View>

				<ScrollToBottomButton
					visible={showScrollButton}
					onPress={scrollToEnd}
				/>

				<ChatInput
					value={input}
					onChangeText={(text: string) => {
						handleInputChange({
							target: { value: text }
						} as React.ChangeEvent<HTMLInputElement>);
					}}
					onSubmit={handleSubmitMessage}
					isLoading={isLoading}
					placeholder="Message"
				/>
			</KeyboardAvoidingView>

			<ConversationListModal
				visible={showConversationList}
				onClose={() => setShowConversationList(false)}
				conversations={conversations}
				currentConversationId={currentConversationId}
				onSelectConversation={handleSelectConversation}
				onDeleteConversation={deleteConversation}
				onNewConversation={handleNewConversation}
				onClearAll={clearAllConversations}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#1f1f1f',
	},
	chatContainer: {
		flex: 1,
	},
	messagesContainer: {
		flex: 1,
	},
	emptyState: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 40,
	},
	emptyStateTitle: {
		fontSize: 24,
		fontWeight: '600',
		color: '#ffffff',
		textAlign: 'center',
		marginBottom: 8,
	},
	emptyStateSubtitle: {
		fontSize: 16,
		color: '#8e8e93',
		textAlign: 'center',
		lineHeight: 22,
	},
	messagesList: {
		flex: 1,
	},
	messagesContent: {
		paddingVertical: 16,
	},
});
