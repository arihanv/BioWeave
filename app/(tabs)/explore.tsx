import { useAppleHealthKit } from "@/hooks/useAppleHealthKit";
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useChat } from '@ai-sdk/react';
import { fetch as expoFetch } from 'expo/fetch';
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

export default function App() {
  const { status, error: healthKitError, getStepCountSamples } = useAppleHealthKit();
  const { messages, error, handleInputChange, input, handleSubmit, setMessages } = useChat({
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    maxSteps: 5,
    // api: generateAPIUrl('/api/chat'),
    api: 'http://localhost:8081/api/chat',
    onError: error => console.error(error, 'ERROR'),
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === 'getLocation') {
        const cities = [
          'New York',
          'Los Angeles',
          'Chicago',
          'San Francisco',
        ];
        return cities[Math.floor(Math.random() * cities.length)];
      }

      console.log('toolCall', toolCall);

      if (toolCall.toolName === 'getStepCount') {
        const startDate = toolCall.args?.startDate;
        const endDate = toolCall.args?.endDate;

        const stepCount = await getStepCountSamples({
          startDate,
          endDate,
        });
        console.log('stepCount', stepCount);
        return stepCount;
      }
    },
  });
  const scrollViewRef = useAutoScroll();

  if (error) return <Text>{error.message}</Text>;

  return (
    <SafeAreaView style={{ height: '100%' }}>
      <View
        style={{
          height: '95%',
          display: 'flex',
          flexDirection: 'column',
          paddingHorizontal: 8,
        }}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={{ flex: 1 }}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {messages.map(m => (
            <View key={m.id} style={{ marginVertical: 8 }}>
              <View>
                <Text style={{ fontWeight: 700 }}>{m.role}</Text>
                <Text>{m.content}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ marginTop: 8 }}>
          <TextInput
            style={{ backgroundColor: 'white', padding: 8 }}
            placeholder="Say something..."
            value={input}
            onChange={e =>
              handleInputChange({
                ...e,
                target: {
                  ...e.target,
                  value: e.nativeEvent.text,
                },
              } as unknown as React.ChangeEvent<HTMLInputElement>)
            }
            onSubmitEditing={e => {
              handleSubmit(e);
              e.preventDefault();
            }}
            autoFocus={true}
          />
          <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
            <Text
              onPress={() => setMessages([])}
              style={{
                backgroundColor: '#e53e3e',
                color: 'white',
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 6,
                fontWeight: 'bold',
                textAlign: 'center',
                overflow: 'hidden',
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear chat messages"
            >
              Clear Chat
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}