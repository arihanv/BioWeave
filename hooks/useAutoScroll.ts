import { useCallback, useRef } from "react";
import type { ScrollView } from "react-native";

export const useAutoScroll = () => {
	const scrollViewRef = useRef<ScrollView>(null);
	const isScrollingToEndRef = useRef(false);

	const scrollToEnd = useCallback(() => {
		if (!isScrollingToEndRef.current && scrollViewRef.current) {
			isScrollingToEndRef.current = true;
			
			// Use requestAnimationFrame to ensure DOM/layout updates are complete
			requestAnimationFrame(() => {
				if (scrollViewRef.current) {
					// Scroll with extra padding to ensure full message visibility
					scrollViewRef.current.scrollToEnd({ animated: true });
					// Add a small delay and scroll again with offset to ensure full visibility
					setTimeout(() => {
						if (scrollViewRef.current) {
							scrollViewRef.current.scrollToEnd({ animated: false });
						}
					}, 100);
				}
			});
			
			// Reset the flag after animation completes
			setTimeout(() => {
				isScrollingToEndRef.current = false;
			}, 600); // Increased timeout to account for the additional scroll
		}
	}, []);

	return { scrollViewRef, scrollToEnd };
};
