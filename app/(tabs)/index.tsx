import React from "react";
import {
	KeyboardAvoidingView,
	LayoutAnimation,
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
import { RAGResults } from "@/components/ui/RAGResults";
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

// Define a type for our cached RAG data
interface CachedRagData {
	query: string;
	results: any[]; // Consider defining a stricter type for results
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
		getActivitySummary,
		getCaloriesBurned,
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

				if (toolCall.toolName === "makeRAGQuery") {
					try {
						const args = toolCall.args as { query: string; topK?: number };
						const { query, topK = 4 } = args;
						
						console.log("RAG Query - Making API request for:", query);
						console.log("RAG Query - topK:", topK);
						
						// Make request to our RAG API route
						const response = await fetch("https://expo.ariv.sh/api/rag", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								query,
								topK,
								minScore: 0.3
							})
						});
						
						if (!response.ok) {
							const errorData = await response.json();
							throw new Error(errorData.error || `HTTP ${response.status}`);
						}
						
						const result = await response.json();
						
						console.log("RAG Query - API Response:", result);
						console.log("RAG Query - Results found:", result.count);
						
						// Return a properly formatted result that matches the Vercel AI SDK's expectations
						return {
							query: result.query,
							results: result.results || [],
							count: result.count || 0
						};
					} catch (error) {
						console.error("RAG Query Error:", error);
						const args = toolCall.args as { query: string; topK?: number };
						return {
							query: args.query,
							results: [],
							count: 0,
							error: `RAG query failed: ${error instanceof Error ? error.message : String(error)}`
						};
					}
				}

				console.log("toolCall", toolCall);

				const periodArgs: HealthInputOptions = { period: 1440 };

				if (typeof toolCall.args === "object" && toolCall.args !== null) {
					const { startDate, endDate } = toolCall.args as { startDate?: string; endDate?: string };
					if (typeof startDate === "string") {
						const localStartDate = convertUTCToLocalDateRange(startDate);
						if (localStartDate) periodArgs.startDate = localStartDate;
					}
					if (typeof endDate === "string") {
						const localEndDate = convertUTCToLocalDateRange(endDate);
						if (localEndDate) periodArgs.endDate = localEndDate;
					}
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

				if (toolCall.toolName === "getActivitySummary") {
					console.log("activitySummaryArgs", periodArgs);
					const activitySummary = await getActivitySummary(periodArgs);
					console.log("activitySummary", activitySummary);
					return activitySummary;
				}

				if (toolCall.toolName === "getCaloriesBurned") {
					console.log("caloriesBurnedArgs", periodArgs);
					const caloriesBurned = await getCaloriesBurned(periodArgs);
					console.log("caloriesBurned", caloriesBurned);
					return caloriesBurned;
				}

				// Return error message for unknown tool calls
				return `Unknown tool: ${toolCall.toolName}`;
			} catch (error) {
				console.error(`Error in ${toolCall.toolName}:`, error);
				// Return a properly formatted error result
				return {
					error: `Failed to execute ${toolCall.toolName}: ${error instanceof Error ? error.message : String(error)}`,
					results: [],
					count: 0
				};
			} finally {
				// Remove the tool call from active list when done
				setActiveToolCalls(prev => prev.filter(call => 
					!(call.toolName === toolCall.toolName && call.startTime === startTime)
				));
			}
		},
	});
	
	// // Memoize RAG data extraction to prevent unnecessary re-computations and avoid flashing
	// const ragDataByMessage = React.useMemo(() => {
	// 	const result: Record<string, CachedRagData> = {};
		
	// 	for (const message of messages) {
	// 		if (message.role === 'assistant' && message.toolInvocations) {
	// 			const ragInvocation = message.toolInvocations.find(
	// 				inv => inv.toolName === 'makeRAGQuery'
	// 			);

	// 			// Check if the tool invocation has completed and has a result
	// 			if (ragInvocation && 'result' in ragInvocation && ragInvocation.result) {
	// 				const ragResult = ragInvocation.result as any;
	// 				if (ragResult.results && Array.isArray(ragResult.results) && ragResult.results.length > 0) {
	// 					result[message.id] = {
	// 						query: ragResult.query,
	// 						results: ragResult.results,
	// 					};
	// 				}
	// 			}
	// 		}
	// 	}
		
	// 	return result;
	// }, [messages]);
	
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
	
	// Update refs when functions change
	React.useEffect(() => {
		saveCurrentConversationRef.current = saveCurrentConversation;
	}, [saveCurrentConversation]);
	
	React.useEffect(() => {
		loadConversationRef.current = loadConversation;
	}, [loadConversation]);
	
	// Remove this useEffect to prevent infinite loops
	// setMessagesRef.current will be updated directly where needed

	// Filter messages to only show user, assistant, and system messages
	const renderableMessages = React.useMemo(() => 
		messages.filter(message => 
			message.role === 'user' || message.role === 'assistant' || message.role === 'system'
		), [messages]
	);

	// const handleScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
	// 	const scrollData = event.nativeEvent;
	// 	const { contentOffset, contentSize, layoutMeasurement } = scrollData;
	// 	const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
	// 	const hasScrollableContent = contentSize.height > layoutMeasurement.height;
		
	// 	isNearBottom.current = isAtBottom;
	// 	const shouldShowButton = hasScrollableContent && !isAtBottom && renderableMessages.length > 0;
		
	// 	setShowScrollButton(shouldShowButton);
	// 	setLastScrollData(scrollData);
	// }, [renderableMessages.length]);
	

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
			setMessages(conversationMessages);
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
								const newHeight = event.nativeEvent.layout.height;
								setContainerHeight(prev => prev !== newHeight ? newHeight : prev);
							}}
							onContentSizeChange={(width, height) => {
								setContentHeight(prev => prev !== height ? height : prev);
							}}
							showsVerticalScrollIndicator={false}
							keyboardShouldPersistTaps="handled"
							keyboardDismissMode="interactive"
						>
							{renderableMessages.map((message) => {
								const ragData = ragDataByMessage[message.id];
								const isAssistant = message.role === 'assistant';
								
								return (
									<React.Fragment key={message.id}>
										{/* Show RAG results before the assistant message if available */}
										{isAssistant && ragData && (
											<View style={styles.ragResultsWrapper}>
												<RAGResults
													query={ragData.query}
													results={ragData.results}
												/>
											</View>
										)}
										
										<MessageBubble
											message={message}
											isTyping={isLoading && message.id === messages[messages.length - 1]?.id}
											// Remove cachedRagData prop since we're showing RAG results separately
										/>
									</React.Fragment>
								);
							})}
							
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
	ragResultsWrapper: {
		marginHorizontal: 16,
		marginBottom: 8,
		backgroundColor: '#1a1a1a',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		overflow: 'hidden',
	},
});
