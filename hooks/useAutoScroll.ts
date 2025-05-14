import { useRef } from "react";
import type { ScrollView } from "react-native";

export const useAutoScroll = () => {
	const scrollViewRef = useRef<ScrollView>(null);
	return scrollViewRef;
};
