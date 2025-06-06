import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface ToolCallIndicatorProps {
  toolName: string;
  isActive?: boolean;
  duration?: number;
  args?: any;
}

export const ToolCallIndicator: React.FC<ToolCallIndicatorProps> = ({
  toolName,
  isActive = false,
  duration,
  args,
}) => {
  const getDisplayInfo = (toolName: string) => {
    switch (toolName) {
      case 'getStepCount':
        return { icon: '👣', label: 'Steps' };
      case 'getHeartRate':
        return { icon: '❤️', label: 'Heart rate' };
      case 'getLocation':
        return { icon: '📍', label: 'Location' };
      default:
        return { icon: '🧠', label: 'Thinking' };
    }
  };

  const formatArgs = (args: any) => {
    if (!args || Object.keys(args).length === 0) return '';
    
    const argStrings: string[] = [];
    
    // Handle date parameters
    if (args.startDate) {
      const date = new Date(args.startDate);
      if (!isNaN(date.getTime())) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        argStrings.push(`${dayName} ${monthDay}`);
      }
    }
    
    if (args.endDate) {
      const date = new Date(args.endDate);
      if (!isNaN(date.getTime())) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        argStrings.push(`${dayName} ${monthDay}`);
      }
    }
    
    // Handle period
    if (args.period && typeof args.period === 'number') {
      if (args.period >= 1440) {
        const days = Math.floor(args.period / 1440);
        argStrings.push(`${days}d`);
      } else if (args.period >= 60) {
        const hours = Math.floor(args.period / 60);
        argStrings.push(`${hours}h`);
      } else {
        argStrings.push(`${args.period}m`);
      }
    }
    
    // Handle other parameters
    if (args.limit && typeof args.limit === 'number') {
      argStrings.push(`${args.limit}`);
    }
    
    if (args.unit && typeof args.unit === 'string') {
      argStrings.push(args.unit);
    }
    
    return argStrings.length > 0 ? ` • ${argStrings.join(', ')}` : '';
  };

  const { icon, label } = getDisplayInfo(toolName);
  
  const getDurationText = () => {
    if (duration) {
      return `${duration}s`;
    }
    return '';
  };

  const argsText = formatArgs(args);

  return (
    <View style={styles.container}>
      <View style={styles.indicator}>
        {isActive ? (
          <ActivityIndicator size="small" color="#8e8e93" />
        ) : (
          <Text style={styles.icon}>{icon}</Text>
        )}
        <Text style={styles.text}>
          {label}{getDurationText()}{argsText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  icon: {
    fontSize: 12,
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '500',
  },
}); 