import { IconSymbol } from "@/components/ui/IconSymbol";
import { useAppleHealthKit } from "@/hooks/useAppleHealthKit";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChat } from "@ai-sdk/react";
import { fetch as expoFetch } from "expo/fetch";
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

export default function App() {
	const {
		status,
		error: healthKitError,
		getStepCountSamples,
    getHeartRateSamples,
	} = useAppleHealthKit();
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
		// api: generateAPIUrl('/api/chat'), # TODO: add this back in and fix
		api: "http://localhost:8081/api/chat",
		onError: (error) => console.error(error, "ERROR"),
		async onToolCall({ toolCall }) {
			if (toolCall.toolName === "getLocation") {
				const cities = ["New York", "Los Angeles", "Chicago", "San Francisco"];
				return cities[Math.floor(Math.random() * cities.length)];
			}

			console.log("toolCall", toolCall);

			if (toolCall.toolName === "getStepCount") {
				const args =
					typeof toolCall.args === "object" && toolCall.args !== null
						? toolCall.args
						: {};
				const { startDate, endDate } = args as {
					startDate?: string;
					endDate?: string;
				};
				const stepArgs: Record<string, string> = {};
				if (typeof startDate === "string") {
					const d = new Date(startDate);
					if (!Number.isNaN(d.getTime())) stepArgs.startDate = d.toISOString();
				}
				if (typeof endDate === "string") {
					const d = new Date(endDate);
					if (!Number.isNaN(d.getTime())) stepArgs.endDate = d.toISOString();
				}

				console.log("stepArgs", stepArgs);

				const stepCount = await getStepCountSamples(stepArgs);
				console.log("stepCount", stepCount);
				return stepCount;
			}

      if (toolCall.toolName === "getHeartRate") {
        const args =
          typeof toolCall.args === "object" && toolCall.args !== null
            ? toolCall.args
            : {};
        const { startDate, endDate } = args as {
          startDate?: string;
          endDate?: string;
        };
        const heartRateArgs: Record<string, string> = {};
        if (typeof startDate === "string") {
          const d = new Date(startDate);
          if (!Number.isNaN(d.getTime())) heartRateArgs.startDate = d.toISOString();
        }
        if (typeof endDate === "string") {
          const d = new Date(endDate);
          if (!Number.isNaN(d.getTime())) heartRateArgs.endDate = d.toISOString();
        }
        console.log("heartRateArgs", heartRateArgs);
        const heartRates = await getHeartRateSamples(heartRateArgs);
        console.log("heartRates", heartRates);
        return heartRates;
      }

		},
	});
	const scrollViewRef = useAutoScroll();

	if (error) return <Text>{error.message}</Text>;

	return (
		<SafeAreaView style={styles.safeArea}>
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
