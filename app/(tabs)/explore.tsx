import { IconSymbol } from "@/components/ui/IconSymbol";
import { useAppleHealthKit } from "@/hooks/useAppleHealthKit";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChat } from "@ai-sdk/react";
import { useKeyboard } from "@react-native-community/hooks";
import { fetch as expoFetch } from "expo/fetch";
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
	TextInput,
	TouchableOpacity,
	UIManager,
	View
} from "react-native";
import { HealthInputOptions } from "react-native-health";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
	
	const [containerHeight, setContainerHeight] = React.useState(0);
	const [contentHeight, setContentHeight] = React.useState(0);
	const {
		messages,
		error,
		handleInputChange,
		input,
		handleSubmit,
		setMessages,
	} = useChat({
		fetch: expoFetch as unknown as typeof globalThis.fetch,
		maxSteps: 10,
		initialMessages: [
			{
				id: "1",
				role: "assistant",
				content: "Hello! I'm your health assistant. How can I help you today?",
			},
			{
				id: "2",
				role: "user",
				content: "What is my step count for the last 7 days?",
			},
			{
				id: "3",
				role: "assistant",
				content: "Your step count for the last 7 days is 10,000 steps.",
			},
			{
				id: "4",
				role: "user",
				content: "What is my heart rate for the last 7 days?",
			},
			{
				id: "5",
				role: "assistant",
				content: "Your heart rate for the last 7 days is 100 bpm.",
			},
			{
				id: "6",
				role: "user",
				content: "What is my sleep for the last 7 days?",
			},
			{
				id: "7",
				role: "assistant",
				content: "Your sleep for the last 7 days is 7 hours.",
			},
		],
		api: "https://expo.ariv.sh/api/chat",
		onError: (error) => console.error(error, "ERROR"),
		async onToolCall({ toolCall }) {
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

	const updateScrollButtonVisibility = React.useCallback(() => {
		// If we have scroll data from an actual scroll event
		if (lastScrollData) {
			const { contentOffset, contentSize, layoutMeasurement } = lastScrollData;
			const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
			const hasScrollableContent = contentSize.height > layoutMeasurement.height;
			
			isNearBottom.current = isAtBottom;
			setShowScrollButton(hasScrollableContent && !isAtBottom && messages.length > 0);
		} 
		// If we have container and content height but no scroll data yet
		else if (contentHeight > 0 && containerHeight > 0) {
			const hasOverflow = contentHeight > containerHeight + 10; // 10px buffer
			const isAtBottom = containerHeight >= contentHeight - 50;
			
			isNearBottom.current = isAtBottom;
			setShowScrollButton(hasOverflow && !isAtBottom && messages.length > 0);
		}
	}, [lastScrollData, messages.length, contentHeight, containerHeight]);

	const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const scrollData = event.nativeEvent;
		setLastScrollData(scrollData);
		
		const { contentOffset, contentSize, layoutMeasurement } = scrollData;
		const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50; // 50px threshold
		const hasScrollableContent = contentSize.height > layoutMeasurement.height;
		
		isNearBottom.current = isAtBottom;
		setShowScrollButton(hasScrollableContent && !isAtBottom && messages.length > 0);
	}, [messages.length]);

	// Auto-scroll only when NEW user messages are added (not content updates)
	React.useEffect(() => {
		if (messages.length === 0) return;

		const lastMessage = messages[messages.length - 1];
		const prevLastMessageId = prevLastMessageRef.current;
		// Just store the ID instead of the whole message
		prevLastMessageRef.current = lastMessage.id;

		// Only scroll if the last message is from the user AND it's a new message (ID changed)
		if (
			lastMessage?.role === "user" &&
			(!prevLastMessageId || prevLastMessageId !== lastMessage.id)
		) {
			setTimeout(() => {
				scrollToEnd();
				setShowScrollButton(false);
				console.log('Auto-scrolled to end after user message');
			}, 100);
		} else {
			// Check if we need to show scroll button for assistant messages
			setTimeout(() => {
				updateScrollButtonVisibility();
			}, 100);
		}
	}, [messages, scrollToEnd, updateScrollButtonVisibility]);

	// For initial scroll behavior
	React.useEffect(() => {
		if (messages.length === 0) {
			setShowScrollButton(false);
			return;
		}
		updateScrollButtonVisibility();
	}, [messages.length, updateScrollButtonVisibility]);

	// Track assistant message updates for streaming content
	const lastContentRef = React.useRef<string | null>(null);
	
	// Check scroll position when message content changes (for streaming)
	React.useEffect(() => {
		if (messages.length > 0) {
			const lastMessage = messages[messages.length - 1];
			if (lastMessage?.role === 'assistant' && lastMessage.content !== lastContentRef.current) {
				lastContentRef.current = lastMessage.content;
				updateScrollButtonVisibility();
			}
		}
	}, [messages, updateScrollButtonVisibility]);

	// Check visibility on initial render and whenever messages change
	React.useEffect(() => {
		if (messages.length === 0) return;
		
		// First check: immediate check without waiting
		if (contentHeight > 0 && containerHeight > 0) {
			const hasScrollableContent = contentHeight > containerHeight + 10;
			if (hasScrollableContent) {
				setShowScrollButton(true);
				console.log('Initial check: Content is scrollable, showing button');
			}
		}
		
		// Second check: with a delay to ensure measurements are complete
		const timer = setTimeout(() => {
			if (contentHeight > 0 && containerHeight > 0) {
				const hasScrollableContent = contentHeight > containerHeight + 10;
				if (hasScrollableContent) {
					setShowScrollButton(true);
					console.log('Delayed check: Content is scrollable, showing button');
				}
			}
		}, 500); // Longer delay to ensure layout is complete
		
		return () => clearTimeout(timer);
	}, [messages, contentHeight, containerHeight]); 

	// Update scroll button visibility when content dimensions change
	React.useEffect(() => {
		if (contentHeight > 0 && containerHeight > 0) {
			updateScrollButtonVisibility();
		}
	}, [updateScrollButtonVisibility, contentHeight, containerHeight]);

	// Apply smooth animation when keyboard appears/disappears
	// Apply smooth animations on layout changes
	React.useEffect(() => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
	}, []);

	if (error) return <Text>{error.message}</Text>;

	return (
		<SafeAreaView style={styles.safeArea}>
			<KeyboardAvoidingView
				style={styles.keyboardAvoiding}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={0}
				>
				<View style={styles.container}>
					<ScrollView
					ref={scrollViewRef}
					style={styles.messagesContainer}
					contentContainerStyle={styles.messagesContent}
					keyboardShouldPersistTaps="handled"
					contentInsetAdjustmentBehavior="automatic"
					showsVerticalScrollIndicator={false}
					scrollEventThrottle={16}
					onScroll={handleScroll}
					onLayout={(event) => {
						setContainerHeight(event.nativeEvent.layout.height);
					}}
					onContentSizeChange={(width, height) => {
						// Important: Set content height FIRST, then check if we need to show scroll button
						setContentHeight(height);
						
						// Immediate check for scrollable content - more aggressive than updateScrollButtonVisibility
						if (containerHeight > 0 && height > containerHeight && messages.length > 0) {
							// Force show the scroll button if content is taller than container
							setShowScrollButton(true);
							
							// Debug log
							console.log(`Scroll button shown: content(${height}) > container(${containerHeight})`);
						}
					}}
						>
						{messages.map((m) => (
							<View
								key={m.id}
								style={[
									styles.messageRow,
									m.role === "user"
										? styles.messageRowUser
										: styles.messageRowAssistant,
								]}
							>
								<View
									style={[
										styles.bubble,
										m.role === "user"
											? styles.bubbleUser
											: styles.bubbleAssistant,
									]}
								>
									{m.role === "user" ? (
										<Text style={styles.roleTextUser}>You</Text>
									) : (
										<Text style={styles.roleText}>Assistant</Text>
									)}
									<Text style={m.role === "user" ? styles.messageTextUser : styles.messageText}>
										{m.content}
									</Text>
								</View>
							</View>
						))}
					</ScrollView>

					{showScrollButton && (
						<TouchableOpacity
							style={[styles.scrollToBottomButton, { marginBottom: keyboardShown ? -20 : insets.bottom, }]}
							onPress={() => {
								scrollToEnd();
								setShowScrollButton(false);
							}}
							accessibilityRole="button"
							accessibilityLabel="Scroll to bottom"
						>
							<IconSymbol name="chevron.down" size={20} color="#007aff" />
						</TouchableOpacity>
					)}

					<View style={[styles.inputContainer, { marginBottom: keyboardShown ? 0 : insets.bottom + 15, }]}>
						<TextInput
							style={styles.input}
							placeholder="Say something..."
							value={input}
							onChange={(e) =>
								handleInputChange({
									...e,
									target: {
										...e.target,
										value: e.nativeEvent.text,
									},
								} as unknown as React.ChangeEvent<HTMLInputElement>)
							}
							onSubmitEditing={(e) => {
								handleSubmit(e);
								e.preventDefault();
							}}
							placeholderTextColor="#888"
							returnKeyType="send"
							multiline={false}
							textAlign="left"
							blurOnSubmit={true}
							enablesReturnKeyAutomatically={true}
							keyboardAppearance="light"
						/>
						<TouchableOpacity
							style={styles.sendButton}
							onPress={handleSubmit}
							accessibilityRole="button"
							accessibilityLabel="Send message"
						>
							<Text style={styles.sendButtonText}>Send</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.trashButton}
							onPress={() => setMessages([])}
							accessibilityRole="button"
							accessibilityLabel="Clear chat messages"
						>
							<IconSymbol name="trash.fill" size={22} color="#888" />
						</TouchableOpacity>
					</View>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#f7f7fa",
	},
	keyboardAvoiding: {
		flex: 1,
	},
	container: {
		flex: 1,
		paddingTop: 8,
		paddingBottom: 0,
		justifyContent: "flex-end",
	},
	messagesContainer: {
		flex: 1,
		paddingBottom: 12,
		paddingHorizontal: 8,
	},
	messagesContent: {
		paddingVertical: 12,
		paddingBottom: 20,
	},
	messageRow: {
		flexDirection: "row",
		marginBottom: 10,
		alignItems: "flex-end",
	},
	messageRowUser: {
		justifyContent: "flex-end",
	},
	messageRowAssistant: {
		justifyContent: "flex-start",
	},
	bubble: {
		maxWidth: "80%",
		borderRadius: 18,
		paddingVertical: 10,
		paddingHorizontal: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.07,
		shadowRadius: 2,
		elevation: 1,
	},
	bubbleUser: {
		backgroundColor: "#007aff",
		marginLeft: 40,
		borderTopRightRadius: 18,
		borderTopLeftRadius: 18,
		borderBottomRightRadius: 4,
		borderBottomLeftRadius: 18,
	},
	bubbleAssistant: {
		backgroundColor: "#e5e5ea",
		marginRight: 40,
		borderTopLeftRadius: 4,
	},
	roleText: {
		fontSize: 12,
		color: "#888",
		marginBottom: 2,
		fontWeight: "600",
	},
	roleTextUser: {
		fontSize: 12,
		color: "#e0eaff",
		marginBottom: 2,
		fontWeight: "600",
		opacity: 0.7,
	},
	messageText: {
		fontSize: 16,
		color: "#222",
	},
	messageTextUser: {
		fontSize: 16,
		color: "#fff",
	},
	inputContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fff",
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingVertical: 8,
		paddingHorizontal: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	input: {
		flex: 1,
		fontSize: 16,
		paddingVertical: 10,
		paddingHorizontal: 12,
		backgroundColor: "transparent",
		color: "#222",
		minHeight: 40,
	},
	sendButton: {
		backgroundColor: "#4f8cff",
		borderRadius: 20,
		paddingVertical: 8,
		paddingHorizontal: 18,
		marginLeft: 8,
	},
	sendButtonText: {
		color: "#fff",
		fontWeight: "bold",
		fontSize: 16,
	},
	trashButton: {
		marginLeft: 8,
		padding: 6,
		borderRadius: 16,
		backgroundColor: "#f2f2f7",
		justifyContent: "center",
		alignItems: "center",
	},
	scrollToBottomButton: {
		position: "absolute",
		bottom: 80,
		alignSelf: "center",
		backgroundColor: "#fff",
		borderRadius: 20,
		padding: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
		borderWidth: 1,
		borderColor: "#e0e0e0",
	},
});
