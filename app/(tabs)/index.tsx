import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { Collapsible } from "@/components/Collapsible";
import { ExternalLink } from "@/components/ExternalLink";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";

import { useAppleHealthKit } from "@/hooks/useAppleHealthKit"; // 👈 your hook

export default function TabTwoScreen() {
	// const { status, error, getStepCountSamples } = useAppleHealthKit();
	// const [steps, setSteps] = useState<number | null>(null);

	// useEffect(() => {
	// 	if (status === "ready") {
	// 		console.log("Fetching step count samples");
	// 		getStepCountSamples({
	// 			startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // past 24 hours
	// 			endDate: new Date().toISOString(),
	// 		})
	// 			.then((results) => {
	// 				console.log("Step count samples fetched:", results);
	// 				if (Array.isArray(results) && results.length > 0) {
	// 					// Sum up the values if results is an array
	// 					const totalSteps = results.reduce(
	// 						(sum, item) => sum + (item.value || 0),
	// 						0,
	// 					);
	// 					setSteps(totalSteps);
	// 				} else if (results && typeof results.value === "number") {
	// 					// Handle the case where results is a single object
	// 					setSteps(results.value);
	// 				}
	// 			})
	// 			.catch((err) => {
	// 				console.error("Step count fetch error:", err);
	// 			});
	// 	}
	// }, [status, getStepCountSamples]);

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
			headerImage={
				<IconSymbol
					size={310}
					color="#808080"
					name="chevron.left.forwardslash.chevron.right"
					style={styles.headerImage}
				/>
			}
		>
			<ThemedView style={styles.titleContainer}>
				<ThemedText type="title">Explore</ThemedText>
			</ThemedView>

			<ThemedText>
				This app includes example code to help you get started.
			</ThemedText>

			{/* ✅ HealthKit Integration */}
			{/* <Collapsible title="Apple HealthKit">
				<ThemedText>Status: {status}</ThemedText>
				{error && <ThemedText>Error: {error}</ThemedText>}
				{steps !== null && <ThemedText>Steps in last 24h: {steps}</ThemedText>}
			</Collapsible> */}

			<Collapsible title="File-based routing">
				<ThemedText>
					This app has two screens:{" "}
					<ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText>{" "}
					and{" "}
					<ThemedText type="defaultSemiBold">app/(tabs)/explore.tsx</ThemedText>
				</ThemedText>
				<ThemedText>
					The layout file in{" "}
					<ThemedText type="defaultSemiBold">app/(tabs)/_layout.tsx</ThemedText>{" "}
					sets up the tab navigator.
				</ThemedText>
				<ExternalLink href="https://docs.expo.dev/router/introduction">
					<ThemedText type="link">Learn more</ThemedText>
				</ExternalLink>
			</Collapsible>

			{/* other collapsibles remain unchanged */}
			{/* ... */}
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	headerImage: {
		color: "#808080",
		bottom: -90,
		left: -35,
		position: "absolute",
	},
	titleContainer: {
		flexDirection: "row",
		gap: 8,
	},
});
