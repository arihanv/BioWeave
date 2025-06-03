import { IconSymbol } from "@/components/ui/IconSymbol";
import { useAppleHealthKit } from "@/hooks/useAppleHealthKit";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { fetch as expoFetch } from "expo/fetch";
import React, { useState, useEffect } from "react";
import Constants from 'expo-constants';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function App() {
	const {
		status,
		error: healthKitError,
		getStepCountSamples,
    getHeartRateSamples,
	} = useAppleHealthKit();
	
	// Initialize state for our test API
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [apiStatus, setApiStatus] = useState<string | null>(null);

	// Handle input changes
	const handleInputChange = (e: any) => {
		setInput(e.nativeEvent.text);
	};

	// Handle form submission with streaming Gemini response
	const handleSubmit = async (e?: any) => {
		if (e) e.preventDefault?.();
		if (!input.trim()) return;

		// Generate a unique ID for the message
		const messageId = Date.now().toString();

		// Add user message to the chat
		const userMessage: Message = { id: messageId, role: 'user', content: input };
		setMessages(prev => [...prev, userMessage]);
		setInput('');
		setIsLoading(true);

		// Add a placeholder for the assistant's streaming message
		const assistantId = (Date.now() + 1).toString();
		setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

		try {
			const apiUrl = '/api/chat';
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
				body: JSON.stringify({ message: input }),
			});

			if (!response.ok) {
				let errorText = response.statusText || "Unknown error";
				try {
					// Attempt to parse the error response as JSON, as FastAPI/our API often returns JSON errors
					const errorBody = await response.json();
					// Use 'detail' (FastAPI standard), 'error' (common), or 'message', then stringify as fallback
					errorText = errorBody.detail || errorBody.error || errorBody.message || JSON.stringify(errorBody);
				} catch (e) {
					// If parsing as JSON fails, try to read as plain text
					try {
						const plainErrorText = await response.text();
						if (plainErrorText) errorText = plainErrorText;
					} catch (e2) {
						// If reading as text also fails, stick with statusText or generic message
					}
				}
				throw new Error(`API Error (${response.status}): ${errorText}`);
			}

			// Response is now JSON, not a stream
			const responseData = await response.json();

			// Ensure responseData has the expected structure (text for the answer)
			if (responseData && typeof responseData.text === 'string') {
				setMessages(prev => prev.map(m =>
					m.id === assistantId ? { ...m, content: responseData.text } : m
				));
				// TODO: Optionally, handle/store responseData.retrieved_chunks here
				// For example, you could add them to the message object:
				// setMessages(prev => prev.map(m =>
				//   m.id === assistantId ? { ...m, content: responseData.text, chunks: responseData.retrieved_chunks } : m
				// ));
			} else {
				// If the API returns an error JSON with a message/error property (e.g. from chat+api.ts or RAG API itself)
				if (responseData && (responseData.message || responseData.error || responseData.detail)) {
					throw new Error(`API Error: ${responseData.message || responseData.error || responseData.detail}`);
				}
				throw new Error('Unexpected response format from API or missing text field.');
			}
		} catch (err) {
			setError(err instanceof Error ? err : new Error(String(err)));
			setMessages(prev => prev.map(m =>
				m.id === assistantId ? { ...m, content: `Error: ${err instanceof Error ? err.message : String(err)}` } : m
			));
		} finally {
			setIsLoading(false);
		}
	};

	// Check API status on mount
	useEffect(() => {
		const checkApiStatus = async () => {
			try {
				console.log('Checking API status...');
				// Use a relative URL instead of hardcoding localhost to avoid CORS issues
				const apiUrl = '/api/chat';
				console.log(`Making API status request to: ${apiUrl}`);
				
				const response = await fetch(apiUrl, { 
					method: 'GET',
					headers: { 
						'Content-Type': 'application/json',
						'Accept': 'application/json'
					},
					mode: 'cors'
				});
				
				if (response.ok) {
					const data = await response.json();
					console.log('API status response:', data);
					setApiStatus('API is connected');
				} else {
					console.error('API status check failed:', response.status);
					setApiStatus(`API error: ${response.status}`);
				}
			} catch (err) {
				console.error('Error checking API:', err);
				setApiStatus(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
			}
		};
		
		checkApiStatus();
	}, []);
	
	const scrollViewRef = useAutoScroll();

	// Display API status in a non-intrusive way
	return (
		<SafeAreaView style={styles.safeArea}>
			{apiStatus && (
				<View style={styles.apiStatusContainer}>
					<Text style={styles.apiStatusText}>
						{apiStatus}
					</Text>
				</View>
			)}
			<KeyboardAvoidingView
				style={styles.keyboardAvoiding}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				keyboardVerticalOffset={80}
			>
				<View style={styles.container}>
					<ScrollView
						ref={scrollViewRef}
						style={styles.messagesContainer}
						contentContainerStyle={styles.messagesContent}
						onContentSizeChange={() => {
							scrollViewRef.current?.scrollToEnd({ animated: true });
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

					<View style={styles.inputContainer}>
						<TextInput
							style={styles.input}
							placeholder="Say something..."
							value={input}
							onChange={handleInputChange}
							onSubmitEditing={handleSubmit}
							autoFocus={true}
							placeholderTextColor="#888"
							returnKeyType="send"
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
	apiStatusContainer: {
		padding: 6,
		backgroundColor: '#f0f8ff',
		borderBottomWidth: 1,
		borderBottomColor: '#e0e0e0',
		alignItems: 'center',
	},
	apiStatusText: {
		fontSize: 12,
		color: '#4a6fa5',
	},
	safeArea: {
		flex: 1,
		backgroundColor: "#f7f7fa",
	},
	keyboardAvoiding: {
		flex: 1,
	},
	container: {
		flex: 1,
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 0,
		justifyContent: "flex-end",
	},
	messagesContainer: {
		flex: 1,
	},
	messagesContent: {
		paddingVertical: 12,
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
		borderRadius: 24,
		paddingHorizontal: 12,
		paddingVertical: 6,
		marginBottom: 60,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	input: {
		flex: 1,
		fontSize: 16,
		paddingVertical: 8,
		paddingHorizontal: 8,
		backgroundColor: "transparent",
		color: "#222",
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
});
