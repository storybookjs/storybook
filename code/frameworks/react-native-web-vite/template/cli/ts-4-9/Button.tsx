import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ButtonProps {
  /** Is this the principal call to action on the page? */
  primary?: boolean;
  /** What background color to use */
  backgroundColor?: string;
  /** How large should the button be? */
  size?: 'small' | 'medium' | 'large';
  /** Button contents */
  label: string;
  /** Optional click handler */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Primary UI component for user interaction */
export const Button = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  style,
  onPress,
}: ButtonProps) => {
  const modeStyle = primary ? styles.primary : styles.secondary;
  const textModeStyle = primary ? styles.primaryText : styles.secondaryText;

  const sizeStyle = styles[size];
  const textSizeStyle = textSizeStyles[size];

  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.6} onPress={onPress}>
      <View
        style={[
          styles.button,
          modeStyle,
          sizeStyle,
          style,
          !!backgroundColor && { backgroundColor },
          { borderColor: 'black' },
        ]}
      >
        <Text style={[textModeStyle, textSizeStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 0,
    borderRadius: 48,
  },
  buttonText: {
    fontWeight: '700',
    lineHeight: 1,
  },
  primary: {
    backgroundColor: '#1ea7fd',
  },
  primaryText: {
    color: 'white',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderWidth: 1,
  },
  secondaryText: {
    color: '#333',
  },
  small: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  smallText: {
    fontSize: 12,
  },
  medium: {
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  mediumText: {
    fontSize: 14,
  },
  large: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  largeText: {
    fontSize: 16,
  },
});

const textSizeStyles = {
  small: styles.smallText,
  medium: styles.mediumText,
  large: styles.largeText,
};
